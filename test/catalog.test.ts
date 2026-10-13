import { describe, expect, it } from "vitest";
import exercises from "../src/core/data/liftosaur-exercises.json";
import { CATALOG } from "../src/core";

const byName = new Map((exercises as { name: string; equipment: string[] }[]).map((e) => [e.name.toLowerCase(), e]));

describe("catalog vs Liftosaur exercise list", () => {
  it.each(CATALOG.map((e) => [`${e.name}, ${e.equipment}`, e] as const))("%s exists", (_l, e) => {
    const ex = byName.get(e.name.toLowerCase());
    expect(ex, `unknown exercise ${e.name}`).toBeDefined();
    expect(ex!.equipment, `${e.name} does not support ${e.equipment}`).toContain(e.equipment);
  });
});
