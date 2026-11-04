import { useState } from "react";
import type { Attribute, AttributeId } from "../lib/attributes";
import { whyLabel } from "./NudgeList";

// Atributos do operador no estilo "árvore de atributos": cinco nós em losango ligados ao índice central por trilhas.
// Toque num nó para abrir o painel: o número por trás, o que faz subir e o princípio científico.

/** Posição de cada nó no palco (em %): topo, meio esquerda/direita, base esquerda/direita. */
const POS: Record<AttributeId, { x: number; y: number }> = {
  forca: { x: 50, y: 13 },
  volume: { x: 17, y: 41 },
  consistencia: { x: 83, y: 41 },
  recuperacao: { x: 25, y: 85 },
  composicao: { x: 75, y: 85 },
};
const CENTER = { x: 50, y: 55 };

export function AttributeTree({ list, index }: { list: Attribute[]; index: number | null }) {
  const [picked, setPicked] = useState<AttributeId>("forca");
  const sel = list.find((a) => a.id === picked) ?? list[0];

  return (
    <section className="fm attrs" aria-label="Atributos do operador">
      <div className="fm-intro">
        <div>
          <div className="fm-eyebrow">
            <span>00</span> OPERADOR / ATRIBUTOS
          </div>
          <h2>
            ATRIBUTOS DO <em>OPERADOR</em>
          </h2>
          <p>Cinco números dos seus registros. Nível = valor ÷ 5, de 0 a 20.</p>
        </div>
      </div>

      <div className="fm-panel attr-stage">
        <svg className="attr-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {list.map((a) => (
            <path
              key={a.id}
              className={a.id === picked ? "on" : undefined}
              d={`M${CENTER.x} ${CENTER.y} L${POS[a.id].x} ${CENTER.y + (POS[a.id].y - CENTER.y) / 2} L${POS[a.id].x} ${POS[a.id].y}`}
            />
          ))}
        </svg>

        <div
          className="attr-core"
          style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%` }}
          aria-label={`Índice ${index ?? "sem dados"} de 20`}
        >
          <strong>{index ?? "–"}</strong>
          <small>ÍNDICE</small>
        </div>

        {list.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`attr-node${a.id === picked ? " on" : ""}${a.level == null ? " no-data" : ""}`}
            style={{ left: `${POS[a.id].x}%`, top: `${POS[a.id].y}%` }}
            aria-pressed={a.id === picked}
            onClick={() => setPicked(a.id)}
          >
            <span className="attr-name">{a.name}</span>
            <span className="attr-val">
              <b>{a.level ?? "–"}</b>
              <small>/20</small>
            </span>
          </button>
        ))}
      </div>

      <div className="fm-panel attr-detail" aria-live="polite">
        <div className="fm-heading">
          <div>
            <span>{sel.name.toUpperCase()}</span>
            <small>{sel.value == null ? "SEM DADOS AINDA" : `LVL ${sel.level} / 20 · VALOR ${sel.value}`}</small>
          </div>
          <b>{sel.level ?? "–"}</b>
        </div>
        <div className="attr-detail-body">
          <i className="attr-bar" aria-hidden="true">
            <u style={{ width: `${sel.value ?? 0}%` }} />
          </i>
          <p>{sel.summary}</p>
          <p>
            <span className="dim">COMO SOBE // </span>
            {sel.how}
          </p>
          <small className="dim">{whyLabel(sel.why)}</small>
        </div>
      </div>
    </section>
  );
}
