import exercises from "./data/liftosaur-exercises.json";

/**
 * Local, dependency-free Liftoscript linter. It is a fast pre-check only: Liftosaur's own parser
 * (reached through the API) is authoritative.
 */
export interface ValidationIssue {
  line: number;
  message: string;
  /** Defaults to "error". Warnings never fail validation in the CLI. */
  severity?: "error" | "warning";
}

interface ExerciseInfo {
  name: string;
  equipment: string[];
  defaultEquipment: string;
}

const EXERCISES = new Map<string, ExerciseInfo>();
for (const e of exercises as ExerciseInfo[]) EXERCISES.set(e.name.toLowerCase(), e);

const EQUIPMENT_BY_DISPLAY: Record<string, string> = {
  barbell: "barbell",
  cable: "cable",
  dumbbell: "dumbbell",
  "smith machine": "smith",
  band: "band",
  kettlebell: "kettlebell",
  bodyweight: "bodyweight",
  "leverage machine": "leverageMachine",
  "medicine ball": "medicineball",
  "ez bar": "ezbar",
  "trap bar": "trapbar",
};

/** Split `Name, Equipment` like Liftosaur: last comma, tail matched case-insensitively. */
export function splitNameAndEquipment(label: string): { name: string; equipment?: string } {
  const idx = label.lastIndexOf(",");
  if (idx >= 0) {
    const tail = label.slice(idx + 1).trim().toLowerCase();
    const id = EQUIPMENT_BY_DISPLAY[tail];
    if (id) return { name: label.slice(0, idx).trim(), equipment: id };
  }
  return { name: label.trim() };
}

interface LogicalLine {
  line: number;
  text: string;
}

const SETS_RE = /^!?\s*\d+x\d+(-\d+)?\+?$/;
const WEIGHT_RE = /^[+-]?\d+(\.\d+)?(kg|lb)\+?$/;
const TIMER_RE = /^\d+s$/;
const SET_TIMER_RE = /^(\d+s\+?|\?)\|(\d+s\+?|\?)$|^\d+s\+$/;
const RPE_RE = /^@\d+(\.\d+)?\+?$/;
const PERCENT_RE = /^\d+(\.\d+)?%\+?$/;
const LABEL_RE = /^\([^)]{1,8}\)$/;
const MODIFIER_RES = [WEIGHT_RE, TIMER_RE, SET_TIMER_RE, RPE_RE, PERCENT_RE, LABEL_RE, /^auto$/, /^\?\+?$/];

const isModifier = (t: string) => MODIFIER_RES.some((r) => r.test(t));

/** Join `{~ ... ~}` blocks and trailing-backslash continuations into logical lines. */
function toLogicalLines(text: string, issues: ValidationIssue[]): LogicalLine[] {
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  const out: LogicalLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    let cur = raw[i]!;
    const start = i + 1;
    if (/^\s*\/\//.test(cur)) {
      out.push({ line: start, text: cur });
      continue;
    }
    for (;;) {
      const opens = (cur.match(/\{~/g) ?? []).length;
      const closes = (cur.match(/~\}/g) ?? []).length;
      const continued = /\\\s*$/.test(cur);
      if (opens > closes || continued) {
        if (i + 1 >= raw.length) {
          if (opens > closes) issues.push({ line: start, message: "Unclosed `{~` script block (missing `~}`)" });
          break;
        }
        i++;
        cur = (continued ? cur.replace(/\\\s*$/, "") : cur) + "\n" + raw[i]!;
        continue;
      }
      break;
    }
    out.push({ line: start, text: cur });
  }
  return out;
}

/** Split on `/` that is outside `{...}` and `(...)`. */
function splitSections(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "{" || ch === "(") depth++;
    else if (ch === "}" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "/" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
}

function checkSetsSection(section: string): string | undefined {
  for (const group of section.split(",")) {
    const tokens = group.trim().replace(/^!\s*/, "").split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return "empty set group";
    let rest = tokens;
    if (/^\d+x/.test(tokens[0]!)) {
      if (!SETS_RE.test(tokens[0]!)) return `invalid sets \`${tokens[0]}\` (expected e.g. 3x8, 3x8-12, 1x5+)`;
      rest = tokens.slice(1);
    }
    for (const t of rest) if (!isModifier(t)) return `unrecognised token \`${t}\``;
  }
  return undefined;
}

function checkScriptSection(kind: string, body: string): string | undefined {
  const m = /^custom\(([^)]*)\)\s*\{([\s\S]*)\}$/.exec(body);
  if (!m) return `${kind} must be custom(...) { ... } or built-in`;
  const inner = m[2]!.trim();
  if (inner.startsWith("~")) {
    if (!inner.endsWith("~")) return "script block must end with `~}`";
  } else if (!/^\.\.\.[\w ]+$/.test(inner)) {
    return "script body must be a `{~ ... ~}` block or `{ ...reuse }`";
  }
  return undefined;
}

