import { hasDefaultWarmup, usesBarProgression } from "./rules";
import type { CatalogEntry, Intensity, PlannedDay, PlannedExercise } from "./types";
import { EQUIPMENT_TEXT } from "./types";

/** `Bench Press, Dumbbell` — equipment is always written explicitly so the default never surprises. */
export function exerciseLabel(entry: CatalogEntry): string {
  return `${entry.name}, ${EQUIPMENT_TEXT[entry.equipment]}`;
}

export function formatKg(kg: number): string {
  // Liftoscript weights: number immediately followed by the unit, e.g. 2.5kg
  return `${Number(kg.toFixed(2))}kg`;
}

function setsText({ sets, reps, amrapLastSet }: PlannedExercise["scheme"]): string {
  if (!amrapLastSet) return `${sets}x${reps}`;
  return sets > 1 ? `${sets - 1}x${reps}, 1x${reps}+` : `1x${reps}+`;
}

/** Max reps before a bodyweight/band movement should be made harder. */
function repCeiling(reps: number): number {
  return reps + 7;
}

function progressText(ex: PlannedExercise, intensity: Intensity): string {
  const { entry, scheme } = ex;
  if (entry.load === "bodyweight" || entry.load === "band") {
    // Rep progression: once every set hits its target, add a rep to each set (up to a ceiling).
    return `progress: custom(maxReps: ${repCeiling(scheme.reps)}) {~
  if (completedReps >= reps && reps[ns] < state.maxReps) {
    reps += 1
  }
~}`;
  }
  if (usesBarProgression(entry)) {
    // Linear progression; drop 10% after 3 failed sessions in a row.
    const failures = intensity === "hard" ? 2 : 3;
    return `progress: lp(${formatKg(entry.incrementKg)}, 1, 0, 10%, ${failures}, 0)`;
  }
  // Double progression: work up from `reps` to `reps + 4`, then add weight and reset.
  return `progress: dp(${formatKg(entry.incrementKg)}, ${scheme.reps}, ${scheme.reps + 4})`;
}

export function exerciseLine(ex: PlannedExercise, intensity: Intensity, withProgress: boolean): string {
  const { entry, scheme } = ex;
  const parts = [exerciseLabel(entry), setsText(scheme), formatKg(entry.startKg), `${scheme.restSec}s`];
  if (!hasDefaultWarmup(entry)) parts.push("warmup: none");
  if (withProgress) parts.push(progressText(ex, intensity));
  return parts.join(" / ");
}

/**
 * Render a planned week as Liftoscript (full-text program format).
 * Progressions are declared once per exercise — later occurrences inherit them.
 */
export function serializeProgram(days: PlannedDay[], intensity: Intensity, description: string): string {
  const lines: string[] = [`// ${description}`, "# Week 1"];
  const progressed = new Set<string>();
  for (const day of days) {
    lines.push(`// Estimated ~${day.estMinutes} min`);
    lines.push(`## ${day.name}`);
    for (const ex of day.exercises) {
      const key = exerciseLabel(ex.entry);
      const withProgress = !progressed.has(key);
      progressed.add(key);
      if (ex.entry.cue) lines.push(`// ${ex.entry.cue}`);
      lines.push(exerciseLine(ex, intensity, withProgress));
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
