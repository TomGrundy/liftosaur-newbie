import type { GeneratedProgram } from "../../src/core/types";

const modules = import.meta.glob("../../programs/*.json", { eager: true, import: "default" }) as Record<
  string,
  GeneratedProgram
>;

/** Generated programs first (newest first), then starters (newest first). */
export function loadPrograms(): GeneratedProgram[] {
  return Object.values(modules).sort((a, b) => {
    if (!!a.starter !== !!b.starter) return a.starter ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name);
  });
}

export const programs = loadPrograms();
