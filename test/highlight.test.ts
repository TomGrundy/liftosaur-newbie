import { describe, expect, it } from "vitest";
import { highlight } from "../web/src/highlight";

const sample = `// note
# Week 1
## Day A
Squat, Barbell / 3x8 / 20kg / 90s / progress: lp(2.5kg) {~
  reps += 1
~}
Curl / 3x10 / 6kg / warmup: none`;

describe("highlight", () => {
  const toks = highlight(sample);
  it("round-trips text", () => expect(toks.map((t) => t.text).join("")).toBe(sample));
  it("classifies tokens", () => {
    const has = (type: string, text: string) => toks.some((t) => t.type === type && t.text.includes(text));
    expect(has("comment", "// note")).toBe(true);
    expect(has("header", "# Week 1")).toBe(true);
    expect(has("exercise", "Squat, Barbell")).toBe(true);
    expect(has("weight", "20kg")).toBe(true);
    expect(has("timer", "90s")).toBe(true);
    expect(has("keyword", "progress:")).toBe(true);
    expect(has("script", "reps += 1")).toBe(true);
    expect(has("keyword", "warmup:")).toBe(true);
  });
});
