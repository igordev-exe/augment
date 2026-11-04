import { useEffect, useRef, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";

// Menu circular de ações rápidas: segure o número da série e escolha com o polegar.

export interface RadialAction {
  id: string;
  label: string;
  /** Tom do botão: padrão, ação (vermelho), ok (verde), atenção (âmbar). */
  tone?: "action" | "ok" | "warn";
  disabled?: boolean;
  onPick: () => void;
}

/** Gesto de segurar (padrão 450 ms). Cancela se o dedo andar mais de 10 px (é rolagem). */
export function useLongPress(onLong: () => void, ms = 450) {
  const t = useRef<number>();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    window.clearTimeout(t.current);
    origin.current = null;
  };
  return {
    onPointerDown: (e: RPointerEvent) => {
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      t.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(15);
        onLong();
      }, ms);
    },
    onPointerMove: (e: RPointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    /** Depois de um toque longo, o clique que vem junto não deve disparar outra coisa. */
    consumedClick: () => {
      const f = fired.current;
      fired.current = false;
      return f;
    },
  };
}

export function RadialMenu({
  title,
  sub,
  actions,
  onClose,
}: {
  title: string;
  sub?: string;
  actions: RadialAction[];
  onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const n = actions.length;
  return createPortal(
    <div className="radial-backdrop" role="dialog" aria-modal="true" aria-label={`Ações: ${title}`} onClick={onClose}>
      <div className="radial" onClick={(e) => e.stopPropagation()}>
        <svg className="radial-ring" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="118" />
          <circle cx="150" cy="150" r="62" />
          {actions.map((_, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
            return (
              <line
                key={i}
                x1={150 + Math.cos(a) * 62}
                y1={150 + Math.sin(a) * 62}
                x2={150 + Math.cos(a) * 118}
                y2={150 + Math.sin(a) * 118}
              />
            );
          })}
        </svg>
        <button type="button" className="radial-core" onClick={onClose} aria-label="Fechar">
          <span className="radial-title">{title}</span>
          {sub && <span className="radial-sub">{sub}</span>}
          <span className="radial-x">fechar</span>
        </button>
        {actions.map((a, i) => {
          const ang = (i / n) * 360 - 90;
          return (
            <button
              key={a.id}
              ref={i === 0 ? first : undefined}
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className={`radial-item${a.tone ? ` ${a.tone}` : ""}`}
              style={{ ["--ang" as string]: `${ang}deg` }}
              disabled={a.disabled}
              onClick={() => {
                a.onPick();
                onClose();
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
