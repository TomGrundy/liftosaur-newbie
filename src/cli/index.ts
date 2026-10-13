import { appendFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { Command, InvalidArgumentError } from "commander";
import { LiftosaurApiError, LiftosaurClient } from "../api/liftosaur";
import type { GeneratedProgram, Gear, GenerateOptions, Intensity } from "../core";
import { GEAR, GEAR_LABELS, INTENSITIES, generateProgram, hasErrors, validateProgramText } from "../core";
import type { ValidationIssue } from "../core";
import { loadDotEnv } from "./env";
import { DEFAULT_DIR, expandPaths, listProgramFiles, loadAny, readProgram, writeProgram } from "./files";

loadDotEnv();

const log = (s = "") => console.log(s);
const fail = (s: string): never => {
  throw new CliError(s);
};
class CliError extends Error {}

function client(): LiftosaurClient {
  return new LiftosaurClient({ apiKey: process.env.LIFTOSAUR_API_KEY ?? "" });
}

function summary(md: string) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) appendFileSync(f, md + "\n");
}

// ---------- option parsing ----------

const FREE_WEIGHTS: Gear[] = ["barbell", "dumbbell", "kettlebell"];

export function parseGear(value: string): Gear[] {
  const out = new Set<Gear>();
  for (const raw of value.split(",")) {
    const t = raw.trim();
    const k = t.toLowerCase();
    if (!t || k === "none" || k === "bodyweight") continue;
    if (k === "free-weights" || k === "freeweights") FREE_WEIGHTS.forEach((g) => out.add(g));
    else if (k === "all") GEAR.forEach((g) => out.add(g));
    else {
      const g = GEAR.find((x) => x.toLowerCase() === k);
      if (!g) throw new InvalidArgumentError(`Unknown gear "${t}". Valid: ${GEAR.join(", ")}, none, free-weights, all`);
      out.add(g);
    }
  }
  return [...out];
}

function parseIntIn(min: number, max: number) {
  return (v: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new InvalidArgumentError(`Must be an integer ${min}-${max}`);
    return n;
  };
}

function parseIntensity(v: string): Intensity {
  const i = INTENSITIES.find((x) => x === v.toLowerCase());
  if (!i) throw new InvalidArgumentError(`Must be one of: ${INTENSITIES.join(", ")}`);
  return i;
}

// ---------- shared helpers ----------

function printIssues(label: string, issues: ValidationIssue[]) {
  for (const i of issues) console.error(`${label}:${i.line}: ${i.severity === "warning" ? "warning" : "error"}: ${i.message}`);
}

function lintOrThrow(label: string, text: string) {
  const issues = validateProgramText(text);
  printIssues(label, issues);
  if (hasErrors(issues)) fail(`${label}: local validation failed`);
}

