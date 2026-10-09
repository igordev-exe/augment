import { useEffect, useState } from "react";
import { formatClock } from "../lib/dates";
import { useTimer } from "../lib/timer";

export function TimerBar() {
  const { state, add, stop } = useTimer();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state]);

  if (!state) return null;
  const left = (state.endAt - now) / 1000;
  const over = left <= 0;
  const pct = Math.min(100, Math.max(0, (1 - left / state.total) * 100));

  return (
    <div className="timer" role="timer" aria-live="off">
      <div data-augmented-ui="tl-clip br-clip border" className={`timer-inner${over ? " over" : ""}`}>
        <div className="timer-clock">{over ? `+${formatClock(-left)}` : formatClock(left)}</div>
        <div className="grow timer-label">
          {over ? "Descanso acabou. Próxima série." : "Descanso"}
          <br />
          <span>{state.label}</span>
        </div>
        {!over && (
          <button type="button" onClick={() => add(15)} aria-label="Mais 15 segundos">
            +15
          </button>
        )}
        <button type="button" onClick={stop}>
          {over ? "Ok" : "Pular"}
        </button>
        <div className="timer-progress" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
