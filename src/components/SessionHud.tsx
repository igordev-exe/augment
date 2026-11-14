import type { Session } from "../data/types";
import type { Cue } from "../lib/core/director";
import { hudSegments } from "../lib/hud";

// Barra fixa no topo do treino: uma casa por série (feita, próxima, a fazer), contagem e tempo, e embaixo a única
// fala do núcleo ao vivo (meta da próxima série, ou uma correção quando algo saiu do alvo).

export function SessionHud({ session, code, now, cue }: { session: Session; code: string; now: number; cue?: Cue | null }) {
  const segs = hudSegments(session);
  const done = segs.filter((s) => s.state === "done").length;
  const min = Math.max(0, Math.round((now - session.startedAt) / 60000));
  const tone =
    !cue || cue.meta ? "meta" : cue.priority === 0 ? "alerta" : cue.priority === 1 ? "ajuste" : cue.priority === 3 ? "bom" : "meta";
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
      <p className={`hud-cue hud-cue-${tone}`} aria-live="polite">
        {cue?.text ?? ""}
      </p>
    </div>
  );
}
