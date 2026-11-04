import { Link } from "react-router-dom";
import { LEVEL_LABEL, PRINCIPLES } from "../data/science";
import type { Diagnostic } from "../lib/diagnostics";
import { ENGINE_RULES } from "../lib/engine";
import { whyLabel } from "./NudgeList";

// Aba "Motor" do laudo, no visual dos painéis holográficos: placar no topo e uma linha por área, com faixa de
// severidade, código da área e uma gaveta com a base científica do princípio por trás.

const TONE: Record<Diagnostic["tone"], { cls: string; tag: string }> = {
  warn: { cls: "warn", tag: "ALERTA" },
  info: { cls: "info", tag: "INFO" },
  good: { cls: "ok", tag: "OK" },
};
const ORDER: Record<Diagnostic["tone"], number> = { warn: 0, info: 1, good: 2 };
const BY_ID = Object.fromEntries(PRINCIPLES.map((p) => [p.id, p]));

export function EngineLab({ items }: { items: Diagnostic[] }) {
  const sorted = [...items].sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
  const count = (t: Diagnostic["tone"]) => items.filter((i) => i.tone === t).length;

  return (
    <section className="fm engine-scan" aria-label="Diagnóstico do motor">
      <div className="fm-panel eg-status">
        <div className="fm-heading">
          <div>
            <span>DIAGNÓSTICO DO MOTOR</span>
            <small>{ENGINE_RULES.length} REGRAS ATIVAS · LEITURA AGORA</small>
          </div>
        </div>
        <div className="eg-counts">
          <div className="warn">
            <strong>{count("warn")}</strong>
            <small>ALERTAS</small>
          </div>
          <div className="info">
            <strong>{count("info")}</strong>
            <small>INFO</small>
          </div>
          <div className="ok">
            <strong>{count("good")}</strong>
            <small>OK</small>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="fm-panel eg-empty">Registre alguns treinos para o motor ter o que ler.</div>
      ) : (
        sorted.map((d, i) => {
          const t = TONE[d.tone];
          const p = BY_ID[d.why];
          return (
            <div key={i} className={`fm-panel eg-row ${t.cls}`}>
              <div className="eg-top">
                <span className="eg-area">{d.area}</span>
                <span className={`eg-tag ${t.cls}`}>{t.tag}</span>
              </div>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
              {p && (
                <details className="eg-why">
                  <summary>Base científica · {LEVEL_LABEL[p.nivel]}</summary>
                  <p>{p.texto}</p>
                  <small>{whyLabel(d.why)}</small>
                </details>
              )}
            </div>
          );
        })
      )}

      <Link to="/guia" className="eg-link">
        Ver as {ENGINE_RULES.length} regras no Guia → Motor &gt;
      </Link>
    </section>
  );
}
