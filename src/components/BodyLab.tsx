import { Link } from "react-router-dom";
import type { BodyEntry, BodyGoal, Session } from "../data/types";
import { addDays, daysBetween, shortDate } from "../lib/dates";
import { bodyAdvice } from "../lib/engine";
import { formatWeight } from "../lib/progression";
import { GOAL_LABEL, weightTrend } from "../lib/visual";
import { NudgeList } from "./NudgeList";

// Aba "Corpo" do laudo: monitor do peso (linha de fósforo verde), medidas com variação, foto com etiquetas e a
// orientação do motor (tabela do plano alimentar).

function MonitorChart({ points }: { points: { date: string; kg: number }[] }) {
  const W = 300;
  const H = 120;
  const min = Math.min(...points.map((p) => p.kg)) - 0.4;
  const max = Math.max(...points.map((p) => p.kg)) + 0.4;
  const t0 = points[0].date;
  const span = Math.max(1, daysBetween(t0, points[points.length - 1].date));
  const xy = (p: { date: string; kg: number }) => [(daysBetween(t0, p.date) / span) * W, H - ((p.kg - min) / (max - min)) * H] as const;
  const line = points.map((p, i) => `${i ? "L" : "M"}${xy(p)[0].toFixed(1)} ${xy(p)[1].toFixed(1)}`).join("");
  // Média móvel de 7 pontos: a tendência que vale para decidir, não o dia isolado.
  const avg = points.map((p, i) => {
    const w = points.slice(Math.max(0, i - 6), i + 1);
    return { date: p.date, kg: w.reduce((a, x) => a + x.kg, 0) / w.length };
  });
  const avgLine = avg.map((p, i) => `${i ? "L" : "M"}${xy(p)[0].toFixed(1)} ${xy(p)[1].toFixed(1)}`).join("");
  const [lx, ly] = xy(points[points.length - 1]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path
        className="grid"
        d={`M0 ${H / 4}H${W}M0 ${H / 2}H${W}M0 ${(3 * H) / 4}H${W}M${W / 4} 0V${H}M${W / 2} 0V${H}M${(3 * W) / 4} 0V${H}`}
      />
      <path className="avg" d={avgLine} />
      <path className="line" d={line} />
      <circle cx={lx} cy={ly} r="3" />
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
  const photo = [...entries].filter((e) => e.photoDataUrl).sort((a, b) => b.date.localeCompare(a.date))[0];
  const w = delta(entries, "weightKg", today);
  const waist = delta(entries, "waistCm", today);
  const arm = delta(entries, "armCm", today);
  const advice = bodyAdvice(entries, goal, sessions, today);

  if (!entries.length) {
    return (
      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Sem medidas ainda. Registre peso, cintura, braço e foto em Progresso → Biometria.
        </p>
        <Link to="/progresso" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm">
          Registrar medida <span className="arrow">&gt;</span>
        </Link>
      </section>
    );
  }

  return (
    <div className="stack">
      {pts.length >= 2 && (
        <section className="monitor" aria-label="Monitor do peso, 60 dias">
          <div className="monitor-head">
            <span>Monitor // peso · 60 d</span>
            <span>
              <b>{formatWeight(pts[pts.length - 1].kg)}</b> kg
            </span>
          </div>
          <MonitorChart points={pts} />
          <div className="monitor-foot">
            <span>{shortDate(pts[0].date)}</span>
            <span>{trend && trend.spanDays >= 6 ? `${signed(trend.kgPerWeek)} kg/sem` : "tendência: poucos dados"}</span>
            <span>{shortDate(pts[pts.length - 1].date)}</span>
          </div>
        </section>
      )}

      <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 6 }}>
        <h2 className="h-sec h-cut">Medidas</h2>
        <div className="lab-table">
          <span className="label">Item</span>
          <span className="label r">Atual</span>
          <span className="label r">Δ 28 d</span>
          {(
            [
              ["Peso", w, "kg"],
              ["Cintura", waist, "cm"],
              ["Braço", arm, "cm"],
            ] as const
          ).map(([name, v, u]) => (
            <div key={name} style={{ display: "contents" }}>
              <span>{name}</span>
              <span className="r num">{v.cur != null ? `${formatWeight(v.cur)} ${u}` : "—"}</span>
              <span className="r num">{v.d != null ? `${signed(v.d)} ${u}` : "—"}</span>
            </div>
          ))}
        </div>
        {goal && <span className="tiny faint">Meta da fase: {GOAL_LABEL[goal.mode].toLowerCase()}.</span>}
      </section>

      {photo && (
        <figure className="scan-photo">
          <img src={photo.photoDataUrl} alt={`Foto de ${shortDate(photo.date)}`} />
          <figcaption className="scan-tag r" style={{ top: "12%", ["--lead" as string]: "34px" }}>
            {shortDate(photo.date)}
            {photo.weightKg != null && (
              <>
                {" "}
                · <b>{formatWeight(photo.weightKg)} kg</b>
              </>
            )}
          </figcaption>
          {photo.armCm != null && (
            <span className="scan-tag l" style={{ top: "34%", ["--lead" as string]: "46px" }}>
              Braço <b>{formatWeight(photo.armCm)}</b>
            </span>
          )}
          {photo.waistCm != null && (
            <span className="scan-tag r" style={{ top: "55%", ["--lead" as string]: "46px" }}>
              Cintura <b>{formatWeight(photo.waistCm)}</b>
            </span>
          )}
        </figure>
      )}

      {advice.length > 0 && (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
          <h2 className="h-sec h-cut">Orientação do motor</h2>
          <NudgeList nudges={advice} />
        </section>
      )}

      <Link to="/progresso" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm">
        Registrar medida <span className="arrow">&gt;</span>
      </Link>
    </div>
  );
}
