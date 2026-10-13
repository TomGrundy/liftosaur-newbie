/** Equipment the user can own. These are *user-facing* gym items, not Liftosaur equipment ids. */
export const GEAR = [
  "barbell", // barbell + plates + rack + flat bench
  "dumbbell", // a set of dumbbells + flat/adjustable bench
  "kettlebell",
  "ezbar",
  "trapbar",
  "dualPulley", // dual adjustable cable pulley / functional trainer
  "latPulldown", // pull-down-from-above station (lat pulldown machine)
  "band", // resistance bands
  "pullUpBar",
  "machines", // commercial gym leverage/selectorized machines (leg press, leg curl...)
] as const;
export type Gear = (typeof GEAR)[number];

export const GEAR_LABELS: Record<Gear, string> = {
  barbell: "Barbell, rack & bench",
  dumbbell: "Dumbbells & bench",
  kettlebell: "Kettlebells",
  ezbar: "EZ bar",
  trapbar: "Trap bar",
  dualPulley: "Dual adjustable pulley (cable)",
  latPulldown: "Lat pulldown station",
  band: "Resistance bands",
  pullUpBar: "Pull-up bar",
  machines: "Gym machines (leg press, leg curl…)",
};

/** Liftosaur's built-in equipment ids (src/types.ts in astashov/liftosaur). */
export type LiftosaurEquipment =
  | "barbell"
  | "cable"
  | "dumbbell"
  | "smith"
  | "band"
  | "kettlebell"
  | "bodyweight"
  | "leverageMachine"
  | "medicineball"
  | "ezbar"
  | "trapbar";

/** How each Liftosaur equipment id is written after the comma in program text. */
export const EQUIPMENT_TEXT: Record<LiftosaurEquipment, string> = {
  barbell: "Barbell",
  cable: "Cable",
  dumbbell: "Dumbbell",
  smith: "Smith Machine",
  band: "Band",
  kettlebell: "Kettlebell",
  bodyweight: "Bodyweight",
  leverageMachine: "Leverage Machine",
  medicineball: "Medicine Ball",
  ezbar: "EZ Bar",
  trapbar: "Trap Bar",
};

export const INTENSITIES = ["light", "moderate", "hard"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const DURATIONS = [30, 45, 60, 75, 90] as const;
export const DAYS_PER_WEEK = [2, 3, 4, 5] as const;

export type Pattern =
  | "squat"
  | "hinge"
  | "horizontalPush"
  | "verticalPush"
  | "horizontalPull"
  | "verticalPull"
  | "singleLeg"
  | "glutes"
  | "core"
  | "biceps"
  | "triceps"
  | "sideDelts"
  | "rearDelts"
  | "calves";

/** How a movement is loaded, which decides weights, progression and warmups. */
export type LoadKind = "barbell" | "dumbbell" | "kettlebell" | "cable" | "machine" | "bodyweight" | "band";

export interface CatalogEntry {
  /** Exact Liftosaur exercise name (must exist in the built-in list). */
  name: string;
  /** Liftosaur equipment id. Omitted from program text when it's the exercise's default. */
  equipment: LiftosaurEquipment;
  pattern: Pattern;
  load: LoadKind;
  /** All of these must be owned. Empty = bodyweight only. */
  requires: Gear[];
  /** Big multi-joint lift (gets lower reps, longer rest, default warmups). */
  compound: boolean;
  /** Beginner starting load in kg. */
  startKg: number;
  /** Load jump in kg for progression. */
  incrementKg: number;
  /** Lower = preferred when several options are available. */
  priority: number;
  /** Short coaching cue shown on the site and as a Liftosaur exercise description. */
  cue?: string;
}

export interface GenerateOptions {
  gear: Gear[];
  intensity: Intensity;
  /** Target session length in minutes. */
  durationMin: number;
  daysPerWeek: number;
  /** Seed for exercise variation. Same options + seed = same program. */
  seed: number;
  name?: string;
}

export interface PlannedSetScheme {
  sets: number;
  reps: number;
  amrapLastSet: boolean;
  restSec: number;
}

export interface PlannedExercise {
  entry: CatalogEntry;
  scheme: PlannedSetScheme;
  estMinutes: number;
}

export interface PlannedDay {
  name: string;
  exercises: PlannedExercise[];
  estMinutes: number;
}

export interface GeneratedProgram {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  options: GenerateOptions;
  days: { name: string; estMinutes: number; exercises: string[] }[];
  /** Liftoscript program text, ready to paste or POST to the API. */
  text: string;
  upload?: { programId: string; uploadedAt: string };
  /** Set for curated starter programs shipped with the site. */
  starter?: boolean;
}
