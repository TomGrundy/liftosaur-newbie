import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Minimal .env loader (KEY=value, optional quotes, # comments). Existing env vars win. */
export function loadDotEnv(file = path.join(PROJECT_ROOT, ".env")): void {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trim().startsWith("#")) continue;
    let v = m[2]!;
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    if (process.env[m[1]!] === undefined) process.env[m[1]!] = v;
  }
}
