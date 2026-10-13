import { describe, expect, it } from "vitest";
import { DAYS_PER_WEEK, GEAR, INTENSITIES, generateProgram, validateProgramText, type Gear } from "../src/core";

const GEAR_SETS: Gear[][] = [[], ["dumbbell"], [...GEAR], ["band", "pullUpBar"], ["dualPulley", "latPulldown"]];
const DURATIONS = [30, 45, 60, 75, 90];

describe("generator matrix", () => {
  for (const gear of GEAR_SETS)
    for (const days of DAYS_PER_WEEK)
      for (const intensity of INTENSITIES)
        for (const durationMin of DURATIONS) {
          it(`${days}d ${intensity} ${durationMin}m [${gear.join(",") || "none"}]`, () => {
            const p = generateProgram({ gear, daysPerWeek: days, intensity, durationMin, seed: 7 });
            expect(p.days).toHaveLength(days);
            for (const d of p.days) expect(d.exercises.length, d.name).toBeGreaterThanOrEqual(3);
            expect(validateProgramText(p.text).filter((i) => i.severity !== "warning")).toEqual([]);
          });
        }
});

describe("determinism", () => {
  const opts = { gear: [...GEAR], daysPerWeek: 3, intensity: "moderate" as const, durationMin: 60 };
  const now = new Date("2026-01-01T00:00:00Z");
  it("same seed gives identical output", () => {
    expect(generateProgram({ ...opts, seed: 42 }, now)).toEqual(generateProgram({ ...opts, seed: 42 }, now));
  });
  it("different seeds mostly differ", () => {
    const texts = new Set(Array.from({ length: 20 }, (_, s) => generateProgram({ ...opts, seed: s }).text));
    expect(texts.size).toBeGreaterThanOrEqual(10);
  });
});
