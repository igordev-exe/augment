import { useEffect, useRef, useState } from "react";
import { formatClock } from "../lib/dates";
import { useSettings } from "../lib/hooks";
import { vibrate as buzz } from "../lib/native";
import { useTimer } from "../lib/timer";

// Barra do descanso. Dígitos em caixas de largura fixa (a Orbitron não tem algarismos tabulares: sem isso o relógio
// "treme" a cada segundo). Tocar no relógio leva até a série atual; quando o descanso acaba, a tela rola até ela
// sozinha e, se ninguém reagir em 15 s, vibra de novo.

function scrollToCurrentSet() {
  const row = document.querySelector<HTMLElement>(".ex.open .set:not(.done)") ?? document.querySelector<HTMLElement>(".ex.open");
  row?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function Clock({ text }: { text: string }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span key={i} className={/\d/.test(ch) ? "dg" : ch === "+" ? "sg" : "sep"}>
          {ch}
        </span>
      ))}
    </>
  );
}

export function TimerBar() {
  const { state, add, stop } = useTimer();
  const [now, setNow] = useState(Date.now());
  const wasOver = useRef(false);
  const [settings] = useSettings();
  const vibrate = settings.vibrate;

  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state]);

  const left = state ? (state.endAt - now) / 1000 : 0;
  const over = !!state && left <= 0;

  useEffect(() => {
    if (over && !wasOver.current) scrollToCurrentSet();
    wasOver.current = over;
  }, [over]);

  // Lembrete: 15 s depois do fim, se o descanso ainda está na tela, vibra mais uma vez.
  useEffect(() => {
    if (!over || !vibrate) return;
    const id = window.setTimeout(() => buzz([300, 150, 300]), 15_000);
    return () => window.clearTimeout(id);
  }, [over, vibrate]);

  if (!state) return null;
  const pct = Math.min(100, Math.max(0, (1 - left / state.total) * 100));
  // Rótulo "próxima\nexercício": em cima o estado e o exercício, embaixo, ao lado do relógio, a próxima série.
  const [head, tail] = state.label.includes("\n") ? state.label.split("\n") : [null, state.label];
  const nextParts = head ? head.split(" · ") : [];

  return (
    <div className="timer" role="timer" aria-live="off">
      <div data-augmented-ui="tl-clip br-clip border" className={`timer-inner scan${over ? " over" : ""}`}>
        <span className="timer-top">
          <b>{over ? "Descanso acabou" : "Descanso"}</b>
          {tail && <> · {tail}</>}
        </span>
        <div className="timer-row">
          <button type="button" className="timer-clock" onClick={scrollToCurrentSet} aria-label="Ir para a série atual">
            <Clock text={over ? `+${formatClock(-left)}` : formatClock(left)} />
          </button>
          <span className="timer-next">
            {nextParts.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </span>
          {!over && (
            <>
              <button type="button" onClick={() => add(-15)} aria-label="Menos 15 segundos">
                −15
              </button>
              <button type="button" onClick={() => add(15)} aria-label="Mais 15 segundos">
                +15
              </button>
            </>
          )}
          <button type="button" className="timer-skip" onClick={stop}>
            {over ? "Ok" : "Pular"}
          </button>
        </div>
        <div className="timer-progress" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
