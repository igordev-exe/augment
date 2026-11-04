import { Link } from "react-router-dom";
import type { Diagnostic } from "../lib/diagnostics";
import { ENGINE_RULES } from "../lib/engine";
import { whyLabel } from "./NudgeList";

// Aba "Motor" do laudo: o que as regras estão vendo agora, uma linha por área, com o porquê.

const TONE: Record<Diagnostic["tone"], string> = { warn: "warn", info: "", good: "ok" };

export function EngineLab({ items }: { items: Diagnostic[] }) {
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 4 }}>
      <h2 className="h-sec h-cut">Diagnóstico do motor</h2>
      {items.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          Registre alguns treinos para o motor ter o que ler.
        </p>
      ) : (
        <div className="diag-list">
          {items.map((d, i) => (
            <div key={i} className={`diag-row ${TONE[d.tone]}`}>
              <span className="diag-area">{d.area}</span>
              <div>
                <div className="diag-title">{d.title}</div>
                <div className="small">{d.text}</div>
                <div className="tiny faint">{whyLabel(d.why)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link to="/guia" className="tiny faint" style={{ marginTop: 6 }}>
        {ENGINE_RULES.length} regras ativas · ver todas no Guia → Motor
      </Link>
    </section>
  );
}
