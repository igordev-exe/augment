import { useState } from "react";
import { MUSCLE_LABEL, MUSCLE_ORDER } from "../data/program";
import type { MuscleId } from "../data/types";
import { shortDate } from "../lib/dates";
import { recoveryHours, UNTRAINED_DAYS, type MuscleStatus } from "../lib/visual";

// Mapa muscular em SVG: frente e costas, cada músculo da ficha é uma região tocável.
// As formas são da metade esquerda e espelhadas; o que não tem séries na ficha (cabeça, antebraço…) fica neutro.

type Mode = "volume" | "recuperacao" | "sem-treino";

interface Region {
  m?: MuscleId;
  pts: string;
}

const FRONT: Region[] = [
  { m: "trapezio", pts: "45.5,24 45.5,29 36,32 41,28.5" },
  { m: "deltLateral", pts: "31,31 26,34 23,41 23,49 26.5,50 27.5,41" },
  { m: "deltAnterior", pts: "36,31.5 31,31 27.5,41 26.5,50 30,48.5 33,41 37,35" },
  { m: "peito", pts: "49,34 38,34.5 34,40 32.5,49 35,56 42,59 49,58" },
  { m: "biceps", pts: "26.5,52 30,50 31.5,58 31,70 28.5,77 24.5,77 22.5,68 22.5,58" },
  { pts: "24,80 28.5,80 28,94 25,111 20.5,111 19,98 21,86" },
  { pts: "20.5,113 25,113 25,123 21,124 19,118" },
  { pts: "34,58 41,60.5 40,76 39,93 36.5,94 35,80 33.5,66" },
  { m: "abdomen", pts: "49,60 42.5,61 41.5,76 40.5,93 49,97" },
  { pts: "49,99 40,95 36,96 34.5,105 41,113 49,117" },
  { m: "quadriceps", pts: "33.5,108 40,114 48.5,119 47,138 45.5,155 39,157 35,150 32.5,130" },
  { pts: "35.5,152 45.5,157 45,166 37,165" },
  { m: "panturrilha", pts: "36.5,168 44.5,168 44,182 42.5,196 38.5,196 35.5,182" },
  { pts: "38,198 43,198 44,205 35.5,205" },
];

const BACK: Region[] = [
  { m: "trapezio", pts: "50,22 45.5,24 45.5,28 36,32 42,38 47,48 50,62" },
  { m: "deltPosterior", pts: "36,32 31,31 27.5,41 26.5,50 30,48.5 33.5,41 38,36" },
  { m: "deltLateral", pts: "31,31 26,34 23,41 23,49 26.5,50 27.5,41" },
  { m: "costas", pts: "42,38.5 37.5,36 34,41 33,52 34.5,66 38,82 44,90 50,92 50,63 47,49" },
  { m: "triceps", pts: "26.5,52 30,50 31.5,58 31,70 28.5,77 24.5,77 22.5,68 22.5,58" },
  { pts: "24,80 28.5,80 28,94 25,111 20.5,111 19,98 21,86" },
  { pts: "20.5,113 25,113 25,123 21,124 19,118" },
  { pts: "50,93.5 43,91 38,84 37.5,95 44,99 50,100" },
  { m: "gluteo", pts: "50,101 43,100 37,97 34,105 34.5,115 40,121 48,120 50,117" },
  { m: "posterior", pts: "34,118 40,123 48,122 47,140 45.5,155 39,157 35,150 33,132" },
  { pts: "35.5,152 45.5,157 45,166 37,165" },
  { m: "panturrilha", pts: "36,166 41,165 45,167 45.5,178 43,192 39,193 35.5,180" },
  { pts: "38,198 43,198 44,205 35.5,205" },
];

function paint(s: MuscleStatus, mode: Mode): { fill: string; opacity: number } {
  if (mode === "volume") {
    if (s.sets === 0) return { fill: "var(--surface-3)", opacity: 1 };
    const r = s.target ? s.sets / s.target : 1;
    if (r > 1.25) return { fill: "var(--violet)", opacity: 0.85 };
    return { fill: "var(--cyan)", opacity: r >= 1 ? 0.95 : r >= 0.5 ? 0.6 : 0.3 };
  }
  if (mode === "recuperacao") {
    if (s.state === "recuperando") return { fill: "var(--amber)", opacity: 0.35 + (1 - s.recovery) * 0.6 };
    if (s.state === "pronto") return { fill: "var(--cyan)", opacity: 0.4 };
    return { fill: "var(--surface-3)", opacity: 1 };
  }
  if (s.state === "sem-treino") return { fill: "var(--red)", opacity: 0.85 };
  if (s.state === "atrasado") return { fill: "var(--amber)", opacity: 0.7 };
  return { fill: "var(--cyan)", opacity: 0.2 };
}

function Figure({
  regions,
  label,
  status,
  mode,
  selected,
  onPick,
}: {
  regions: Region[];
  label: string;
  status: Record<MuscleId, MuscleStatus>;
  mode: Mode;
  selected: MuscleId | null;
  onPick: (m: MuscleId) => void;
}) {
  const draw = (r: Region, i: number, side: "l" | "r") => {
    if (!r.m) return <polygon key={`${side}${i}`} points={r.pts} className="mm-neutral" />;
    const m = r.m;
    const { fill, opacity } = paint(status[m], mode);
    return (
      <polygon
        key={`${side}${i}`}
        points={r.pts}
        className={`mm-muscle${selected === m ? " sel" : ""}`}
        style={{ fill, fillOpacity: opacity }}
        onClick={() => onPick(m)}
      />
    );
  };
  return (
    <figure className="mm-fig">
      <svg viewBox="0 0 100 210" role="img" aria-label={`Mapa muscular, ${label.toLowerCase()}`}>
        <ellipse cx="50" cy="13" rx="7.5" ry="9.5" className="mm-neutral" />
        <rect x="45.5" y="21" width="9" height="7" className="mm-neutral" />
        {regions.map((r, i) => draw(r, i, "l"))}
        <g transform="matrix(-1 0 0 1 100 0)">{regions.map((r, i) => draw(r, i, "r"))}</g>
      </svg>
      <figcaption className="tiny mono faint">{label}</figcaption>
    </figure>
  );
}

