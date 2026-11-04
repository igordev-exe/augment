import type { Session } from "../data/types";
import { hudSegments } from "../lib/hud";

// Barra fixa no topo do treino: uma casa por série (feita, próxima, a fazer), contagem e tempo.

export function SessionHud({ session, code, now }: { session: Session; code: string; now: number }) {
  const segs = hudSegments(session);
  const done = segs.filter((s) => s.state === "done").length;
  const min = Math.max(0, Math.round((now - session.startedAt) / 60000));
  return (
    <div className="hud" role="group" aria-label={`Progresso do treino: ${done} de ${segs.length} séries, ${min} minutos`}>
      <div className="hud-top" aria-hidden="true">
        <span className="hud-code">{code}</span>
        <span className="hud-count">
          SÉRIES <b>{done}</b>/{segs.length}
        </span>
        <span className="hud-time">{min} MIN</span>
      </div>
      <div className="hud-bar" aria-hidden="true">
        {segs.map((s) => (
          <span key={s.setId} className={`seg ${s.state}${s.drop ? " drop" : ""}${s.first ? " first" : ""}`} />
        ))}
      </div>
    </div>
  );
}
