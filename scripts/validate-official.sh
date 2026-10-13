#!/usr/bin/env bash
# Dev-only: validate generated Liftoscript against Liftosaur's OWN parser/evaluator (astashov/liftosaur, AGPL-3.0).
# Nothing from that repo is copied here: it is cloned into a cache dir outside this project and used as-is.
#
#   scripts/validate-official.sh              # programs/*.json (or a generated matrix if programs/ is empty)
#   LIFTOSAUR_SRC=/path/to/cache scripts/validate-official.sh
#   OFFICIAL_SAMPLE=0 scripts/validate-official.sh   # run the repo's validate_liftoscript.ts on EVERY program (slow)
#
# Two layers:
#   1. The repo's own scripts/validate_liftoscript.ts, on N programs wrapped in ```liftoscript fences (default 12, evenly spread).
#   2. A small runner (written into the cache clone, not this project) that, for EVERY program, calls
#      PlannerEvaluator_evaluateFull, checks each exercise resolved to the built-in exercise + equipment written in the
#      text, then plays every day through Liftosaur's playground (complete all sets / fail all sets / finish workout) so
#      the progress scripts (lp, dp, custom) really execute, and re-parses the program text Liftosaur writes back.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${LIFTOSAUR_SRC:-$HOME/.cache/liftosaur-src}"
SAMPLE="${OFFICIAL_SAMPLE:-12}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/liftosaur-validate.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

TSX="$ROOT/node_modules/.bin/tsx"
[ -x "$TSX" ] || TSX="npx --yes tsx"

# --- 1. clone + install (once) ---
if [ ! -d "$SRC/.git" ]; then
  mkdir -p "$(dirname "$SRC")"
  git clone --depth 1 https://github.com/astashov/liftosaur "$SRC"
fi
if [ ! -f "$SRC/.newbie-installed" ]; then
  (cd "$SRC" && { npm ci --ignore-scripts --no-audit --no-fund || npm install --ignore-scripts --no-audit --no-fund; })
  touch "$SRC/.newbie-installed"
fi
# generated sources (whatsnew, grammars...) that the evaluator imports
if [ ! -f "$SRC/src/generated/whatsnew.ts" ]; then
  (cd "$SRC" && node scripts/build-markdown.js >/dev/null)
fi

