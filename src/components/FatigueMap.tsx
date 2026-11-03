import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { MUSCLE_LABEL, MUSCLE_ORDER } from "../data/program";
import type { MuscleId } from "../data/types";
import { weekdayName, weekdayShort, fromISO } from "../lib/dates";
import { fatigueLevel, fatiguePct, hoursToReady, type FatigueLevel, type MuscleStatus } from "../lib/visual";
import { Anatomy, type AnatomyZone, type View } from "./Anatomy";
import { Icon } from "./Icon";

// Mapa de fadiga (design do Figma "Visualizador de Fadiga Cyberpunk"): corpo anatômico, lista de
// grupos, diagnóstico do músculo selecionado e três cartões de rodapé. Tudo vem do histórico:
// fadiga = quanto falta recuperar desde o último treino do músculo (ver muscleStatus).

/** Músculos de cada vista, de cima para baixo. Panturrilha aparece nas duas. */
const VIEW_MUSCLES: Record<View, MuscleId[]> = {
  front: ["peito", "deltAnterior", "deltLateral", "biceps", "abdomen", "quadriceps", "panturrilha"],
  back: ["trapezio", "deltPosterior", "costas", "triceps", "gluteo", "posterior", "panturrilha"],
};

const LEVEL_TAG: Record<FatigueLevel, string> = { critico: "CRÍTICO", atencao: "ATENÇÃO", estavel: "ESTÁVEL" };

const stale = (s: MuscleStatus) => s.state === "atrasado" || s.state === "sem-treino";

function ago(s: MuscleStatus): string {
  if (s.daysSince == null) return "nunca";
  return s.daysSince === 0 ? "hoje" : `há ${s.daysSince} d`;
}

function subline(s: MuscleStatus): string {
  if (s.state === "recuperando") return `~${hoursToReady(s)} h para 100%`;
  if (s.state === "pronto") return `Recuperado · ${ago(s)}`;
  return s.daysSince == null ? "Nunca treinado" : `${s.daysSince} d sem treino`;
}

function advice(s: MuscleStatus, pct: number): { title: string; text: string } {
  const h = hoursToReady(s);
  if (s.state === "sem-treino" && s.daysSince == null)
    return { title: "SEM REGISTRO", text: "Nenhuma série registrada para este músculo ainda." };
  if (stale(s))
    return {
      title: "SEM ESTÍMULO",
      text: `${s.daysSince} dias sem treino. A ficha bate cada músculo ~2× por semana: não deixe passar no próximo treino.`,
    };
  if (s.state === "pronto") return { title: "LIBERADO", text: "Recuperado. Pode treinar pesado quando a ficha mandar." };
  if (pct >= 75)
    return {
      title: "RECÉM-TREINADO",
      text: `${s.lastSets} séries ${ago(s)}. Dê ~${h} h antes de treinar pesado de novo.`,
    };
  if (pct >= 50)
    return {
      title: "RECUPERANDO",
      text: `~${h} h para 100%. Se a ficha mandar treinar antes, vá pelas reps e RIR do dia, sem forçar carga.`,
    };
  return { title: "QUASE PRONTO", text: `~${h} h para 100%. Liberado para o próximo treino.` };
}

