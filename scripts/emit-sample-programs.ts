/**
 * Dev-only: writes a matrix of generated programs as JSON files ({ id, input, text }) into a directory.
 * Usage: tsx scripts/emit-sample-programs.ts <outDir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GEAR, generateProgram } from "../src/core/index";
import type { Gear, Intensity } from "../src/core/index";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: tsx scripts/emit-sample-programs.ts <outDir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const gearSets: Array<[string, Gear[]]> = [
  ["all", [...GEAR]],
  ["bodyweight", []],
  ["dumbbell", ["dumbbell"]],
  ["band-pullup", ["band", "pullUpBar"]],
  ["cable-lat", ["dualPulley", "latPulldown"]],
  ["barbell", ["barbell"]],
  ["kettlebell", ["kettlebell"]],
  ["machines-ez-trap", ["machines", "ezbar", "trapbar"]],
];
const intensities: Intensity[] = ["light", "moderate", "hard"];
let count = 0;
for (const [gearName, gear] of gearSets) {
  for (const daysPerWeek of [2, 3, 4, 5]) {
    for (const intensity of intensities) {
      for (const durationMin of [30, 60, 90]) {
        for (const seed of [1, 2]) {
          const input = { gear, intensity, durationMin, daysPerWeek, seed };
          const program = generateProgram(input as Parameters<typeof generateProgram>[0]);
          const id = `${gearName}-d${daysPerWeek}-${intensity}-${durationMin}m-s${seed}`;
          writeFileSync(join(outDir, `${id}.json`), JSON.stringify({ id, input, text: program.text }, null, 2));
          count++;
        }
      }
    }
  }
}
console.log(`Wrote ${count} programs to ${outDir}`);
