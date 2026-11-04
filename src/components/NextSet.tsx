import { formatWeight } from "../lib/progression";

// "Próxima série": o que o motor pede agora (peso × reps × sobra, e o porquê) e a fila de séries do exercício.

export interface SetPlan {
  id: string;
  /** Número da série de trabalho (1, 2, 3…). */
  n: number;
  done: boolean;
  drop: boolean;
  weight: number | null;
  reps: number | null;
}

export function NextSet({ plans, unit, rir, reason }: { plans: SetPlan[]; unit: string; rir: string; reason: string }) {
  const next = plans.find((p) => !p.done);
  if (!next) return null;
  return (
    <div data-augmented-ui="tl-clip br-clip border" className="next-set scan" aria-live="polite">
      <div className="spread">
        <span className="label">Próxima série // S{next.n}</span>
        {next.drop && (
          <span data-augmented-ui="br-clip border" className="chip warn">
            −15%
          </span>
        )}
      </div>
      <div className="next-main">
        <b>{next.weight != null ? formatWeight(next.weight) : "–"}</b>
        <small>{unit}</small>
        <span className="x">×</span>
        <b>{next.reps ?? "–"}</b>
        <small>reps</small>
        <span className="next-rir">sobra {rir}</span>
      </div>
      <div className="small muted">{reason}</div>
      <div className="buffer" aria-label="Séries do exercício">
        {plans.map((p) => (
          <span key={p.id} className={`cell${p.done ? " done" : p.id === next.id ? " next" : ""}${p.drop ? " drop" : ""}`}>
            {p.done ? `${formatWeight(p.weight)}×${p.reps}` : p.id === next.id ? "▸" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