const MODES: { id: Mode; label: string }[] = [
  { id: "volume", label: "Volume" },
  { id: "recuperacao", label: "Recuperação" },
  { id: "sem-treino", label: "Sem treino" },
];

const LEGEND: Record<Mode, { color: string; opacity: number; text: string }[]> = {
  volume: [
    { color: "var(--surface-3)", opacity: 1, text: "0 séries" },
    { color: "var(--cyan)", opacity: 0.3, text: "< metade" },
    { color: "var(--cyan)", opacity: 0.6, text: "quase lá" },
    { color: "var(--cyan)", opacity: 0.95, text: "meta" },
    { color: "var(--violet)", opacity: 0.85, text: "acima de 125%" },
  ],
  recuperacao: [
    { color: "var(--amber)", opacity: 0.9, text: "recém-treinado" },
    { color: "var(--amber)", opacity: 0.45, text: "quase recuperado" },
    { color: "var(--cyan)", opacity: 0.4, text: "pronto" },
    { color: "var(--surface-3)", opacity: 1, text: "parado há dias" },
  ],
  "sem-treino": [
    { color: "var(--cyan)", opacity: 0.2, text: "em dia" },
    { color: "var(--amber)", opacity: 0.7, text: "5+ dias" },
    { color: "var(--red)", opacity: 0.85, text: `${UNTRAINED_DAYS}+ dias ou nunca` },
  ],
};

function detail(s: MuscleStatus, mode: Mode): string {
  const last = s.lastDate
    ? `último treino ${shortDate(s.lastDate)} (${s.daysSince === 0 ? "hoje" : `há ${s.daysSince} d`})`
    : "nunca treinado";
  if (mode === "volume") return `${s.sets}/${s.target} séries na semana · ${last}`;
  if (mode === "recuperacao") {
    if (s.state === "recuperando") {
      const left = Math.ceil((1 - s.recovery) * recoveryHours(s.lastSets));
      return `${Math.round(s.recovery * 100)}% recuperado, ~${left} h para 100% · ${s.lastSets} séries · ${last}`;
    }
    return s.state === "pronto" ? `Recuperado · ${last}` : `Parado · ${last}`;
  }
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export function MuscleMap({ status }: { status: Record<MuscleId, MuscleStatus> }) {
  const [mode, setMode] = useState<Mode>("volume");
  const [selected, setSelected] = useState<MuscleId | null>(null);

  // No modo volume a lista seria igual às barras de "Séries desta semana", logo abaixo.
  const list =
    mode === "volume"
      ? []
      : mode === "recuperacao"
        ? MUSCLE_ORDER.filter((m) => status[m].state === "recuperando").sort((a, b) => status[a].recovery - status[b].recovery)
        : MUSCLE_ORDER.filter((m) => status[m].state === "sem-treino" || status[m].state === "atrasado").sort(
            (a, b) => (status[b].daysSince ?? 999) - (status[a].daysSince ?? 999),
          );
  const listTitle = mode === "recuperacao" ? "Ainda recuperando" : "Precisando de estímulo";

  const sel = selected ? status[selected] : null;

  return (
    <div className="stack">
      <div className="spread">
        <span className="unit-toggle" role="group" aria-label="Modo do mapa">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </span>
      </div>

      <div className="mm">
        <Figure regions={FRONT} label="FRENTE" status={status} mode={mode} selected={selected} onPick={setSelected} />
        <Figure regions={BACK} label="COSTAS" status={status} mode={mode} selected={selected} onPick={setSelected} />
      </div>

      <div className="mm-legend">
        {LEGEND[mode].map((l) => (
          <span key={l.text} className="tiny muted">
            <i style={{ background: l.color, opacity: l.opacity }} />
            {l.text}
          </span>
        ))}
      </div>

      {sel ? (
        <div data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 4, padding: 12 }}>
          <div className="spread">
            <strong className="small">{MUSCLE_LABEL[sel.muscle]}</strong>
            <button type="button" className="link-btn" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
          <span className="small muted">{detail(sel, mode)}</span>
        </div>
      ) : (
        <p className="tiny faint" style={{ margin: 0 }}>
          Toque num músculo para ver os detalhes.
        </p>
      )}

      {list.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">{listTitle}</span>
          <div className="row-wrap" style={{ gap: 6 }}>
            {list.map((m) => (
              <button
                key={m}
                type="button"
                className="mm-chip"
                aria-pressed={selected === m}
                onClick={() => setSelected(selected === m ? null : m)}
              >
                {MUSCLE_LABEL[m]}
                <span className="faint">
                  {mode === "volume"
                    ? ` ${status[m].sets}/${status[m].target}`
                    : mode === "recuperacao"
                      ? ` ${Math.round(status[m].recovery * 100)}%`
                      : status[m].daysSince != null
                        ? ` ${status[m].daysSince} d`
                        : " nunca"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
