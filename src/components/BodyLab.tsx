import { Link } from "react-router-dom";
import type { BodyEntry, BodyGoal, Session } from "../data/types";
import { addDays, daysBetween, shortDate } from "../lib/dates";
import { bodyAdvice } from "../lib/engine";
import { formatWeight } from "../lib/progression";
import { GOAL_LABEL, goalStatus, weightLine, weightTrend, type GoalPace } from "../lib/visual";
import { NudgeList } from "./NudgeList";

// Aba "Corpo" do laudo, no visual dos painéis holográficos do Mapa de Fadiga: monitor do peso com meta, três
// mostradores de medida, a foto como scan com etiquetas e a orientação do motor (tabela do plano alimentar).

const PACE: Record<GoalPace, { text: string; cls: string }> = {
  "no-ritmo": { text: "NO RITMO", cls: "ok" },
  rapido: { text: "RÁPIDO DEMAIS", cls: "warn" },
  devagar: { text: "DEVAGAR", cls: "warn" },
  contrario: { text: "SENTIDO CONTRÁRIO", cls: "bad" },
  "sem-dados": { text: "POUCOS DADOS", cls: "" },
};

function Monitor({ points, target }: { points: { date: string; kg: number }[]; target?: number }) {
  const W = 320;
  const H = 130;
  const P = { l: 30, r: 6, t: 8, b: 16 };
  const vals = points.map((p) => p.kg).concat(target != null ? [target] : []);
  const lo = Math.floor(Math.min(...vals) - 0.3);
  const hi = Math.ceil(Math.max(...points.map((p) => p.kg)) + 0.3);
  const minY = target != null && target < lo ? lo : lo;
  const t0 = points[0].date;
  const span = Math.max(1, daysBetween(t0, points[points.length - 1].date));
  const x = (d: string) => P.l + (daysBetween(t0, d) / span) * (W - P.l - P.r);
  const y = (kg: number) => P.t + (1 - (Math.max(minY, Math.min(hi, kg)) - minY) / Math.max(0.1, hi - minY)) * (H - P.t - P.b);
  // Média dos últimos 7 dias (pelo tempo, não pela contagem de pesagens); os pontos crus ficam apagados por baixo.
  const avg = weightLine(points);
  const path = (ps: { date: string; kg: number }[]) =>
    ps.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.kg).toFixed(1)}`).join("");
  const line = path(avg);
  const last = avg[avg.length - 1];
  const ticks = [hi, (hi + minY) / 2, minY];
  const showTarget = target != null && target >= minY && target <= hi;
  return (
    <svg className="bm-chart" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id="bm-fill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#3fd8e0" stopOpacity=".28" />
          <stop offset="1" stopColor="#3fd8e0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="bm-grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} />
          <text className="bm-axis" x={P.l - 5} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {formatWeight(Math.round(t * 10) / 10)}
          </text>
        </g>
      ))}
      {showTarget && (
        <g>
          <line className="bm-target" x1={P.l} x2={W - P.r} y1={y(target!)} y2={y(target!)} />
          <text className="bm-target-label" x={W - P.r - 2} y={y(target!) - 4} textAnchor="end">
            META {formatWeight(target!)}
          </text>
        </g>
      )}
      {points.map((p) => (
        <circle key={p.date} className="bm-dot" cx={x(p.date)} cy={y(p.kg)} r="1.4" />
      ))}
      <path d={`${line}L${x(last.date)} ${H - P.b}L${x(avg[0].date)} ${H - P.b}Z`} fill="url(#bm-fill)" />
      <path className="bm-line" d={line} />
      <circle className="bm-end" cx={x(last.date)} cy={y(last.kg)} r="3.5" />
      <text className="bm-axis" x={P.l} y={H - 3}>
        {shortDate(points[0].date)}
      </text>
      <text className="bm-axis" x={W - P.r} y={H - 3} textAnchor="end">
        {shortDate(points[points.length - 1].date)}
      </text>
    </svg>
  );
}

function delta(entries: BodyEntry[], key: "weightKg" | "waistCm" | "armCm", today: string): { cur?: number; d?: number } {
  const pts = entries.filter((e) => e[key] != null).sort((a, b) => a.date.localeCompare(b.date));
  const cur = pts[pts.length - 1];
  if (!cur) return {};
  const ref = [...pts].reverse().find((e) => e.date <= addDays(today, -28)) ?? pts[0];
  return { cur: cur[key], d: ref === cur ? undefined : cur[key]! - ref[key]! };
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${formatWeight(Math.abs(Number(n.toFixed(1))))}`;