# --- 2. collect programs ---
PROGRAMS="$WORK/programs"
mkdir -p "$PROGRAMS"
PDIR="${PROGRAMS_DIR:-$ROOT/programs}"
if compgen -G "$PDIR/*.json" >/dev/null; then
  cp "$PDIR"/*.json "$PROGRAMS/"
else
  echo "programs/ is empty - generating the sample matrix"
  (cd "$ROOT" && $TSX scripts/emit-sample-programs.ts "$PROGRAMS")
fi
TOTAL="$(ls "$PROGRAMS" | wc -l | tr -d ' ')"
echo "Validating $TOTAL programs with Liftosaur source at $SRC ($(cd "$SRC" && git rev-parse --short HEAD))"

# --- 3. runner (own code, lives only in the cache clone) ---
cat > "$SRC/scripts/_newbie_runner.ts" <<'RUNNER_EOF'
// Dev-only harness runner for liftosaur-newbie (own code; imports Liftosaur modules from the local clone).
import * as fs from "fs";
import * as path from "path";
import { PlannerEvaluator_evaluateFull } from "../src/pages/planner/plannerEvaluator";
import { Settings_build } from "../src/models/settings";
import { PlannerProgram_evaluateText, PlannerProgram_fullToWeekEvalResult } from "../src/pages/planner/models/plannerProgram";
import { Program_nextHistoryRecord, Program_evaluate, Program_numberOfDays } from "../src/models/program";
import { Playground_run } from "../src/playground/playground";
import { Exercise_find } from "../src/models/exercise";

const EQ: Record<string, string> = {
  barbell: "barbell", cable: "cable", dumbbell: "dumbbell", "smith machine": "smith", band: "band",
  kettlebell: "kettlebell", bodyweight: "bodyweight", "leverage machine": "leverageMachine",
  "medicine ball": "medicineball", "ez bar": "ezbar", "trap bar": "trapbar",
};
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const settings = Settings_build();
settings.units = "kg";
const stats = { weight: {}, length: {}, percentage: {} } as any;
let pass = 0;
const failures: { id: string; errors: string[] }[] = [];
const warnings = new Map<string, number>();

for (const f of files) {
  const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
  const text: string = parsed.text;
  const id: string = parsed.id ?? f;
  const errors: string[] = [];
  const lines: string[] = text.split("\n");
  const lineErr = (line: number, msg: string) => errors.push(`line ${line}: ${msg}\n      > ${lines[line - 1] ?? ""}`);
  try {
    const { evaluatedWeeks } = PlannerEvaluator_evaluateFull(text, settings);
    if (!evaluatedWeeks.success) {
      const e: any = evaluatedWeeks.error;
      lineErr(e.line, e.message);
    } else {
      const weeks = PlannerProgram_fullToWeekEvalResult(evaluatedWeeks);
      for (const week of weeks) for (const day of week) {
        if (!day.success) { lineErr((day.error as any).line, (day.error as any).message); continue; }
        for (const ex of day.data) {
          if (ex.notused) continue;
          const src = lines[ex.line - 1] ?? "";
          const m = src.match(/^([^/]+?),\s*([^/]+?)\s*\//);
          const resolved = ex.exerciseType ? Exercise_find(ex.exerciseType, settings.exercises) : undefined;
          if (!ex.exerciseType || !resolved) { lineErr(ex.line, `exercise did not resolve to a known exercise (${ex.fullName})`); continue; }
          if (resolved.isCustom) lineErr(ex.line, `resolved to a CUSTOM exercise: ${ex.fullName}`);
          if (m) {
            const wantName = m[1].trim().toLowerCase();
            const wantEq = EQ[m[2].trim().toLowerCase()];
            if (resolved.name.toLowerCase() !== wantName) lineErr(ex.line, `name resolved to "${resolved.name}" not "${m[1]}"`);
            if (ex.exerciseType.equipment !== wantEq) lineErr(ex.line, `equipment resolved to "${ex.exerciseType.equipment}" not "${wantEq}"`);
          } // no ", Equipment" suffix: default equipment, nothing to compare
        }
      }
      // Execute progress scripts: complete every set (success run) and fail every set (fail run) for each day.
      const planner = { vtype: "planner" as const, name: "x", weeks: PlannerProgram_evaluateText(text) };
      const program: any = { vtype: "program", id: "t", name: "t", url: "", author: "", shortDescription: "", description: "", nextDay: 1,
        exercises: [], days: [], weeks: [], isMultiweek: planner.weeks.length > 1, tags: [], clonedAt: 0, planner };
      const nDays = Program_numberOfDays(Program_evaluate(program, settings));
      for (let d = 1; d <= nDays; d++) {
        const rec = Program_nextHistoryRecord(program, settings, stats, d);
        for (const mode of ["success", "fail"]) {
          const commands: string[] = [];
          rec.entries.forEach((e, ei) => {
            e.sets.forEach((_s, si) => {
              if (mode === "fail") commands.push(`change_reps(${ei + 1}, ${si + 1}, 1)`);
              commands.push(`complete_set(${ei + 1}, ${si + 1})`);
            });
          });
          commands.push("finish_workout()");
          const r = Playground_run({ programText: text, day: d, commands }, settings, stats);
          if (!r.success) errors.push(`day ${d} ${mode} run: ${r.error}`);
          else if (!r.data.updatedProgramText) errors.push(`day ${d} ${mode} run: no updated program text`);
          else {
            const again = PlannerEvaluator_evaluateFull(r.data.updatedProgramText, settings);
            if (!again.evaluatedWeeks.success) errors.push(`day ${d} ${mode} run: updated program does not re-parse: ${(again.evaluatedWeeks.error as any).message}`);
            if (mode === "success" && r.data.updatedProgramText === text) warnings.set("success run changed nothing", (warnings.get("success run changed nothing") ?? 0) + 1);
          }
        }
      }
    }
  } catch (e: any) {
    errors.push(`exception: ${e?.stack ?? e}`);
  }
  if (errors.length) failures.push({ id, errors }); else pass++;
}
for (const f of failures.slice(0, 15)) console.error(`FAIL ${f.id}\n  ${f.errors.slice(0, 6).join("\n  ")}`);
console.log(`programs: ${files.length}  pass: ${pass}  fail: ${failures.length}`);
for (const [w, n] of warnings) console.log(`note: ${w}: ${n} runs`);
process.exit(failures.length ? 1 : 0);
RUNNER_EOF

STATUS=0

# --- 4. the repo's own validator on (a sample of) the programs, wrapped in a ```liftoscript fence ---
OFFICIAL_FAIL=0
FILES=("$PROGRAMS"/*.json)
STEP=1
if [ "$SAMPLE" -gt 0 ] && [ "$TOTAL" -gt "$SAMPLE" ]; then STEP=$(( TOTAL / SAMPLE )); fi
i=0; ran=0
for f in "${FILES[@]}"; do
  if [ $(( i % STEP )) -eq 0 ] && { [ "$SAMPLE" -eq 0 ] || [ "$ran" -lt "$SAMPLE" ]; }; then
    md="$WORK/$(basename "${f%.json}").md"
    node -e 'const t=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).text;process.stdout.write("```liftoscript\n"+t+(t.endsWith("\n")?"":"\n")+"```\n")' "$f" > "$md"
    if out="$(cd "$SRC" && $TSX scripts/validate_liftoscript.ts "$md" 2>&1)" && grep -q "VALIDATION: OK" <<<"$out"; then
      ran=$((ran+1))
    else
      ran=$((ran+1)); OFFICIAL_FAIL=$((OFFICIAL_FAIL+1)); STATUS=1
      echo "OFFICIAL VALIDATOR FAIL: $(basename "$f")"; grep -v "npm warn" <<<"$out" | head -20
    fi
  fi
  i=$((i+1))
done
echo "official validate_liftoscript.ts: $((ran-OFFICIAL_FAIL))/$ran ok"

# --- 5. evaluator + progress-script runner over every program ---
(cd "$SRC" && $TSX scripts/_newbie_runner.ts "$PROGRAMS") || STATUS=1

[ "$STATUS" -eq 0 ] && echo "ALL OK" || echo "FAILED"
exit "$STATUS"
