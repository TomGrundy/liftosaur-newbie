import { describe, expect, it } from "vitest";
import { validateProgramText } from "../src/core";

const wrap = (line: string) => `# Week 1\n## Day 1\n${line}\n`;
const errs = (t: string) => validateProgramText(t).filter((i) => i.severity !== "warning");

describe("validateProgramText", () => {
  it("accepts a good program", () => {
    const t = wrap(
      "// note\nSquat, Barbell / 3x8 / 20kg / 120s / progress: lp(2.5kg, 1, 0, 10%, 3, 0)\nBench Press / 1x5, 1x5+ / @8\nPush Up, Bodyweight / 3x8 / warmup: none / progress: custom(maxReps: 15) {~\n  if (completedReps >= reps) {\n    reps += 1\n  }\n~}",
    );
    expect(validateProgramText(t)).toEqual([]);
  });
  it("catches unknown exercise", () => {
    expect(errs(wrap("Barbell Curl Deluxe / 3x8"))[0]?.message).toMatch(/Unknown exercise/);
  });
  it("catches bad equipment", () => {
    const e = errs(wrap("Squat, Band / 3x8"));
    expect(e).toHaveLength(1);
    expect(e[0]!.line).toBe(3);
  });
  it("catches a bad section", () => {
    expect(errs(wrap("Squat, Barbell / 3 sets of 8"))).toHaveLength(1);
    expect(errs(wrap("Squat, Barbell / 3x8 / progress: wobble(1)"))).toHaveLength(1);
  });
  it("catches an unclosed script block", () => {
    const e = errs(wrap("Squat, Barbell / 3x8 / progress: custom() {~\n reps += 1\n"));
    expect(e.some((i) => /Unclosed/.test(i.message))).toBe(true);
  });
  it("requires a day header and exercises after it", () => {
    expect(errs("# Week 1\n").length).toBeGreaterThan(0);
    expect(errs("# Week 1\nSquat / 3x8\n## Day 1\nDeadlift / 3x5").some((i) => i.line === 2)).toBe(true);
  });
  it("warns on mixed units and rejects dp with a rep range", () => {
    const t = wrap("Squat / 3x8 / 20kg\nBench Press / 3x8 / 45lb");
    expect(validateProgramText(t).some((i) => i.severity === "warning")).toBe(true);
    expect(errs(wrap("Squat / 3x8-12 / progress: dp(2.5kg, 8, 12)"))).toHaveLength(1);
  });
});
