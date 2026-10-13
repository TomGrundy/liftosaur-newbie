import { DAYS_PER_WEEK, DURATIONS, GEAR, GEAR_LABELS, INTENSITIES } from "../../../src/core/types";
import type { Gear, GeneratedProgram, Intensity } from "../../../src/core/types";

export interface FilterState {
  days: number | "any";
  intensity: Intensity | "any";
  maxMinutes: number | "any";
  gear: Gear[];
}

export const DEFAULT_FILTERS: FilterState = { days: "any", intensity: "any", maxMinutes: "any", gear: [] };

const KEY = "liftosaur-newbie:filters:v1";

export function loadFilters(): FilterState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_FILTERS;
    const v = JSON.parse(raw) as Partial<FilterState>;
    return {
      days: v.days === "any" || (typeof v.days === "number" && (DAYS_PER_WEEK as readonly number[]).includes(v.days)) ? v.days : "any",
      intensity: v.intensity === "any" || (INTENSITIES as readonly string[]).includes(v.intensity as string) ? (v.intensity as FilterState["intensity"]) : "any",
      maxMinutes: v.maxMinutes === "any" || typeof v.maxMinutes === "number" ? v.maxMinutes : "any",
      gear: Array.isArray(v.gear) ? v.gear.filter((g): g is Gear => (GEAR as readonly string[]).includes(g)) : [],
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(f: FilterState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* storage unavailable */
  }
}

export function matches(p: GeneratedProgram, f: FilterState): boolean {
  if (f.days !== "any" && p.options.daysPerWeek !== f.days) return false;
  if (f.intensity !== "any" && p.options.intensity !== f.intensity) return false;
  if (f.maxMinutes !== "any" && p.options.durationMin > f.maxMinutes) return false;
  return p.options.gear.every((g) => f.gear.includes(g));
}

const num = (v: string): number | "any" => (v === "any" ? "any" : Number(v));

export function Filters({ value, onChange }: { value: FilterState; onChange: (f: FilterState) => void }) {
  const toggle = (g: Gear) =>
    onChange({ ...value, gear: value.gear.includes(g) ? value.gear.filter((x) => x !== g) : [...value.gear, g] });
  return (
    <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label="Filter programs">
      <div className="filter-row">
        <label>
          Days per week
          <select value={String(value.days)} onChange={(e) => onChange({ ...value, days: num(e.target.value) })}>
            <option value="any">Any</option>
            {DAYS_PER_WEEK.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Intensity
          <select value={value.intensity} onChange={(e) => onChange({ ...value, intensity: e.target.value as FilterState["intensity"] })}>
            <option value="any">Any</option>
            {INTENSITIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </label>
        <label>
          Max session length
          <select value={String(value.maxMinutes)} onChange={(e) => onChange({ ...value, maxMinutes: num(e.target.value) })}>
            <option value="any">Any</option>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>I have…</legend>
        <div className="gear">
          {GEAR.map((g) => (
            <label key={g} className="check">
              <input type="checkbox" checked={value.gear.includes(g)} onChange={() => toggle(g)} />
              {GEAR_LABELS[g]}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" className="btn btn-ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
        Reset filters
      </button>
    </form>
  );
}
