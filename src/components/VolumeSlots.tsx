import { useState } from "react";
import { EXERCISE_BY_ID, MUSCLE_LABEL, shortName } from "../data/program";
import { SCIENCE } from "../data/science";
import type { MuscleId } from "../data/types";
import { SLOT_COLUMNS, slotCells, type MuscleSlots } from "../lib/slots";
import { whyLabel } from "./NudgeList";

// Slots de volume no estilo "implantes": cada músculo é uma fileira de casas (uma por série fracionada da semana).
// Cheia = feita, meia = série indireta (0,5), vazia = falta, verde = além do plano. Marcas na casa 4 (dose mínima)
// e 10 (início da faixa eficiente). Toque num músculo para ver de onde vieram as séries.

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

function badge(m: MuscleSlots): { text: string; cls: string } {
  if (m.status === "sem-plano") return { text: "—", cls: "" };
  if (m.status === "acima") return { text: `+${fmt(m.done - m.planned)}`, cls: "ok" };
  if (m.status === "meta") return { text: "META ✓", cls: "ok" };
  return { text: `FALTAM ${m.missing}`, cls: m.status === "abaixo-minimo" ? "warn" : "" };
}

function statusText(m: MuscleSlots, weekOver: boolean): string {
  const min = SCIENCE.volume.minEffective;
  if (m.status === "acima")
    return `Passou do plano em ${fmt(m.done - m.planned)} série(s). Ainda rende, com retorno menor: só não vire hábito sem o ajuste do mesociclo.`;
  if (m.status === "meta") return "Plano da semana cumprido para este músculo.";
  if (m.status === "abaixo-minimo")
    return weekOver
      ? `Semana fechou abaixo de ${min} séries fracionadas: estímulo mínimo para hipertrofia não foi atingido.`
      : `Ainda abaixo de ${min} séries fracionadas (dose mínima). Os próximos treinos da semana devem cobrir.`;
  return `Faltam ${m.missing} para o plano. Entre ${SCIENCE.volume.efficient[0]} e ${SCIENCE.volume.efficient[1]} é a faixa de melhor estímulo-fadiga.`;
}

export function VolumeSlots({ slots, weekLabel, weekOver }: { slots: MuscleSlots[]; weekLabel: string; weekOver: boolean }) {
  const [picked, setPicked] = useState<MuscleId | null>(null);
  const by = Object.fromEntries(slots.map((s) => [s.muscle, s])) as Record<MuscleId, MuscleSlots>;
  const withPlan = slots.filter((s) => s.planned > 0);
  const atMeta = withPlan.filter((s) => s.status === "meta" || s.status === "acima").length;
  const total = withPlan.reduce((a, s) => a + s.done, 0);
  const totalPlan = withPlan.reduce((a, s) => a + s.planned, 0);
  const sel = picked ? by[picked] : null;

  return (
    <section className="fm slots" aria-label="Slots de volume da semana">
      <div className="fm-intro">
        <div>
          <div className="fm-eyebrow">
            <span>02</span> IMPLANTES / VOLUME DA SEMANA
          </div>
          <h2>
            SLOTS DE <em>VOLUME</em>
          </h2>
          <p>Uma casa por série fracionada ({weekLabel}). Marcas: dose mínima (4) e faixa eficiente (10).</p>
        </div>
        <div className="fm-status">
          <div>
            <small>NA META</small>
            <strong>
              {atMeta}
              <sup>/{withPlan.length}</sup>
            </strong>
          </div>
          <div>
            <small>SÉRIES</small>
            <strong>
              {Math.round(total)}
              <sup>/{Math.round(totalPlan)}</sup>
            </strong>
          </div>
        </div>
      </div>

      <div className="fm-panel slots-grid">
        {SLOT_COLUMNS.map((col) => (
          <div key={col.title} className="slots-col">
            <div className="slots-col-title">{col.title}</div>
            {col.muscles.map((mid) => {
              const m = by[mid];
              const b = badge(m);
              const cells = slotCells(m);
              return (
                <button
                  key={mid}
                  type="button"
                  className={`slot-row${picked === mid ? " on" : ""}`}
                  aria-pressed={picked === mid}
                  aria-label={`${MUSCLE_LABEL[mid]}: ${fmt(m.done)} de ${fmt(m.planned)} séries fracionadas`}
                  onClick={() => setPicked(picked === mid ? null : mid)}
                >
                  <span className="slot-head">
                    <strong>{MUSCLE_LABEL[mid]}</strong>
                    <em className={b.cls}>{b.text}</em>
                  </span>
                  <span className="slot-cells" aria-hidden="true">
                    {cells.map((c, i) => (
                      <i
                        key={i}
                        className={`c-${c}${i === SCIENCE.volume.minEffective ? " mark-min" : ""}${i === SCIENCE.volume.efficient[0] ? " mark-eff" : ""}`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <div className="slots-legend" aria-hidden="true">
          <span>
            <i className="full" /> feita
          </span>
          <span>
            <i /> falta
          </span>
          <span>
            <i className="extra" /> além do plano
          </span>
          <span>
            <i className="min" /> dose mínima
          </span>
          <span>
            <i className="eff" /> faixa eficiente
          </span>
        </div>
      </div>

      {sel && (
        <div className="fm-panel slots-detail" aria-live="polite">
          <div className="fm-heading">
            <div>
              <span>{MUSCLE_LABEL[sel.muscle].toUpperCase()}</span>
              <small>
                {fmt(sel.done)} DE {fmt(sel.planned)} FRACIONADAS · {sel.direct} DIRETAS
              </small>
            </div>
            <b>{fmt(sel.done)}</b>
          </div>
          <div className="slots-detail-body">
            <p>{statusText(sel, weekOver)}</p>
            {sel.sources.length > 0 ? (
              <ul>
                {sel.sources.map((src) => (
                  <li key={src.exId}>
                    <span>{shortName(EXERCISE_BY_ID[src.exId])}</span>
                    <span>
                      {src.sets} × {src.weight === 1 ? "1" : "0,5"} = <b>{fmt(src.sets * src.weight)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dim">Nenhuma série deste músculo na semana ainda.</p>
            )}
            <small className="dim">{whyLabel("volume-fracionado")}</small>
          </div>
        </div>
      )}
    </section>
  );
}
