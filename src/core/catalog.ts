import type { CatalogEntry, Gear, LiftosaurEquipment, LoadKind, Pattern } from "./types";

/**
 * Curated beginner-friendly exercises. Every `name` + `equipment` pair must exist in
 * Liftosaur's built-in exercise list (src/core/data/liftosaur-exercises.json) — enforced by tests.
 */
type Row = [
  name: string,
  equipment: LiftosaurEquipment,
  pattern: Pattern,
  load: LoadKind,
  requires: Gear[],
  compound: boolean,
  startKg: number,
  incrementKg: number,
  priority: number,
  cue?: string,
];

const ROWS: Row[] = [
  // Squat
  ["Squat", "barbell", "squat", "barbell", ["barbell"], true, 20, 2.5, 1, "Brace, sit between your hips, knees track over toes."],
  ["Goblet Squat", "dumbbell", "squat", "dumbbell", ["dumbbell"], true, 12, 2, 2, "Hold the dumbbell at your chest, elbows inside knees."],
  ["Goblet Squat", "kettlebell", "squat", "kettlebell", ["kettlebell"], true, 12, 4, 2, "Hold the bell by the horns at your chest."],
  ["Leg Press", "leverageMachine", "squat", "machine", ["machines"], true, 40, 5, 3, "Lower until hips start to tuck, then press."],
  ["Squat", "bodyweight", "squat", "bodyweight", [], true, 0, 0, 9, "Arms forward for balance, full depth you can control."],

  // Hinge
  ["Deadlift", "barbell", "hinge", "barbell", ["barbell"], true, 40, 5, 1, "Bar over mid-foot, flat back, push the floor away."],
  ["Trap Bar Deadlift", "trapbar", "hinge", "barbell", ["trapbar"], true, 40, 5, 1, "Stand in the centre, chest up, drive through the floor."],
  ["Romanian Deadlift", "barbell", "hinge", "barbell", ["barbell"], true, 30, 2.5, 2, "Soft knees, push hips back until hamstrings stretch."],
  ["Romanian Deadlift", "dumbbell", "hinge", "dumbbell", ["dumbbell"], true, 10, 2, 2, "Soft knees, slide dumbbells down your thighs, hips back."],
  ["Kettlebell Swing", "kettlebell", "hinge", "kettlebell", ["kettlebell"], true, 12, 4, 3, "Hike the bell back, snap the hips — it's a hinge, not a squat."],
  ["Cable Pull Through", "cable", "hinge", "cable", ["dualPulley"], true, 15, 2.5, 3, "Low pulley with rope, face away, hinge and squeeze glutes."],
  ["Single Leg Deadlift", "bodyweight", "hinge", "bodyweight", [], true, 0, 0, 8, "Reach back with the free leg, keep hips square."],

  // Horizontal push
  ["Bench Press", "barbell", "horizontalPush", "barbell", ["barbell"], true, 20, 2.5, 1, "Shoulder blades pinched, bar to lower chest, feet planted."],
  ["Bench Press", "dumbbell", "horizontalPush", "dumbbell", ["dumbbell"], true, 10, 2, 1, "Lower with control until elbows are just below the bench."],
  ["Incline Bench Press", "dumbbell", "horizontalPush", "dumbbell", ["dumbbell"], true, 8, 2, 2, "Bench at ~30°, press up and slightly back."],
  ["Bench Press", "cable", "horizontalPush", "cable", ["dualPulley"], true, 10, 2.5, 3, "Pulleys at chest height, step forward, press handles together."],
  ["Chest Press", "leverageMachine", "horizontalPush", "machine", ["machines"], true, 20, 5, 3, "Handles at mid-chest, press without locking out hard."],
  ["Bench Press", "band", "horizontalPush", "band", ["band"], true, 0, 0, 5, "Band behind your back, press forward like a push up."],
  ["Push Up", "bodyweight", "horizontalPush", "bodyweight", [], true, 0, 0, 6, "Body in one straight line, chest to just above the floor."],

  // Vertical push
  ["Overhead Press", "barbell", "verticalPush", "barbell", ["barbell"], true, 20, 2.5, 1, "Squeeze glutes, press the bar up and move your head through."],
  ["Shoulder Press", "dumbbell", "verticalPush", "dumbbell", ["dumbbell"], true, 8, 2, 1, "Seated or standing, press up without arching your back."],
  ["Overhead Press", "ezbar", "verticalPush", "barbell", ["ezbar"], true, 15, 2.5, 2, "Ribs down, press the bar straight overhead."],
  ["Arnold Press", "dumbbell", "verticalPush", "dumbbell", ["dumbbell"], true, 6, 2, 3, "Start palms facing you, rotate as you press."],
  ["Shoulder Press", "cable", "verticalPush", "cable", ["dualPulley"], true, 7.5, 2.5, 3, "Low pulleys, sit or kneel between them, press overhead."],
  ["Shoulder Press", "leverageMachine", "verticalPush", "machine", ["machines"], true, 15, 5, 3, "Seat so handles start at shoulder height."],
  ["Shoulder Press", "band", "verticalPush", "band", ["band"], true, 0, 0, 5, "Stand on the band, press handles overhead."],
  ["Pike Push Up", "bodyweight", "verticalPush", "bodyweight", [], true, 0, 0, 6, "Hips high, lower your head toward the floor between your hands."],

  // Horizontal pull
  ["Bent Over Row", "barbell", "horizontalPull", "barbell", ["barbell"], true, 20, 2.5, 1, "Hinge to ~45°, pull the bar to your belly button."],
  ["Bent Over One Arm Row", "dumbbell", "horizontalPull", "dumbbell", ["dumbbell"], true, 12, 2, 1, "Hand on the bench, pull the dumbbell to your hip."],
  ["Seated Row", "cable", "horizontalPull", "cable", ["dualPulley"], true, 20, 2.5, 1, "Low pulley, sit tall, pull handles to your ribs."],
  ["Chest-Supported Row", "dumbbell", "horizontalPull", "dumbbell", ["dumbbell"], true, 10, 2, 2, "Chest on an incline bench, row elbows back."],
  ["Seated Row", "leverageMachine", "horizontalPull", "machine", ["machines"], true, 20, 5, 3, "Chest on the pad, squeeze shoulder blades together."],
  ["Inverted Row", "bodyweight", "horizontalPull", "bodyweight", ["barbell"], true, 0, 0, 4, "Bar set low in the rack, body straight, pull chest to bar."],
  ["Bent Over Row", "band", "horizontalPull", "band", ["band"], true, 0, 0, 5, "Stand on the band, hinge and row to your hips."],

  // Vertical pull
  ["Lat Pulldown", "cable", "verticalPull", "cable", ["latPulldown"], true, 25, 2.5, 1, "Thighs under the pad, pull the bar to your upper chest."],
  ["Lat Pulldown", "cable", "verticalPull", "cable", ["dualPulley"], true, 15, 2.5, 3, "Pulleys high, kneel and pull handles down to your shoulders."],
  ["Chin Up", "bodyweight", "verticalPull", "bodyweight", ["pullUpBar"], true, 0, 0, 2, "Palms facing you, pull chin over the bar. Do negatives if needed."],
  ["Kneeling Pulldown", "band", "verticalPull", "band", ["band"], true, 0, 0, 4, "Anchor the band high, kneel and pull elbows to your sides."],

  // Single leg
  ["Reverse Lunge", "dumbbell", "singleLeg", "dumbbell", ["dumbbell"], false, 6, 2, 1, "Step back, front shin vertical, push through the front heel."],
  ["Split Squat", "dumbbell", "singleLeg", "dumbbell", ["dumbbell"], false, 6, 2, 2, "Feet staggered, drop the back knee straight down."],
  ["Bulgarian Split Squat", "dumbbell", "singleLeg", "dumbbell", ["dumbbell"], false, 6, 2, 3, "Back foot on the bench, stay tall."],
  ["Reverse Lunge", "cable", "singleLeg", "cable", ["dualPulley"], false, 10, 2.5, 3, "Hold handles from the low pulleys, step back."],
  ["Lunge", "barbell", "singleLeg", "barbell", ["barbell"], false, 20, 2.5, 4, "Bar on your back, controlled step forward."],
  ["Reverse Lunge", "bodyweight", "singleLeg", "bodyweight", [], false, 0, 0, 5, "Step back, lightly tap the back knee down."],

  // Glutes
  ["Hip Thrust", "barbell", "glutes", "barbell", ["barbell"], false, 30, 2.5, 1, "Upper back on the bench, chin tucked, squeeze at the top."],
  ["Glute Bridge", "dumbbell", "glutes", "dumbbell", ["dumbbell"], false, 12, 2, 2, "Dumbbell on hips, drive up through heels."],
  ["Glute Kickback", "cable", "glutes", "cable", ["dualPulley"], false, 5, 2.5, 2, "Ankle strap on the low pulley, kick back without arching."],
  ["Glute Bridge", "band", "glutes", "band", ["band"], false, 0, 0, 4, "Band above knees, push knees out as you bridge."],
  ["Hip Thrust", "bodyweight", "glutes", "bodyweight", [], false, 0, 0, 5, "Shoulders on a couch or bench, squeeze at the top."],

  // Core
  ["Dead Bug", "bodyweight", "core", "bodyweight", [], false, 0, 0, 1, "Low back pressed into the floor, extend opposite arm and leg."],
  ["Cable Crunch", "cable", "core", "cable", ["latPulldown"], false, 15, 2.5, 2, "Kneel with the rope, crunch ribs toward hips."],
  ["Cable Crunch", "cable", "core", "cable", ["dualPulley"], false, 15, 2.5, 2, "Pulley high, kneel with the rope, crunch ribs toward hips."],
  ["Pallof Press", "band", "core", "band", ["band"], false, 0, 0, 2, "Band anchored at your side, press out and resist the twist."],
  ["Hanging Knee Raise", "bodyweight", "core", "bodyweight", ["pullUpBar"], false, 0, 0, 2, "Hang still, bring knees up without swinging."],
  ["Crunch", "bodyweight", "core", "bodyweight", [], false, 0, 0, 3, "Curl ribs toward hips, don't pull on your neck."],

  // Biceps
  ["Bicep Curl", "dumbbell", "biceps", "dumbbell", ["dumbbell"], false, 6, 2, 1, "Elbows pinned to your sides, no swinging."],
  ["Bicep Curl", "cable", "biceps", "cable", ["dualPulley"], false, 7.5, 2.5, 1, "Low pulley, elbows still, squeeze at the top."],
  ["Bicep Curl", "ezbar", "biceps", "barbell", ["ezbar"], false, 15, 2.5, 1, "Grip the angled part, elbows stay put."],
  ["Hammer Curl", "dumbbell", "biceps", "dumbbell", ["dumbbell"], false, 6, 2, 2, "Palms facing each other the whole time."],
  ["Bicep Curl", "barbell", "biceps", "barbell", ["barbell"], false, 15, 2.5, 3, "Shoulder-width grip, elbows by your sides."],
  ["Bicep Curl", "band", "biceps", "band", ["band"], false, 0, 0, 4, "Stand on the band, curl without leaning back."],

  // Triceps
  ["Triceps Pushdown", "cable", "triceps", "cable", ["latPulldown"], false, 15, 2.5, 1, "Elbows pinned, push the bar/rope down to full lockout."],
  ["Triceps Pushdown", "cable", "triceps", "cable", ["dualPulley"], false, 12.5, 2.5, 1, "Pulley high, elbows pinned, push down to lockout."],
  ["Triceps Extension", "dumbbell", "triceps", "dumbbell", ["dumbbell"], false, 6, 2, 2, "One dumbbell overhead with both hands, lower behind your head."],
  ["Skullcrusher", "ezbar", "triceps", "barbell", ["ezbar"], false, 15, 2.5, 2, "Lower the bar toward your forehead, elbows pointing up."],
  ["Triceps Extension", "band", "triceps", "band", ["band"], false, 0, 0, 4, "Band anchored high or under foot, extend fully."],
  ["Bench Dip", "bodyweight", "triceps", "bodyweight", ["dumbbell"], false, 0, 0, 5, "Hands on the bench edge, lower until elbows reach 90°."],
  ["Bench Dip", "bodyweight", "triceps", "bodyweight", ["barbell"], false, 0, 0, 5, "Hands on the bench edge, lower until elbows reach 90°."],
  ["Diamond Push Up", "bodyweight", "triceps", "bodyweight", [], false, 0, 0, 6, "Hands together under your chest, elbows close."],

  // Side delts
  ["Lateral Raise", "dumbbell", "sideDelts", "dumbbell", ["dumbbell"], false, 4, 2, 1, "Lead with the elbows, raise to shoulder height."],
  ["Lateral Raise", "cable", "sideDelts", "cable", ["dualPulley"], false, 5, 2.5, 1, "Low pulley across your body, raise out to the side."],
  ["Lateral Raise", "band", "sideDelts", "band", ["band"], false, 0, 0, 3, "Stand on the band, raise out to the side."],
  ["Lateral Raise", "kettlebell", "sideDelts", "kettlebell", ["kettlebell"], false, 4, 4, 4, "Light bell, raise to shoulder height."],

  // Rear delts
  ["Face Pull", "band", "rearDelts", "band", ["band"], false, 0, 0, 1, "Anchor at face height, pull toward your forehead, thumbs back."],
  ["Standing Row Rear Delt With Rope", "cable", "rearDelts", "cable", ["dualPulley"], false, 7.5, 2.5, 1, "Rope at face height, pull to your forehead, elbows high."],
  ["Reverse Fly", "dumbbell", "rearDelts", "dumbbell", ["dumbbell"], false, 4, 2, 2, "Hinge forward, raise arms out wide with soft elbows."],
  ["Reverse Fly", "band", "rearDelts", "band", ["band"], false, 0, 0, 3, "Arms straight in front, pull the band apart."],

  // Calves
  ["Standing Calf Raise", "leverageMachine", "calves", "machine", ["machines"], false, 30, 5, 1, "Full stretch at the bottom, pause at the top."],
  ["Standing Calf Raise", "dumbbell", "calves", "dumbbell", ["dumbbell"], false, 10, 2, 1, "On a step if you can, pause at the top."],
  ["Standing Calf Raise", "bodyweight", "calves", "bodyweight", [], false, 0, 0, 2, "On a step if you can, slow on the way down."],
];

export const CATALOG: CatalogEntry[] = ROWS.map(
  ([name, equipment, pattern, load, requires, compound, startKg, incrementKg, priority, cue]) => ({
    name,
    equipment,
    pattern,
    load,
    requires,
    compound,
    startKg,
    incrementKg,
    priority,
    cue,
  }),
);

export function available(entry: CatalogEntry, gear: readonly Gear[]): boolean {
  return entry.requires.every((g) => gear.includes(g));
}

export function optionsFor(pattern: Pattern, gear: readonly Gear[]): CatalogEntry[] {
  return CATALOG.filter((e) => e.pattern === pattern && available(e, gear)).sort((a, b) => a.priority - b.priority);
}