function describeError(e: unknown): string {
  if (e instanceof LiftosaurApiError || e instanceof CliError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

async function uploadOne(
  p: GeneratedProgram,
  file: string | undefined,
  opts: { force?: boolean; update?: string },
): Promise<"uploaded" | "skipped"> {
  const label = file ?? p.id;
  if (p.upload && !opts.force && !opts.update) {
    log(`skip ${label}: already uploaded as ${p.upload.programId} (use --force to upload again)`);
    return "skipped";
  }
  lintOrThrow(label, p.text);
  const api = client();
  await api.programStats(p.text);
  const res = opts.update
    ? await api.updateProgram(opts.update, { text: p.text, name: p.name })
    : await api.createProgram({ name: p.name, text: p.text });
  p.upload = { programId: res.id, uploadedAt: new Date().toISOString() };
  if (file && file.endsWith(".json")) writeProgram(path.dirname(file), p);
  // keep file name stable even when the path differs from <id>.json
  log(`${opts.update ? "updated" : "uploaded"} ${label} -> Liftosaur program ${res.id}`);
  return "uploaded";
}

function printProgram(p: GeneratedProgram, file: string | undefined, quiet: boolean) {
  log(`${p.name}`);
  if (file) log(`  file: ${file}`);
  p.days.forEach((d) => log(`  ${d.name}: ${d.exercises.length} exercises, ~${d.estMinutes} min`));
  if (!quiet) {
    log();
    log(p.text.trimEnd());
    log();
  }
}

// ---------- prompts ----------

async function promptMissing(o: Partial<GenerateOptions> & { gearGiven: boolean }): Promise<Omit<GenerateOptions, "seed">> {
  const { checkbox, select } = await import("@inquirer/prompts");
  const gear = o.gearGiven
    ? (o.gear ?? [])
    : ((await checkbox({
        message: "What equipment do you have? (space to toggle, enter to confirm; none = bodyweight)",
        choices: GEAR.map((g) => ({ name: GEAR_LABELS[g], value: g })),
      })) as Gear[]);
  const intensity =
    o.intensity ??
    (await select<Intensity>({
      message: "Intensity?",
      choices: [
        { name: "Light (2 sets, easy start)", value: "light" },
        { name: "Moderate (3 sets, the default for most people)", value: "moderate" },
        { name: "Hard (4 sets + AMRAP, longer rests)", value: "hard" },
      ],
      default: "moderate",
    }));
  const daysPerWeek =
    o.daysPerWeek ??
    (await select<number>({ message: "Days per week?", choices: [2, 3, 4, 5].map((v) => ({ name: `${v} days`, value: v })), default: 3 }));
  const durationMin =
    o.durationMin ??
    (await select<number>({
      message: "Minutes per session?",
      choices: [30, 45, 60, 75, 90].map((v) => ({ name: `${v} min`, value: v })),
      default: 60,
    }));
  return { gear, intensity, daysPerWeek, durationMin };
}

// ---------- commands ----------

const program = new Command();
program
  .name("liftosaur-newbie")
  .description("Generate, validate and upload beginner Liftosaur programs.\n\nUploading needs a Liftosaur Premium API key in LIFTOSAUR_API_KEY (env var or .env file).")
  .showHelpAfterError();

program
  .command("generate")
  .description("Generate beginner programs from your equipment, time and intensity")
  .option("--gear <list>", `comma-separated gear: ${GEAR.join(", ")}; or none/bodyweight, free-weights (barbell,dumbbell,kettlebell), all`, parseGear)
  .option("--intensity <level>", "light | moderate | hard", parseIntensity)
  .option("--duration <min>", "session length in minutes (30-120)", parseIntIn(30, 120))
  .option("--days <n>", "days per week (2-5)", parseIntIn(2, 5))
  .option("--seed <n>", "seed for exercise variation (default: random)", parseIntIn(0, 2 ** 31 - 1))
  .option("--name <name>", "program name")
  .option("--count <n>", "generate n variations with different seeds", parseIntIn(1, 50), 1)
  .option("--out <dir>", "output directory", DEFAULT_DIR)
  .option("--print", "print the Liftoscript to stdout instead of writing files")
  .option("--upload", "upload each program to Liftosaur after validation (needs LIFTOSAUR_API_KEY)")
  .option("--dry-run", "do everything except write files or upload")
  .option("--force", "overwrite existing program files with the same id")
  .option("--quiet", "do not print the Liftoscript")
  .addHelpText(
    "after",
    `
Examples:
  npm run cli -- generate                                  # interactive
  npm run cli -- generate --gear dumbbell,band --intensity moderate --days 3 --duration 45
  npm run cli -- generate --gear free-weights --intensity light --days 2 --duration 30 --count 3 --upload`,
  )
  .action(async (o) => {
    const missing = o.gear === undefined || !o.intensity || !o.duration || !o.days;
    let base: Omit<GenerateOptions, "seed">;
    if (missing) {
      if (!process.stdin.isTTY) {
        fail("Missing required flags (--gear, --intensity, --duration, --days) and stdin is not a terminal.");
      }
      base = await promptMissing({ gear: o.gear, gearGiven: o.gear !== undefined, intensity: o.intensity, durationMin: o.duration, daysPerWeek: o.days });
    } else {
      base = { gear: o.gear, intensity: o.intensity, durationMin: o.duration, daysPerWeek: o.days };
    }
    const seed0: number = o.seed ?? Math.floor(Math.random() * 2 ** 31);
    let failures = 0;
    for (let i = 0; i < o.count; i++) {
      const name = o.name ? (o.count > 1 ? `${o.name} #${i + 1}` : o.name) : undefined;
      const p = generateProgram({ ...base, seed: (seed0 + i) % 2 ** 31, name });
      try {
        lintOrThrow(p.id, p.text);
        let file: string | undefined;
        if (!o.print && !o.dryRun) {
          file = path.join(o.out, `${p.id}.json`);
          if (existsSync(file) && !o.force) fail(`${file} already exists (use --force to overwrite, or a different --seed)`);
          writeProgram(o.out, p);
        } else if (o.dryRun) {
          log(`[dry-run] would write ${path.join(o.out, `${p.id}.json`)}`);
        }
        if (o.print) log(p.text.trimEnd());
        else printProgram(p, file, o.quiet);
        let uploadResult = "not uploaded";
        if (o.upload) {
          if (o.dryRun) uploadResult = "dry-run (skipped)";
          else {
            await uploadOne(p, file, { force: true });
            uploadResult = `uploaded as ${p.upload?.programId}`;
          }
        }
        summary(
          `### ${p.name}\n\n- File: \`${file ?? "(not written)"}\`\n- Upload: ${uploadResult}\n\n\`\`\`\n${p.text.trimEnd()}\n\`\`\`\n`,
        );
      } catch (e) {
        failures++;
        console.error(`error (${p.id}): ${describeError(e)}`);
        summary(`### ${p.name}\n\nFailed: ${describeError(e)}\n`);
      }
    }
    if (failures) process.exitCode = 1;
  });

program
  .command("validate [paths...]")
  .description("Lint program files (.json, .txt, .liftoscript) or directories; default: programs/")
  .option("--remote", "also validate with the Liftosaur API (program-stats; needs LIFTOSAUR_API_KEY)")
  .action(async (paths: string[], o) => {
    const files = expandPaths(paths.length ? paths : [DEFAULT_DIR]);
    if (files.length === 0) log("No program files found.");
    let bad = 0;
    for (const f of files) {
      try {
        const { text } = loadAny(f);
        const issues = validateProgramText(text);
        printIssues(f, issues);
        let ok = !hasErrors(issues);
        if (ok && o.remote) await client().programStats(text);
        log(`${ok ? "ok  " : "FAIL"} ${f}${o.remote && ok ? " (remote ok)" : ""}`);
        if (!ok) bad++;
      } catch (e) {
        bad++;
        console.error(`FAIL ${f}: ${describeError(e)}`);
      }
    }
    log(`${files.length - bad}/${files.length} valid`);
    if (bad) process.exitCode = 1;
  });

program
  .command("upload <files...>")
  .description("Validate (locally, then via the API) and upload program JSON files to your Liftosaur account")
  .option("--force", "upload even if the file was already uploaded")
  .option("--update <programId>", "update an existing Liftosaur program (PUT) instead of creating a new one")
  .action(async (files: string[], o) => {
    let failures = 0;
    for (const f of expandPaths(files)) {
      try {
        if (!f.endsWith(".json")) fail(`${f}: upload needs a program .json file`);
        const p = readProgram(f);
        const r = await uploadOne(p, f, { force: o.force, update: o.update });
        summary(`- \`${f}\`: ${r === "uploaded" ? `uploaded as ${p.upload?.programId}` : "skipped (already uploaded)"}`);
      } catch (e) {
        failures++;
        console.error(`error (${f}): ${describeError(e)}`);
      }
    }
    if (failures) process.exitCode = 1;
  });

program
  .command("list")
  .description("List programs in programs/ (or your Liftosaur account with --remote)")
  .option("--remote", "list programs from the Liftosaur API")
  .option("--dir <dir>", "programs directory", DEFAULT_DIR)
  .action(async (o) => {
    if (o.remote) {
      const rows = await client().listPrograms();
      rows.forEach((r) => log(`${r.id}  ${r.name}${r.isCurrent ? "  (current)" : ""}`));
      if (!rows.length) log("No programs in your account.");
      return;
    }
    const rows = listProgramFiles(o.dir).map(({ program: p }) => [
      p.id,
      p.name,
      String(p.days.length),
      `${p.options.durationMin}m`,
      p.options.intensity,
      p.upload ? `yes (${p.upload.programId})` : "no",
    ]);
    const head = ["id", "name", "days", "duration", "intensity", "uploaded"];
    const all = [head, ...rows];
    const widths = head.map((_, c) => Math.max(...all.map((r) => r[c]!.length)));
    all.forEach((r) => log(r.map((cell, c) => cell.padEnd(widths[c]!)).join("  ").trimEnd()));
    if (!rows.length) log("(no programs yet — run `generate` or `starters`)");
  });

const FULL_GYM: Gear[] = ["barbell", "dumbbell", "kettlebell", "dualPulley", "latPulldown", "band", "pullUpBar"];
export const STARTER_MATRIX: { gear: Gear[]; days: number; intensity: Intensity; duration: number }[] = [
  { gear: FULL_GYM, days: 3, intensity: "moderate", duration: 60 },
  { gear: FULL_GYM, days: 2, intensity: "light", duration: 45 },
  { gear: FULL_GYM, days: 4, intensity: "moderate", duration: 60 },
  { gear: FULL_GYM, days: 4, intensity: "hard", duration: 75 },
  { gear: FULL_GYM, days: 5, intensity: "moderate", duration: 45 },
  { gear: ["dumbbell"], days: 3, intensity: "moderate", duration: 45 },
  { gear: ["band", "pullUpBar"], days: 3, intensity: "moderate", duration: 30 },
  { gear: [], days: 3, intensity: "light", duration: 30 },
  { gear: ["dualPulley", "latPulldown"], days: 3, intensity: "moderate", duration: 45 },
  { gear: ["barbell", "pullUpBar"], days: 3, intensity: "hard", duration: 60 },
  { gear: ["kettlebell", "band"], days: 2, intensity: "moderate", duration: 30 },
];

program
  .command("starters")
  .description("(Re)write the curated starter set into programs/ with stable ids and dates")
  .option("--out <dir>", "output directory", DEFAULT_DIR)
  .action((o) => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const keep = new Set<string>();
    let bad = 0;
    STARTER_MATRIX.forEach((m, i) => {
      const p = generateProgram(
        { gear: m.gear, intensity: m.intensity, durationMin: m.duration, daysPerWeek: m.days, seed: i + 1 },
        created,
      );
      p.starter = true;
      const file = path.join(o.out, `${p.id}.json`);
      const prev = existsSync(file) ? readProgram(file) : undefined;
      if (prev?.upload) p.upload = prev.upload;
      const issues = validateProgramText(p.text);
      printIssues(p.id, issues);
      if (hasErrors(issues)) bad++;
      keep.add(`${p.id}.json`);
      writeProgram(o.out, p);
      log(`wrote ${file}  (${p.days.map((d) => d.estMinutes).join("/")} min)`);
    });
    if (existsSync(o.out)) {
      for (const f of readdirSync(o.out).filter((x) => x.endsWith(".json") && !keep.has(x))) {
        const full = path.join(o.out, f);
        try {
          if (readProgram(full).starter) {
            unlinkSync(full);
            log(`removed stale starter ${full}`);
          }
        } catch {
          /* ignore unreadable files */
        }
      }
    }
    if (bad) process.exitCode = 1;
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(`error: ${describeError(e)}`);
  process.exitCode = 1;
});
