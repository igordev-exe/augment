import type { ReactNode } from "react";
import type { SuggestionKind } from "../lib/progression";
import { formatWeight, type OverloadOption } from "../lib/progression";

// Cartão único do exercício no treino: a decisão do motor (ex.: "MANTER 85 KG"), a próxima série em destaque
// (peso × reps × sobra) e a fila de séries. O resto (meta, observações, última vez, histórico) fica numa gaveta
// recolhível, com um selo dizendo quantas observações há lá dentro.

export interface SetPlan {
  id: string;
  /** Número da série de trabalho (1, 2, 3…). */
  n: number;
  done: boolean;
  drop: boolean;
  weight: number | null;
  reps: number | null;
}

const KIND: Record<SuggestionKind, { tag: string; cls: string }> = {
  up: { tag: "SOBE", cls: "up" },
  same: { tag: "MANTÉM", cls: "" },
  down: { tag: "BAIXA", cls: "down" },
  deload: { tag: "DELOAD", cls: "" },
  first: { tag: "1ª VEZ", cls: "" },
};

export function PlanCard({
  kind,
  title,
  plans,
  unit,
  basis,
  overload = [],
  onOverload,
  rir,
  reason,
  alerts,
  children,
}: {
  kind: SuggestionKind;
  title: string;
  plans: SetPlan[];
  unit: string;
  /** O que o peso significa: "cada halter", "total, com a barra"… */
  basis?: string;
  /** Formas de superar a última vez (+1 rep, +carga). Tocar aplica na próxima série. */
  overload?: OverloadOption[];
  onOverload?: (weight: number, reps: number) => void;
  rir: string;
  reason: string;
  /** Observações dentro da gaveta (aparecem no selo). */
  alerts: number;
  children: ReactNode;
}) {
  const next = plans.find((p) => !p.done);
  const k = KIND[kind];
  return (
    <div data-augmented-ui="tl-clip br-clip border" className={`plan-card scan ${k.cls}`}>
      <div className="plan-head">
        <span className={`plan-kind ${k.cls}`}>{k.tag}</span>
        <strong>{title}</strong>
      </div>

      {next ? (
        <div className="plan-next" aria-live="polite">
          <span className="label">
            Próxima série // S{next.n}
            {next.drop && <em className="plan-drop">−15%</em>}
          </span>
          <div className="next-main">
            <b>{next.weight != null ? formatWeight(next.weight) : "–"}</b>
            <small>{unit}</small>
            <span className="x">×</span>
            <b>{next.reps ?? "–"}</b>
            <small>reps</small>
            <span className="next-rir">sobra {rir}</span>
          </div>
          {basis && <span className="next-basis">{basis}</span>}
          {overload.length > 0 && (
            <div className="overload" role="group" aria-label="Superar a última vez">
              <span className="overload-label">Superar a última vez</span>
              {overload.map((o) => (
                <button key={o.via} type="button" className="overload-opt" onClick={() => onOverload?.(o.weight, o.reps)}>
                  <b>
                    {formatWeight(o.weight)} × {o.reps}
                  </b>
                  <small>{o.via === "reps" ? "+1 rep, mesma carga" : "+carga"}</small>
                </button>
              ))}
            </div>
          )}
          <span className="small muted">{reason}</span>
        </div>
      ) : (
        <span className="small plan-done">Todas as séries feitas.</span>
      )}

      <div className="buffer" aria-label="Séries do exercício">
        {plans.map((p) => (
          <span key={p.id} className={`cell${p.done ? " done" : next && p.id === next.id ? " next" : ""}${p.drop ? " drop" : ""}`}>
            <i>S{p.n}</i>
            {p.done ? `${formatWeight(p.weight)}×${p.reps}` : next && p.id === next.id ? "AGORA" : "·"}
          </span>
        ))}
      </div>

      <details className="plan-more">
        <summary>
          <span>Por que essa carga · histórico</span>
          {alerts > 0 && <em>{alerts} obs.</em>}
        </summary>
        <div className="plan-more-body">{children}</div>
      </details>
    </div>
  );
}
