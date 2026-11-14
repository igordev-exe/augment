import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { avatarSrc } from "../data/personas";
import { BUBBLE_SENDER, type BubbleItem } from "../lib/bubble";
import { playReward } from "../lib/fx";

// Balão do núcleo: o desenho do aviso flutuante (avatar da persona, faixa de título, cor do tom, botões).
// A fila e o tempo ficam no ToastProvider (lib/hooks.tsx) e em lib/bubble.ts; aqui só se desenha.

/** Elementos fixos no rodapé: o balão para logo acima do mais alto deles. */
const FLOOR = ".nav, .timer-inner, .cx-compose-wrap";

function floorGap(): number {
  if (typeof document === "undefined") return 0;
  let top = window.innerHeight;
  document.querySelectorAll<HTMLElement>(FLOOR).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top < top) top = r.top;
  });
  return Math.max(0, window.innerHeight - top);
}

export function CoreBubble({
  item,
  persona,
  leaving,
  paused,
  duration,
  onClose,
  onPause,
  onResume,
}: {
  item: BubbleItem;
  persona: string | undefined;
  leaving: boolean;
  paused: boolean;
  duration: number;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [bottom, setBottom] = useState(0);
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  useLayoutEffect(() => {
    const place = () => setBottom(floorGap());
    place();
    window.addEventListener("resize", place);
    // A TimerBar pode aparecer com o balão já na tela.
    const id = window.setInterval(place, 1_000);
    return () => {
      window.removeEventListener("resize", place);
      window.clearInterval(id);
    };
  }, [item.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (item.tone === "reward") playReward(el);
    if (item.actions.length) el.querySelector<HTMLButtonElement>(".cb-act")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const danger = item.tone === "danger";
  return (
    <div
      ref={ref}
      className={`core-bubble tone-${item.tone}${leaving ? " is-leaving" : ""}`}
      style={{
        bottom: `calc(${bottom}px + var(--sp-3))`,
        ...(dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.2, 1 - Math.abs(dx) / 200) } : null),
      }}
      role={danger ? "alert" : "status"}
      aria-live={danger ? "assertive" : "polite"}
      // Dedo em cima pausa; arrastar para o lado fecha; tocar (sem botões) fecha.
      onPointerDown={(e) => {
        startX.current = e.clientX;
        onPause();
      }}
      onPointerMove={(e) => startX.current != null && setDx(e.clientX - startX.current)}
      onPointerUp={() => {
        const swiped = Math.abs(dx) > 64;
        startX.current = null;
        setDx(0);
        if (swiped) onClose();
        else onResume();
      }}
      onPointerCancel={() => {
        startX.current = null;
        setDx(0);
        onResume();
      }}
      onClick={() => !item.actions.length && Math.abs(dx) < 8 && onClose()}
    >
      <div className="cb-body" data-augmented-ui="tl-clip br-clip border">
        <span className="cb-avatar" aria-hidden="true">
          <img src={avatarSrc(persona)} alt="" width={40} height={40} />
        </span>
        <div className="cb-main">
          <b className="cb-title" aria-hidden="true">
            {item.title}
          </b>
          <span className="sr-only">{BUBBLE_SENDER}: </span>
          <p className="cb-text">{item.text}</p>
          {item.actions.length > 0 && (
            <div className="cb-actions">
              {item.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className={`cb-act${a.primary ? " primary" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    a.onPress();
                    onClose();
                  }}
                >
                  {a.label}
                </button>
              ))}
              {item.actions.length === 1 && (
                <button
                  type="button"
                  className="cb-act cb-close"
                  aria-label="Fechar aviso"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                >
                  OK
                </button>
              )}
            </div>
          )}
        </div>
        {!item.sticky && !item.actions.length && (
          <i
            className="cb-life"
            style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

/** "Digitando…": o treinador com chave está respondendo. */
export function CoreTyping({ persona }: { persona: string | undefined }) {
  const [bottom, setBottom] = useState(0);
  useLayoutEffect(() => setBottom(floorGap()), []);
  return (
    <div className="core-bubble tone-info is-typing" style={{ bottom: `calc(${bottom}px + var(--sp-3))` }} role="status" aria-live="polite">
      <div className="cb-body" data-augmented-ui="tl-clip br-clip border">
        <span className="cb-avatar" aria-hidden="true">
          <img src={avatarSrc(persona)} alt="" width={40} height={40} />
        </span>
        <div className="cb-main">
          <b className="cb-title" aria-hidden="true">
            {`${BUBBLE_SENDER} // TREINADOR`}
          </b>
          <p className="cb-text cb-dots">
            <span className="sr-only">O treinador está respondendo</span>
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
          </p>
        </div>
      </div>
    </div>
  );
}