function Glyph({ name, size = 18 }: { name: "pulse" | "scan"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      {name === "pulse" ? (
        <path d="M2 12h4l2.5-6 4 12L15 12h7" />
      ) : (
        <>
          <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function LoadChart({ days }: { days: { date: string; sets: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.sets));
  const pts = days.map((d, i) => [(i / (days.length - 1)) * 260, 70 - (d.sets / max) * 60] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="fm-chart" viewBox="0 0 260 76" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fm-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--red)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--red)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="fm-chart-grid" d="M0 19h260M0 38h260M0 57h260M52 0v76M104 0v76M156 0v76M208 0v76" />
      <path d={`${line}V76H0Z`} fill="url(#fm-chart-fill)" />
      <path className="fm-chart-line" d={line} />
      <circle cx={lx} cy={ly} r="3.5" />
    </svg>
  );
}

export interface NextWorkout {
  name: string;
  date: string;
  muscles: MuscleId[];
  readiness: number;
}

export function FatigueMap({
  status,
  daily,
  next,
  today,
  now = Date.now(),
}: {
  status: Record<MuscleId, MuscleStatus>;
  daily: { date: string; sets: number }[];
  next?: NextWorkout;
  today: string;
  now?: number;
}) {
  const [view, setView] = useState<View>("front");
  const [picked, setPicked] = useState<MuscleId | null>(null);

  const pct = (m: MuscleId) => fatiguePct(status[m]);
  const ids = VIEW_MUSCLES[view];
  const zones: AnatomyZone[] = ids.map((m) => ({ id: m, name: MUSCLE_LABEL[m], fatigue: pct(m), level: fatigueLevel(pct(m)) }));
  // Sem toque, abre no músculo mais cansado da vista.
  const selected = picked && ids.includes(picked) ? picked : [...ids].sort((a, b) => pct(b) - pct(a))[0];
  const s = status[selected];
  const sPct = pct(selected);
  const sLevel = fatigueLevel(sPct);
  const tip = advice(s, sPct);

  const avg = Math.round(MUSCLE_ORDER.reduce((a, m) => a + pct(m), 0) / MUSCLE_ORDER.length);
  const ready = MUSCLE_ORDER.filter((m) => pct(m) < 50).length;
  const recovering = MUSCLE_ORDER.filter((m) => status[m].state === "recuperando");
  const allReadyIn = Math.max(0, ...recovering.map((m) => hoursToReady(status[m])));
  const allReadyAt = new Date(now + allReadyIn * 3600_000);
  const weekSets = daily.reduce((a, d) => a + d.sets, 0);
  const nextWhen = next ? (next.date === today ? "HOJE" : weekdayName(next.date).toUpperCase()) : "";

  return (
    <section className="fm" aria-label="Mapa de fadiga">
      <div className="fm-intro">
        <div>
          <div className="fm-eyebrow">
            <span>01</span> BIOMETRIA / LEITURA ATUAL
          </div>
          <h2>
            MAPA DE <em>FADIGA</em>
          </h2>
          <p>Recuperação estimada pelas séries do último treino de cada músculo.</p>
        </div>
        <div className="fm-status">
          <div>
            <small>ÍNDICE GERAL</small>
            <strong>
              {avg}
              <sup>%</sup>
            </strong>
          </div>
          <div>
            <small>PRONTOS</small>
            <strong>
              {ready}
              <sup>/{MUSCLE_ORDER.length}</sup>
            </strong>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-body">
        <div className="fm-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="fm-switch" role="group" aria-label="Vista do corpo">
          {(["front", "back"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "front" ? "FRONTAL" : "POSTERIOR"}
            </button>
          ))}
        </div>
        <div className="fm-scan-tag" aria-hidden="true">
          <Glyph name="scan" size={14} /> SCAN <span>ATIVO</span>
        </div>
        <Anatomy view={view} zones={zones} selectedId={selected} onSelect={setPicked} />
        <div className="fm-caption" aria-hidden="true">
          <span>VISTA {view === "front" ? "ANTERIOR" : "POSTERIOR"}</span>
          <i />
          <span>TOQUE NUM MÚSCULO</span>
        </div>
      </div>

      <div className="fm-panel fm-zones">
        <div className="fm-heading">
          <div>
            <span>GRUPOS MUSCULARES</span>
            <small>SELECIONE PARA ANALISAR</small>
          </div>
          <b>{String(ids.length).padStart(2, "0")}</b>
        </div>
        <div className="fm-zone-list">
          {zones.map((z, i) => (
            <button key={z.id} type="button" aria-pressed={selected === z.id} onClick={() => setPicked(z.id)}>
              <span className={`fm-index ${z.level}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="fm-zone-copy">
                <strong>{z.name}</strong>
                <small className={stale(status[z.id]) ? (status[z.id].state === "sem-treino" ? "critico" : "atencao") : undefined}>
                  {subline(status[z.id])}
                </small>
              </span>
              <span className={`fm-zone-value ${z.level}`}>
                <strong>{z.fatigue}%</strong>
                <i>
                  <u style={{ width: `${z.fatigue}%` }} />
                </i>
              </span>
            </button>
          ))}
        </div>
        <div className="fm-legend">
          <small>NÍVEL DE FADIGA</small>
          <div>
            <span>
              <i className="estavel" />
              0–49 ESTÁVEL
            </span>
            <span>
              <i className="atencao" />
              50–74 ATENÇÃO
            </span>
            <span>
              <i className="critico" />
              75+ CRÍTICO
            </span>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-diag">
        <div className="fm-heading">
          <div>
            <span>DIAGNÓSTICO</span>
            <small>DADOS DA ZONA ATIVA</small>
          </div>
          <div className="fm-hex">{String(ids.indexOf(selected) + 1).padStart(2, "0")}</div>
        </div>
        <div className="fm-selected">
          <div>
            <small>{view === "front" ? "VISTA ANTERIOR" : "VISTA POSTERIOR"}</small>
            <h3>{MUSCLE_LABEL[selected]}</h3>
          </div>
          <span className={stale(s) ? "atencao" : sLevel}>{stale(s) ? "PARADO" : LEVEL_TAG[sLevel]}</span>
        </div>
        <div className={`fm-gauge ${sLevel}`} style={{ "--value": `${sPct * 3.6}deg` } as CSSProperties}>
          <div>
            <strong>{sPct}</strong>
            <span>%</span>
            <small>FADIGA</small>
          </div>
          <span className="fm-tick a" />
          <span className="fm-tick b" />
          <span className="fm-tick c" />
        </div>
        <div className="fm-metrics">
          <div>
            <small>RECUPERAÇÃO</small>
            <strong>{s.state === "recuperando" ? `${hoursToReady(s)}h` : "OK"}</strong>
            <span>{s.state === "recuperando" ? "PARA 100%" : "PRONTO"}</span>
          </div>
          <div>
            <small>ÚLTIMO TREINO</small>
            <strong>{s.daysSince == null ? "—" : s.daysSince === 0 ? "Hoje" : `${s.daysSince} d`}</strong>
            <span>{s.lastSets ? `${s.lastSets} SÉRIES` : "SEM REGISTRO"}</span>
          </div>
          <div>
            <small>SEMANA</small>
            <strong>
              {s.sets}/{s.target}
            </strong>
            <span>SÉRIES / META</span>
          </div>
        </div>
        <div className={`fm-alert ${stale(s) ? "atencao" : sLevel}`}>
          <Glyph name="pulse" />
          <p>
            <strong>{tip.title}</strong>
            {tip.text}
          </p>
        </div>
      </div>

      <div className="fm-panel fm-load">
        <div className="fm-heading">
          <div>
            <span>CARGA ACUMULADA</span>
            <small>SÉRIES POR DIA · 7 DIAS</small>
          </div>
          <strong>{weekSets} séries</strong>
        </div>
        <LoadChart days={daily} />
        <div className="fm-chart-labels">
          {daily.map((d, i) => (
            <span key={d.date}>{i === daily.length - 1 ? "HOJE" : weekdayShort(fromISO(d.date).getDay()).toUpperCase()}</span>
          ))}
        </div>
      </div>

      <div className="fm-cards">
        <div className="fm-panel fm-card">
          <div className="fm-card-icon">
            <Icon name="clock" size={22} />
          </div>
          <div>
            <small>TUDO RECUPERADO</small>
            <strong>
              {allReadyIn === 0
                ? "AGORA"
                : `${weekdayShort(allReadyAt.getDay()).toUpperCase()} ${String(allReadyAt.getHours()).padStart(2, "0")}:00`}
            </strong>
            <span>
              {recovering.length === 0
                ? "Nenhum músculo recuperando."
                : `${recovering.length} ${recovering.length === 1 ? "músculo ainda recuperando" : "músculos ainda recuperando"} · ~${allReadyIn} h`}
            </span>
          </div>
        </div>
        {next && (
          <Link to="/" className="fm-panel fm-card">
            <div>
              <small>PRÓXIMO TREINO</small>
              <strong>{next.name.toUpperCase()}</strong>
              <span>{nextWhen}</span>
            </div>
            <div className="fm-ready">
              <span>PRONTIDÃO</span>
              <strong className={fatigueLevel(100 - next.readiness)}>{next.readiness}%</strong>
              <i>
                <u className={fatigueLevel(100 - next.readiness)} style={{ width: `${next.readiness}%` }} />
              </i>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
