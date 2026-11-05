import { useId, useState, type CSSProperties, type ReactNode } from "react";
import type { Attribute, AttributeId } from "../lib/attributes";
import { whyLabel } from "./NudgeList";

// Roda de atributos do operador (design "Atributos Cyberpunk do Operador"): seis nós chanfrados em volta de um
// núcleo em losango, ligados por barramentos de circuito. Toque num nó para abrir o painel com o número por trás,
// o que faz subir e o princípio científico.

type Frame = { w: number; h: number };

/** Quadro da roda (828 × 800) e nós de 278 × 180, nas mesmas proporções da referência. */
const WHEEL: Frame = { w: 828, h: 800 };
const SLOTS: { x: number; y: number; bus: string }[] = [
  { x: 414, y: 96, bus: "M414 252 V180" },
  { x: 181, y: 206, bus: "M300 400 L230 330 V286" },
  { x: 647, y: 206, bus: "M528 400 L598 330 V286" },
  { x: 181, y: 588, bus: "M300 400 L230 470 V508" },
  { x: 647, y: 588, bus: "M528 400 L598 470 V508" },
  { x: 414, y: 700, bus: "M414 548 V616" },
];
const DECOR = ["M130 288 V506", "M698 288 V506", "M384 180 V222", "M444 180 V222", "M384 616 V578", "M444 616 V578"];
const ORDER: AttributeId[] = ["forca", "volume", "consistencia", "recuperacao", "intensidade", "composicao"];
const CODE: Record<AttributeId, string> = {
  forca: "STR",
  volume: "VOL",
  consistencia: "CNS",
  recuperacao: "RCV",
  intensidade: "INT",
  composicao: "CMP",
};

const pct = (n: number, total: number) => `${(n / total) * 100}%`;

/** Glifos próprios (traço 1,8, grade 24), um por atributo. */
function Glyph({ id }: { id: AttributeId }) {
  const paths: Record<AttributeId, ReactNode> = {
    forca: <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
    volume: (
      <>
        <path d="M12 3 21 8l-9 5-9-5 9-5Z" />
        <path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" />
      </>
    ),
    consistencia: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="1" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4M8.5 14.5l2.5 2.5 4.5-4.5" />
      </>
    ),
    recuperacao: (
      <>
        <rect x="2.5" y="7" width="16" height="10" rx="1" />
        <path d="M21.5 10.5v3M11 8.5 8.5 12h4L10 15.5" />
      </>
    ),
    intensidade: (
      <>
        <path d="M4.5 17.5a8 8 0 1 1 15 0" />
        <path d="m12 13 4-5M12 13.5v.01" />
      </>
    ),
    composicao: (
      <>
        <path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a2.8 2.8 0 0 0 5 0L5 8ZM19 8l-2.5 6a2.8 2.8 0 0 0 5 0L19 8Z" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[id]}
    </svg>
  );
}

/** Barramento de circuito com cinco linhas paralelas, desenhado com máscara. */
function Bus({ d, width, className }: { d: string; width: number; className: string }) {
  const id = `bus${useId().replace(/:/g, "")}`;
  const layers: [string, number][] = [
    ["#fff", 1],
    ["#000", 0.76],
    ["#fff", 0.54],
    ["#000", 0.32],
    ["#fff", 0.11],
  ];
  return (
    <g className={`aw-bus ${className}`}>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={WHEEL.w} height={WHEEL.h}>
        {layers.map(([color, scale], i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={width * scale} strokeLinejoin="miter" />
        ))}
      </mask>
      <rect width={WHEEL.w} height={WHEEL.h} mask={`url(#${id})`} />
    </g>
  );
}

