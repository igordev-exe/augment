import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { DAY_BY_ID } from "../data/program";
import type { StopKind } from "../data/types";
import { stopFor, WEEK_RULES } from "../lib/mesocycle";
import { Icon } from "./Icon";

export function StopBadge({ stop, week }: { stop: StopKind; week: number }) {
  const s = stopFor(stop, week);
  return <span data-augmented-ui="br-clip border" className={`stop-badge tone-${s.tone}`}>{s.label}</span>;
}

export function PageHead({
  title,
  sub,
  back,
  right,
  code,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: string;
  right?: ReactNode;
  /** Linha de telemetria acima do título, ex.: "AUG.OS // HISTÓRICO". */
  code?: string;
}) {
  return (
    <header className="page-head">
      <div className="grow">
        {back && (
          <Link to={back} className="back">
            <Icon name="back" size={16} /> Voltar
          </Link>
        )}
        {code && <div className="eyebrow">{code}</div>}
        <h1 className="h-page">{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

/** Faixa das 7 semanas do mesociclo (1–6 + deload). */
export function WeekStrip({ week, onPick }: { week: number; onPick?: (w: number) => void }) {
  return (
    <div className="weeks" role={onPick ? "group" : undefined} aria-label="Semanas do mesociclo">
      {[1, 2, 3, 4, 5, 6, 7].map((w) => {
        const cls = `w${w < week ? " past" : ""}${w === week ? " now" : ""}`;
        const label = w === 7 ? "D" : String(w);
        const title = WEEK_RULES[w].label;
        return onPick ? (
          <button key={w} type="button" data-augmented-ui="tl-clip br-clip border" className={cls} aria-pressed={w === week} title={title} onClick={() => onPick(w)}>
            {label}
          </button>
        ) : (
          <div key={w} data-augmented-ui="tl-clip br-clip border" className={cls} title={title} aria-current={w === week ? "step" : undefined}>
            {label}
          </div>
        );
      })}
    </div>
  );
}

export function dayName(dayId: string): string {
  return DAY_BY_ID[dayId]?.name ?? dayId;
}

export function dayCode(dayId: string): string {
  return DAY_BY_ID[dayId]?.code ?? "?";
}
