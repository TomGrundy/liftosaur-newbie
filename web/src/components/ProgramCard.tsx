import { useId, useState } from "react";
import type { GeneratedProgram } from "../../../src/core/types";
import { CopyButton } from "./CopyButton";
import { Script } from "./Script";

function download(p: GeneratedProgram) {
  const url = URL.createObjectURL(new Blob([p.text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProgramCard({ program: p }: { program: GeneratedProgram }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { options: o } = p;
  return (
    <article className="card">
      <h3 className="card-title">{p.name}</h3>
      <p className="muted">{p.description}</p>
      <ul className="badges" aria-label="Program details">
        <li className="badge">{o.daysPerWeek} days/week</li>
        <li className="badge">~{o.durationMin} min</li>
        <li className="badge">{o.intensity}</li>
        {p.starter && <li className="badge badge-accent">Starter</li>}
        {p.upload && <li className="badge badge-ok">Uploaded</li>}
      </ul>
      <ul className="days">
        {p.days.map((d) => (
          <li key={d.name}>
            <div className="day-head">
              <strong>{d.name}</strong>
              <span className="muted">~{d.estMinutes} min</span>
            </div>
            <p className="exercises">{d.exercises.join(" · ")}</p>
          </li>
        ))}
      </ul>
      <div className="actions">
        <CopyButton text={p.text} />
        <button type="button" className="btn" onClick={() => download(p)}>
          Download .txt
        </button>
        <button type="button" className="btn btn-ghost" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          {open ? "Hide script" : "View script"}
        </button>
      </div>
      <div id={panelId} hidden={!open}>
        {open && <Script text={p.text} />}
      </div>
    </article>
  );
}