export function AttributeWheel({ list, index }: { list: Attribute[]; index: number | null }) {
  const [picked, setPicked] = useState<AttributeId>("forca");
  const by = Object.fromEntries(list.map((a) => [a.id, a])) as Record<AttributeId, Attribute>;
  const ids = ORDER.filter((id) => by[id]);
  const sel = by[picked] ?? list[0];
  const why = whyLabel(sel.why);

  return (
    <section className="fm aw" aria-label="Atributos do operador">
      <div className="fm-intro">
        <div>
          <div className="fm-eyebrow">
            <span>02</span> OPERADOR / ATRIBUTOS
          </div>
          <h2>
            ATRIBUTOS DO <em>OPERADOR</em>
          </h2>
          <p>Seis números dos seus registros. Nível = valor ÷ 5, de 0 a 20.</p>
        </div>
      </div>

      <div className="aw-wheel" role="group" aria-label="Roda de atributos">
        <svg className="aw-svg" viewBox={`0 0 ${WHEEL.w} ${WHEEL.h}`} aria-hidden="true">
          {DECOR.map((d) => (
            <Bus key={d} d={d} width={18} className="decor" />
          ))}
          {ids.map((id, i) => (
            <Bus key={id} d={SLOTS[i].bus} width={9} className={id === sel.id ? "on" : "off"} />
          ))}
          {/* Pulso de energia correndo do núcleo até o nó selecionado. */}
          {ids.map((id, i) => (id === sel.id ? <path key={`flow-${id}`} className="aw-flow" d={SLOTS[i].bus} pathLength={100} /> : null))}
          <g className="aw-core">
            <path className="core-ring" d="M414 236 L568 400 L414 564 L260 400 Z" />
            <path className="core-half" d="M414 250 L554 400 L414 550 Z" />
            <path className="core-half alt" d="M414 250 L274 400 L414 550 Z" />
            <path className="core-gem" d="M414 260 L458 304 L414 348 L370 304 Z" />
            <path className="core-gem" d="M414 452 L458 496 L414 540 L370 496 Z" />
            <path className="core-seam" d="M414 348 V452" />
            <text x="414" y="318" className="core-value">
              {index ?? "–"}
            </text>
            <text x="414" y="501" className="core-label">
              ÍNDICE
            </text>
          </g>
        </svg>

        {ids.map((id, i) => {
          const a = by[id];
          const on = id === sel.id;
          return (
            <button
              key={id}
              type="button"
              className={`aw-node${on ? " on" : ""}${a.level == null ? " no-data" : ""}`}
              style={{ left: pct(SLOTS[i].x, WHEEL.w), top: pct(SLOTS[i].y, WHEEL.h), "--i": i } as CSSProperties}
              aria-pressed={on}
              aria-label={`${a.name}, nível ${a.level ?? "sem dados"} de 20`}
              onClick={() => setPicked(id)}
            >
              <svg className="aw-shape" viewBox="0 0 278 180" preserveAspectRatio="none" aria-hidden="true">
                <path className="shape-body" d="M70 6 H208 L274 76 V104 L218 174 H60 L4 104 V76 Z" />
                <path className="shape-tab" d="M100 6 V1 H178 V6 M108 174 V179 H170 V174" />
              </svg>
              <span className="aw-content">
                <span className="aw-name">{a.name}</span>
                <span className="aw-score">
                  <span className="aw-hex">
                    <svg viewBox="0 0 26 28" aria-hidden="true">
                      <path d="M13 1.5 24 7.75v12.5L13 26.5 2 20.25V7.75Z" />
                    </svg>
                    <Glyph id={id} />
                  </span>
                  <b>{a.level ?? "–"}</b>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="aw-panel" aria-live="polite" key={sel.id}>
        <div className="aw-rail" aria-hidden="true" />
        <div className="aw-body">
          <div className="aw-head">
            <span className="aw-icon">
              <Glyph id={sel.id} />
            </span>
            <div>
              <h3>{sel.name}</h3>
              <p className="aw-level">
                {CODE[sel.id]} — {sel.level == null ? "SEM DADOS AINDA" : `NÍVEL ${sel.level} / 20`}
                {sel.value != null && <span>VALOR {sel.value}/100</span>}
              </p>
            </div>
          </div>

          <div
            className="aw-segments"
            role="meter"
            aria-label={`Nível de ${sel.name}`}
            aria-valuemin={0}
            aria-valuemax={20}
            aria-valuenow={sel.level ?? 0}
          >
            {Array.from({ length: 20 }, (_, i) => (
              <i key={i} className={i < (sel.level ?? 0) ? "on" : ""} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>

          <p className="aw-desc">{sel.summary}</p>

          <div className="aw-focus">
            <span>COMO SOBE</span>
            <p>{sel.how}</p>
          </div>

          {why && (
            <p className="aw-why">
              <span>BASE //</span> {why}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