function checkProgress(body: string): string | undefined {
  if (body === "none") return undefined;
  if (/^(lp|dp|sum)\(/.test(body)) {
    const m = /^(lp|dp|sum)\(([^)]*)\)$/.exec(body);
    if (!m) return "malformed progress built-in (check parentheses)";
    const args = m[2]!.split(",").map((a) => a.trim());
    const limits: [number, number] = { lp: [1, 6], dp: [3, 3], sum: [2, 2] }[m[1] as "lp" | "dp" | "sum"] as [number, number];
    if (args.length < limits[0] || args.length > limits[1] || args.some((a) => a === "")) {
      return `${m[1]}() takes ${limits[0] === limits[1] ? limits[0] : `${limits[0]}-${limits[1]}`} argument(s), got ${args.length}`;
    }
    return undefined;
  }
  if (body.startsWith("custom")) return checkScriptSection("progress", body);
  return `unknown progress \`${body.slice(0, 30)}\` (use lp, dp, sum, none or custom)`;
}

export function validateProgramText(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (line: number, message: string) => issues.push({ line, message, severity: "error" });
  const lines = toLogicalLines(text, issues);
  let sawWeek = false;
  let days = 0;
  let inDay = false;
  let firstKg = 0;
  let firstLb = 0;

  for (const { line, text: t0 } of lines) {
    const t = t0.trim();
    if (t === "" || t.startsWith("//")) continue;
    if (t.startsWith("##")) {
      days++;
      inDay = true;
      if (!t.replace(/^##/, "").trim()) err(line, "Day header needs a name (`## Day 1`)");
      continue;
    }
    if (t.startsWith("#")) {
      sawWeek = true;
      inDay = false;
      continue;
    }
    if (!inDay) {
      err(line, "Exercise found before any `## Day` header");
    }

    const sections = splitSections(t);
    let head = sections[0]!;
    const rest = sections.slice(1);
    head = head.replace(/^[\w-]+:\s*(?=\S)/, "").replace(/\[[^\]]*\]\s*$/, "").trim();
    const isTemplate = rest.some((s) => /^used:\s*none$/.test(s));

    if (!head) err(line, "Missing exercise name");
    else if (!isTemplate) {
      for (const variant of head.split("|")) {
        const { name, equipment } = splitNameAndEquipment(variant.replace(/^\s*!/, ""));
        const ex = EXERCISES.get(name.toLowerCase());
        if (!ex) err(line, `Unknown exercise: ${name}`);
        else if (equipment && !ex.equipment.includes(equipment)) {
          err(line, `${ex.name} is not available with ${equipment} (allowed: ${ex.equipment.join(", ")})`);
        }
      }
    }

    let hasRange = false;
    let hasDp = false;
    for (const section of rest) {
      if (section === "") {
        err(line, "Empty section between `/` separators");
        continue;
      }
      let problem: string | undefined;
      if (section.startsWith("...")) continue;
      else if (/^warmup:/.test(section)) {
        const body = section.slice(7).trim();
        if (body !== "none") {
          for (const g of body.split(",")) {
            const tk = g.trim().split(/\s+/);
            if (!/^\d+x\d+$/.test(tk[0] ?? "") || tk.slice(1).some((x) => !(WEIGHT_RE.test(x) || PERCENT_RE.test(x)))) {
              problem = `invalid warmup set \`${g.trim()}\` (expected e.g. 1x5 40kg or 1x3 80%)`;
              break;
            }
          }
        }
      } else if (/^progress:/.test(section)) {
        const body = section.slice(9).trim();
        problem = checkProgress(body);
        if (body.startsWith("dp(")) hasDp = true;
      } else if (/^update:/.test(section)) problem = checkScriptSection("update", section.slice(7).trim());
      else if (/^superset:/.test(section)) {
        const name = section.slice(9).trim();
        if (!name || /[/{}()#[\]|!]/.test(name)) problem = "superset needs a group name without special characters";
      } else if (/^used:/.test(section)) {
        if (section.replace(/\s+/g, "") !== "used:none") problem = "only `used: none` is supported";
      } else if (/^id:/.test(section)) continue;
      else {
        problem = checkSetsSection(section);
        if (/\d+x\d+-\d+/.test(section)) hasRange = true;
      }
      if (problem) err(line, `${problem} (in section \`${section.split("\n")[0]!.slice(0, 40)}\`)`);
    }
    if (hasDp && hasRange) err(line, "dp() should not be combined with a rep range in the sets (use e.g. 3x8)");

    // Unit mixing: ignore script blocks.
    const stripped = t.replace(/\{~[\s\S]*?~\}/g, "");
    if (!firstKg && /\d(kg)\b/.test(stripped)) firstKg = line;
    if (!firstLb && /\d(lb)\b/.test(stripped)) firstLb = line;
  }

  if (days === 0) err(1, "Program has no `## Day` header (need at least one day with exercises)");
  else if (!sawWeek) issues.push({ line: 1, message: "No `# Week` header; Liftosaur expects `# Week 1` first", severity: "warning" });
  if (firstKg && firstLb) {
    issues.push({
      line: Math.max(firstKg, firstLb),
      message: "Program mixes kg and lb weights; pick one unit",
      severity: "warning",
    });
  }
  return issues.sort((a, b) => a.line - b.line);
}

export const hasErrors = (issues: ValidationIssue[]) => issues.some((i) => i.severity !== "warning");
