import type { CatalogEntry, Intensity, PlannedSetScheme } from "./types";

const WORK_SEC_PER_SET = 40;
const SETUP_SEC = 60;
const WARMUP_SEC = 180;

const SCHEMES: Record<Intensity, { compound: PlannedSetScheme; accessory: PlannedSetScheme; bodyweight: PlannedSetScheme }> = {
  light: {
    compound: { sets: 2, reps: 10, amrapLastSet: false, restSec: 90 },
    accessory: { sets: 2, reps: 12, amrapLastSet: false, restSec: 60 },
    bodyweight: { sets: 2, reps: 8, amrapLastSet: false, restSec: 60 },
  },
  moderate: {
    compound: { sets: 3, reps: 8, amrapLastSet: false, restSec: 120 },
    accessory: { sets: 3, reps: 10, amrapLastSet: false, restSec: 75 },
    bodyweight: { sets: 3, reps: 8, amrapLastSet: false, restSec: 75 },
  },
  hard: {
    compound: { sets: 4, reps: 5, amrapLastSet: true, restSec: 180 },
    accessory: { sets: 3, reps: 8, amrapLastSet: false, restSec: 90 },
    bodyweight: { sets: 4, reps: 8, amrapLastSet: true, restSec: 90 },
  },
};

/** Whether an exercise uses linear progression on a loaded bar (vs double progression / reps). */
export function usesBarProgression(entry: CatalogEntry): boolean {
  return entry.load === "barbell" && entry.compound;
}

export function schemeFor(entry: CatalogEntry, intensity: Intensity): PlannedSetScheme {
  const s = SCHEMES[intensity];
  if (entry.load === "bodyweight" || entry.load === "band") return s.bodyweight;
  return entry.compound ? s.compound : s.accessory;
}

export function hasDefaultWarmup(entry: CatalogEntry): boolean {
  return entry.compound && entry.load !== "bodyweight" && entry.load !== "band";
}

export function estimateMinutes(entry: CatalogEntry, scheme: PlannedSetScheme): number {
  const sec =
    SETUP_SEC + scheme.sets * WORK_SEC_PER_SET + (scheme.sets - 1) * scheme.restSec + (hasDefaultWarmup(entry) ? WARMUP_SEC : 0);
  return sec / 60;
}
