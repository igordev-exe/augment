import { useEffect, useState } from "react";
import type { BodyEntry, BodyGoal, Settings } from "../data/types";
import { shortDate } from "../lib/dates";
import type { Nudge } from "../lib/engine";
import { formatWeight } from "../lib/progression";
import { GOAL_LABEL, goalStatus, weightTrend, type GoalPace } from "../lib/visual";
import { NudgeList } from "./NudgeList";

// Meta de peso corporal: direção, peso alvo, ritmo semanal contra a faixa recomendada e previsão.

const PACE: Record<GoalPace, { text: string; color: string }> = {
  "no-ritmo": { text: "No ritmo", color: "var(--ok)" },
  rapido: { text: "Rápido demais", color: "var(--warn)" },
  devagar: { text: "Devagar", color: "var(--warn)" },
  contrario: { text: "Sentido contrário", color: "var(--danger)" },
  "sem-dados": { text: "Poucos dados", color: "var(--ink-3)" },
};

const HINT: Record<BodyGoal["mode"], Partial<Record<GoalPace, string>>> = {
  ganhar: {
    rapido: "Acima de 0,5%/sem costuma vir com mais gordura que músculo. Tire um pouco de comida.",
    devagar: "Subindo, mas abaixo do ideal para ganhar massa. Some ~150–200 kcal por dia.",
    contrario: "O peso está caindo. Para ganhar massa, coma mais.",
  },
  perder: {
    rapido: "Acima de ~0,7%/sem arrisca perder músculo e força. Coma um pouco mais.",
    devagar: "Descendo, mas devagar. Um déficit um pouco maior ajuda.",
    contrario: "O peso está subindo. Revise o déficit.",
  },
  manter: {
    rapido: "Variando mais que 0,25%/sem. Ajuste a comida para estabilizar.",
  },
};

function signed(n: number, digits = 2): string {
  const v = Number(n.toFixed(digits));
  return `${v > 0 ? "+" : ""}${String(v).replace(".", ",")}`;
}

export function BodyGoalCard({
  entries,
  goal,
  onGoal,
  advice = [],
}: {
  entries: BodyEntry[];
  goal: BodyGoal | undefined;
  onGoal: (patch: Partial<Settings>) => void;
  /** Recados do motor (tabela de ajustes do plano alimentar). Quando há, substituem a dica genérica. */
  advice?: Nudge[];
}) {
  const trend = weightTrend(entries);
  const status = goalStatus(trend, goal);
  const [target, setTarget] = useState(goal?.targetKg != null ? formatWeight(goal.targetKg) : "");

  useEffect(() => {
    setTarget(goal?.targetKg != null ? formatWeight(goal.targetKg) : "");
  }, [goal?.targetKg]);

  function setMode(mode: BodyGoal["mode"] | null) {
    onGoal({ bodyGoal: mode ? { mode, targetKg: goal?.targetKg } : undefined });
  }

  function saveTarget() {
    if (!goal) return;
    const n = Number(target.replace(",", ".").trim());
    const targetKg = target.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
    if (targetKg !== goal.targetKg) onGoal({ bodyGoal: { ...goal, targetKg } });
  }

  return (
    <div data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 10, padding: 12 }}>
      <div className="row-wrap" style={{ gap: 6 }} role="group" aria-label="Meta de peso">
        {(Object.keys(GOAL_LABEL) as BodyGoal["mode"][]).map((m) => (
          <button key={m} type="button" className="mm-chip" aria-pressed={goal?.mode === m} onClick={() => setMode(m)}>
            {GOAL_LABEL[m]}
          </button>
        ))}
        {goal && (
          <button type="button" className="link-btn" onClick={() => setMode(null)}>
            Sem meta
          </button>
        )}
      </div>

      {goal && goal.mode !== "manter" && (
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <label className="label" htmlFor="goal-kg" style={{ margin: 0 }}>
            Peso alvo
          </label>
          <input
            id="goal-kg"
            className="input"
            inputMode="decimal"
            placeholder="opcional, ex.: 85"
            style={{ maxWidth: 140 }}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={saveTarget}
          />
          <span className="small muted">kg</span>
        </div>
      )}

      {trend ? (
        <div className="stats-grid">
          <div>
            <span className="label">Atual</span>
            <strong className="num">{formatWeight(trend.current)} kg</strong>
            <span className="tiny faint">{shortDate(trend.currentDate)}</span>
          </div>
          <div>
            <span className="label">Ritmo</span>
            <strong className="num">{trend.spanDays >= 6 ? `${signed(trend.kgPerWeek)} kg/sem` : "–"}</strong>
            <span className="tiny faint">
              {trend.spanDays >= 6 ? `${signed(trend.pctPerWeek)}%/sem · ${trend.spanDays} dias` : "pesar 2× em 1 semana"}
            </span>
          </div>
          {status && (
            <div>
              <span className="label">Status</span>
              <strong style={{ color: status.reached ? "var(--ok)" : PACE[status.pace].color }}>
                {status.reached ? "Meta alcançada" : PACE[status.pace].text}
              </strong>
              <span className="tiny faint">
                faixa {signed(status.range[0])} a {signed(status.range[1])}%/sem
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="small faint" style={{ margin: 0 }}>
          Registre o peso para ver o ritmo semanal.
        </p>
      )}

      {status && goal && !status.reached && status.remainingKg != null && (
        <p className="small" style={{ margin: 0 }}>
          Faltam <strong className="num">{formatWeight(Math.abs(status.remainingKg))} kg</strong> para {formatWeight(goal.targetKg!)} kg
          {status.etaWeeks != null ? ` · ~${status.etaWeeks} semana${status.etaWeeks === 1 ? "" : "s"} no ritmo atual` : ""}.
        </p>
      )}
      {advice.length > 0 && <NudgeList nudges={advice} />}
      {!advice.length && status && goal && !status.reached && HINT[goal.mode][status.pace] && (
        <p className="small muted" style={{ margin: 0 }}>
          {HINT[goal.mode][status.pace]}
        </p>
      )}
    </div>
  );
}
