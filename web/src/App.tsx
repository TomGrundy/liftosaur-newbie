import { useEffect, useMemo, useState } from "react";
import { programs } from "./programs";
import { DEFAULT_FILTERS, Filters, loadFilters, matches, saveFilters } from "./components/Filters";
import type { FilterState } from "./components/Filters";
import { ProgramCard } from "./components/ProgramCard";
import { GenerateMore, HowToAdd } from "./components/Guides";

export function App() {
  const [filters, setFilters] = useState<FilterState>(() => loadFilters());
  useEffect(() => saveFilters(filters), [filters]);
  const shown = useMemo(() => programs.filter((p) => matches(p, filters)), [filters]);

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <h1>Liftosaur Newbie</h1>
          <p>Beginner-friendly strength programs, ready to copy and paste into the Liftosaur app.</p>
        </div>
      </header>
      <main className="wrap">
        <section aria-labelledby="programs-heading">
          <h2 id="programs-heading">Programs</h2>
          <Filters value={filters} onChange={setFilters} />
          <p className="muted" role="status">
            Showing {shown.length} of {programs.length} programs
            {filters.gear.length === 0 && filters.days === DEFAULT_FILTERS.days ? " (tick the equipment you have to see what fits)" : ""}
          </p>
          <div className="grid">
            {shown.map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </div>
          {shown.length === 0 && <p className="empty">No programs match. Try ticking more equipment or relaxing the filters.</p>}
        </section>
        <HowToAdd />
        <GenerateMore />
      </main>
      <footer className="wrap muted site-footer">
        Unofficial. Not affiliated with Liftosaur. Check weights and form, and stop if something hurts.
      </footer>
    </>
  );
}
