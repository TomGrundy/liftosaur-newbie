import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GeneratedProgram } from "../core";

export const DEFAULT_DIR = "programs";

export function writeProgram(dir: string, p: GeneratedProgram): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${p.id}.json`);
  writeFileSync(file, JSON.stringify(p, null, 2) + "\n");
  return file;
}

export function readProgram(file: string): GeneratedProgram {
  const p = JSON.parse(readFileSync(file, "utf8")) as GeneratedProgram;
  if (typeof p.text !== "string") throw new Error(`${file}: missing "text" field`);
  return p;
}

const TEXT_EXT = [".json", ".txt", ".liftoscript"];

/** Expand files/dirs into program file paths (non-recursive for dirs). */
export function expandPaths(inputs: string[]): string[] {
  const out: string[] = [];
  for (const input of inputs) {
    if (!existsSync(input)) throw new Error(`Path not found: ${input}`);
    if (statSync(input).isDirectory()) {
      for (const f of readdirSync(input).sort()) {
        if (TEXT_EXT.includes(path.extname(f))) out.push(path.join(input, f));
      }
    } else out.push(input);
  }
  return out;
}

/** Load a program file as {name, text}; raw text files use the file name. */
export function loadAny(file: string): { name: string; text: string; program?: GeneratedProgram } {
  if (file.endsWith(".json")) {
    const program = readProgram(file);
    return { name: program.name, text: program.text, program };
  }
  return { name: path.basename(file, path.extname(file)), text: readFileSync(file, "utf8") };
}

export function listProgramFiles(dir: string): { file: string; program: GeneratedProgram }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: path.join(dir, f), program: readProgram(path.join(dir, f)) }));
}
