import { Fragment, useState, type CSSProperties } from "react";
import { EXERCISE_BY_ID, MUSCLE_LABEL, shortName } from "../data/program";
import { SCIENCE } from "../data/science";
import type { MuscleId } from "../data/types";
import type { MuscleSlots } from "../lib/slots";
import { whyLabel } from "./NudgeList";

// Séries da semana por músculo: uma barra contínua por músculo (séries fracionadas feitas), o traço branco marca o que a
// ficha pede, âmbar a dose mínima (4) e ciano o início da faixa eficiente (10). Toque numa linha para ver de onde
// vieram as séries.

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

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
  const withPlan = slots.filter((s) => s.planned > 0);
  const atMeta = withPlan.filter((s) => s.status === "meta" || s.status === "acima").length;
  const total = withPlan.reduce((a, s) => a + s.done, 0);
  const totalPlan = withPlan.reduce((a, s) => a + s.planned, 0);
  const min = SCIENCE.volume.minEffective;
  const eff = SCIENCE.volume.efficient[0];

  return (
    <section className="fm vb" aria-label="Séries da semana por músculo">
      <div className="fm-intro">
        <div>
          <div className="fm-eyebrow">
            <span>03</span> VOLUME / SÉRIES DA SEMANA
          </div>
          <h2>
            SÉRIES DA <em>SEMANA</em>
          </h2>
          <p>Séries fracionadas por músculo ({weekLabel}). O traço marca o que a ficha pede.</p>
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

      <div className="fm-panel vb-panel">
        {slots.map((m, row) => {
          const scale = Math.max(m.planned, m.done, eff, 1) * 1.1;
          const pos = (v: number) => `${(v / scale) * 100}%`;
          const inPlan = Math.min(m.done, m.planned || m.done);
          const extra = Math.max(0, m.done - Math.max(m.planned, 0));
          const tone =
            m.status === "acima" || m.status === "meta"
              ? "ok"
              : m.status === "abaixo-minimo"
                ? "warn"
                : m.status === "sem-plano"
                  ? "off"
                  : "";
          const open = picked === m.muscle;
          return (
            <Fragment key={m.muscle}>
              <button
                type="button"
                className={`vb-row ${tone}${open ? " on" : ""}`}
                style={{ "--row": row } as CSSProperties}
                aria-expanded={open}
                aria-label={`${MUSCLE_LABEL[m.muscle]}: ${fmt(m.done)} de ${fmt(m.planned)} séries fracionadas`}
                onClick={() => setPicked(open ? null : m.muscle)}
              >
                <span className="vb-name">{MUSCLE_LABEL[m.muscle]}</span>
                <span className="vb-track" aria-hidden="true">
                  <span className="vb-fill" style={{ width: pos(inPlan) }} />
                  {extra > 0 && <span className="vb-extra" style={{ left: pos(inPlan), width: pos(extra) }} />}
                  <span className="vb-mark min" style={{ left: pos(min) }} />
                  <span className="vb-mark eff" style={{ left: pos(eff) }} />
                  {m.planned > 0 && <span className="vb-target" style={{ left: pos(m.planned) }} />}
                </span>
                <span className="vb-num">
                  {fmt(m.done)}
                  <small>/{fmt(m.planned)}</small>
                </span>
              </button>
              {open && (
                <div className="vb-detail" aria-live="polite">
                  <p>{statusText(m, weekOver)}</p>
                  {m.sources.length > 0 ? (
                    <ul>
                      {m.sources.map((src) => (
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
                  <small className="dim">
                    {m.direct} diretas · {whyLabel("volume-fracionado")}
                  </small>
                </div>
              )}
            </Fragment>
          );
        })}
        <div className="vb-legend" aria-hidden="true">
          <span>
            <i className="fill" /> feita
          </span>
          <span>
            <i className="extra" /> além do plano
          </span>
          <span>
            <i className="target" /> plano
          </span>
          <span>
            <i className="min" /> dose mínima
          </span>
          <span>
            <i className="eff" /> faixa eficiente
          </span>
        </div>
      </div>
    </section>
  );
}