export function BodyLab({ entries, goal, sessions, today }: { entries: BodyEntry[]; goal?: BodyGoal; sessions: Session[]; today: string }) {
  const pts = entries
    .filter((e) => e.weightKg && daysBetween(e.date, today) <= 60)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, kg: e.weightKg! }));
  const trend = weightTrend(entries);
  const status = goalStatus(trend, goal);
  const photo = [...entries].filter((e) => e.photoDataUrl).sort((a, b) => b.date.localeCompare(a.date))[0];
  const advice = bodyAdvice(entries, goal, sessions, today);
  // Para cada medida, que direção é "boa" na fase: perdendo, peso e cintura caindo; braço sempre subindo.
  const wantDown = goal?.mode === "perder";
  const gauges = [
    { name: "PESO", unit: "kg", v: delta(entries, "weightKg", today), good: wantDown ? -1 : goal?.mode === "ganhar" ? 1 : 0 },
    { name: "CINTURA", unit: "cm", v: delta(entries, "waistCm", today), good: -1 },
    { name: "BRAÇO", unit: "cm", v: delta(entries, "armCm", today), good: 1 },
  ];

  if (!entries.length) {
    return (
      <section className="fm body-scan">
        <div className="fm-panel bm-empty">
          <p>Sem medidas ainda. Registre peso, cintura, braço e foto em Progresso → Biometria.</p>
          <Link to="/progresso" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm">
            Registrar medida <span className="arrow">&gt;</span>
          </Link>
        </div>
      </section>
    );
  }

  const cur = pts[pts.length - 1];
  // O selo segue a mesma regra da orientação (médias semanais do plano alimentar) quando ela já decidiu;
  // a regressão de 28 dias só entra quando a regra ainda espera dados.
  const rule = advice.find((n) => n.id === "ritmo-peso" && n.tone !== "info");
  const pace = rule
    ? rule.tone === "good"
      ? { text: rule.why === "recomposicao" ? "RECOMPOSIÇÃO" : "NO RITMO", cls: "ok" }
      : { text: "AJUSTAR DIETA", cls: "warn" }
    : status
      ? PACE[status.reached ? "no-ritmo" : status.pace]
      : null;

  return (
    <section className="fm body-scan" aria-label="Corpo">
      {pts.length >= 2 && (
        <div className="fm-panel bm-monitor">
          <div className="fm-heading">
            <div>
              <span>MONITOR // PESO</span>
              <small>60 DIAS · LINHA = MÉDIA DE 7 PESAGENS</small>
            </div>
            <div className="bm-now">
              <strong>{formatWeight(cur.kg)}</strong>
              <small>kg</small>
            </div>
          </div>
          <Monitor points={pts} target={goal?.targetKg} />
          <div className="bm-foot">
            <span className="bm-rate">{trend && trend.spanDays >= 6 ? `${signed(trend.kgPerWeek)} kg/sem` : "– kg/sem"}</span>
            {pace && <span className={`bm-pill ${pace.cls}`}>{pace.text}</span>}
            {goal && <span className="bm-goal">Meta: {GOAL_LABEL[goal.mode].toLowerCase()}</span>}
          </div>
        </div>
      )}

      <div className="bm-gauges">
        {gauges.map((g) => {
          const dir = g.v.d == null || Math.abs(g.v.d) < 0.05 ? 0 : Math.sign(g.v.d);
          const cls = dir === 0 || g.good === 0 ? "" : dir === g.good ? "ok" : "warn";
          return (
            <div key={g.name} className="fm-panel bm-gauge">
              <small>{g.name}</small>
              <strong>
                {g.v.cur != null ? formatWeight(g.v.cur) : "—"}
                <span>{g.unit}</span>
              </strong>
              <em className={cls}>
                {g.v.d != null ? `${dir > 0 ? "▲" : dir < 0 ? "▼" : "■"} ${signed(g.v.d)}` : "sem ref."}
                <i>28 d</i>
              </em>
            </div>
          );
        })}
      </div>

      {photo && (
        <figure className="fm-panel bm-scan">
          <figcaption className="bm-scan-head">
            <span>SCAN // {shortDate(photo.date)}</span>
            <i>BIOMETRIA</i>
          </figcaption>
          <div className="bm-photo">
            <img src={photo.photoDataUrl} alt={`Foto de ${shortDate(photo.date)}`} />
            <span className="bm-sweep" aria-hidden="true" />
            {photo.weightKg != null && (
              <span className="scan-tag r" style={{ top: "12%", ["--lead" as string]: "36px" }}>
                Peso <b>{formatWeight(photo.weightKg)}</b>
              </span>
            )}
            {photo.armCm != null && (
              <span className="scan-tag l" style={{ top: "33%", ["--lead" as string]: "46px" }}>
                Braço <b>{formatWeight(photo.armCm)}</b>
              </span>
            )}
            {photo.waistCm != null && (
              <span className="scan-tag r" style={{ top: "55%", ["--lead" as string]: "46px" }}>
                Cintura <b>{formatWeight(photo.waistCm)}</b>
              </span>
            )}
          </div>
        </figure>
      )}

      {advice.length > 0 && (
        <div className="fm-panel bm-advice">
          <div className="fm-heading">
            <div>
              <span>ORIENTAÇÃO DO MOTOR</span>
              <small>PLANO ALIMENTAR · 2 SEMANAS SEGUIDAS</small>
            </div>
          </div>
          <div className="bm-advice-body">
            <NudgeList nudges={advice} />
          </div>
        </div>
      )}

      <Link to="/progresso" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm">
        Registrar medida <span className="arrow">&gt;</span>
      </Link>
    </section>
  );
}
