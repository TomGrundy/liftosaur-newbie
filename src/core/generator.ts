import { optionsFor } from "./catalog";
import { estimateMinutes, schemeFor } from "./rules";
import { exerciseLabel, serializeProgram } from "./serialize";
import type {
  CatalogEntry,
  Gear,
  GeneratedProgram,
  GenerateOptions,
  Pattern,
  PlannedDay,
  PlannedExercise,
} from "./types";
import { GEAR_LABELS } from "./types";

/** A slot in a day template: a movement pattern and which variant (0 = primary, 1 = secondary). */
type Slot = [Pattern, 0 | 1];

const FULL_A: Slot[] = [["squat", 0], ["horizontalPush", 0], ["horizontalPull", 0], ["core", 0], ["biceps", 0], ["sideDelts", 0], ["calves", 0]];
const FULL_B: Slot[] = [["hinge", 0], ["verticalPush", 0], ["verticalPull", 0], ["singleLeg", 0], ["triceps", 0], ["rearDelts", 0], ["core", 1]];
const FULL_C: Slot[] = [["squat", 0], ["horizontalPush", 1], ["horizontalPull", 1], ["glutes", 0], ["core", 1], ["biceps", 1], ["triceps", 1]];
const UPPER_A: Slot[] = [["horizontalPush", 0], ["horizontalPull", 0], ["verticalPush", 0], ["verticalPull", 0], ["biceps", 0], ["triceps", 0], ["sideDelts", 0]];
const UPPER_B: Slot[] = [["verticalPush", 1], ["verticalPull", 1], ["horizontalPush", 1], ["horizontalPull", 1], ["rearDelts", 0], ["biceps", 1], ["triceps", 1]];
const LOWER_A: Slot[] = [["squat", 0], ["hinge", 1], ["singleLeg", 0], ["calves", 0], ["core", 0]];
const LOWER_B: Slot[] = [["hinge", 0], ["squat", 1], ["glutes", 0], ["singleLeg", 1], ["core", 1]];
const FULL_MIX: Slot[] = [["singleLeg", 0], ["horizontalPush", 1], ["horizontalPull", 0], ["verticalPush", 0], ["glutes", 0], ["sideDelts", 0], ["core", 1]];

const SPLITS: Record<number, { name: string; days: [string, Slot[]][] }> = {
  2: { name: "Full Body", days: [["Full Body A", FULL_A], ["Full Body B", FULL_B]] },
  3: { name: "Full Body", days: [["Full Body A", FULL_A], ["Full Body B", FULL_B], ["Full Body C", FULL_C]] },
  4: { name: "Upper/Lower", days: [["Upper A", UPPER_A], ["Lower A", LOWER_A], ["Upper B", UPPER_B], ["Lower B", LOWER_B]] },
  5: {
    name: "Upper/Lower/Full",
    days: [["Upper A", UPPER_A], ["Lower A", LOWER_A], ["Full Body", FULL_MIX], ["Upper B", UPPER_B], ["Lower B", LOWER_B]],
  },
};

/** The first N slots of a day are always kept even if they overshoot the time budget. */
const MIN_SLOTS = 3;

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a primary and secondary option per pattern. Options are weighted toward lower priority
 * numbers; the seed shuffles among them so "generate more" yields different programs.
 */
function pickVariants(patterns: Pattern[], gear: GenerateOptions["gear"], random: () => number): Map<Pattern, CatalogEntry[]> {
  const result = new Map<Pattern, CatalogEntry[]>();
  for (const pattern of patterns) {
    const opts = optionsFor(pattern, gear);
    if (opts.length === 0) continue;
    const best = opts[0]!.priority;
    // Candidates: anything within 2 priority levels of the best available option.
    const pool = opts.filter((o) => o.priority <= best + 2);
    const weighted = pool.map((o) => ({ o, w: 1 / (1 + o.priority - best) + random() }));
    weighted.sort((a, b) => b.w - a.w);
    const ordered = weighted.map((x) => x.o);
    // Ensure the secondary is a different exercise name if one exists anywhere in opts.
    const primary = ordered[0]!;
    const secondary =
      ordered.find((o) => o.name !== primary.name) ?? opts.find((o) => o.name !== primary.name) ?? primary;
    result.set(pattern, [primary, secondary]);
  }
  return result;
}

export function planProgram(options: GenerateOptions): PlannedDay[] {
  const split = SPLITS[options.daysPerWeek];
  if (!split) throw new Error(`daysPerWeek must be 2-5, got ${options.daysPerWeek}`);
  const patterns = [...new Set(split.days.flatMap(([, slots]) => slots.map(([p]) => p)))];
  const variants = pickVariants(patterns, options.gear, rng(options.seed));

  return split.days.map(([dayName, slots]) => {
    const exercises: PlannedExercise[] = [];
    const usedKeys = new Set<string>();
    let total = 0;
    for (const [pattern, variant] of slots) {
      const pair = variants.get(pattern);
      if (!pair) continue;
      let entry = pair[variant]!;
      const key = (e: CatalogEntry) => `${e.name}|${e.equipment}`;
      if (usedKeys.has(key(entry))) entry = pair[variant === 0 ? 1 : 0]!;
      if (usedKeys.has(key(entry))) continue;
      const scheme = schemeFor(entry, options.intensity);
      const est = estimateMinutes(entry, scheme);
      if (exercises.length >= MIN_SLOTS && total + est > options.durationMin) continue;
      exercises.push({ entry, scheme, estMinutes: est });
      usedKeys.add(key(entry));
      total += est;
    }
    return { name: dayName, exercises, estMinutes: Math.round(total) };
  });
}

export function programName(o: GenerateOptions): string {
  const split = SPLITS[o.daysPerWeek]!.name;
  const intensity = o.intensity[0]!.toUpperCase() + o.intensity.slice(1);
  return `Newbie ${split} ${o.daysPerWeek}x · ${o.durationMin}min · ${intensity}`;
}

const GEAR_SHORT: Record<Gear, string> = {
  barbell: "bb",
  dumbbell: "db",
  kettlebell: "kb",
  ezbar: "ez",
  trapbar: "tb",
  dualPulley: "cable",
  latPulldown: "lat",
  band: "band",
  pullUpBar: "pu",
  machines: "mach",
};

export function programId(o: GenerateOptions): string {
  const gearKey = [...o.gear].sort().map((g) => GEAR_SHORT[g]).join("-") || "bw";
  return `${o.daysPerWeek}d-${o.intensity}-${o.durationMin}m-${gearKey}-s${o.seed >>> 0}`;
}

export function generateProgram(options: GenerateOptions, now = new Date()): GeneratedProgram {
  const gear = [...new Set(options.gear)].sort();
  const opts = { ...options, gear };
  const days = planProgram(opts);
  const name = opts.name ?? programName(opts);
  const gearText = gear.length ? gear.map((g) => GEAR_LABELS[g]).join(", ") : "Bodyweight only";
  const description = `${opts.daysPerWeek} days/week, ~${opts.durationMin} min sessions, ${opts.intensity} intensity. Equipment: ${gearText}.`;
  return {
    id: programId(opts),
    name,
    description,
    createdAt: now.toISOString(),
    options: opts,
    days: days.map((d) => ({
      name: d.name,
      estMinutes: d.estMinutes,
      exercises: d.exercises.map((e) => exerciseLabel(e.entry)),
    })),
    text: serializeProgram(days, opts.intensity, description),
  };
}
