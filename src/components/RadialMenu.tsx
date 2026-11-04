import { useEffect, useRef, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";

// Roda de ações rápidas: segure o número da série e escolha com o polegar. Cada ação é uma fatia do anel;
// ações que não se aplicam agora saem da roda (nada de fatia apagada ou buraco).

export interface RadialAction {
  id: string;
  label: string;
  /** Tom da fatia: padrão, ação (vermelho), ok (verde), atenção (âmbar). */
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

const C = 150;
const R_IN = 62;
const R_OUT = 134;
const GAP_DEG = 3;

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))] as const;

/** Fatia de anel entre os ângulos a0 e a1 (graus, 0 = direita, sentido horário). */
function wedge(a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(R_OUT, a0);
  const [x1, y1] = pt(R_OUT, a1);
  const [x2, y2] = pt(R_IN, a1);
  const [x3, y3] = pt(R_IN, a0);
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3} Z`;
}

/** Quebra o rótulo em até duas linhas pelo espaço do meio. */
function lines(label: string): string[] {
  if (label.length <= 9 || !label.includes(" ")) return [label];
  const words = label.split(" ");
  let best = [label];
  let diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    if (Math.abs(a.length - b.length) < diff) {
      diff = Math.abs(a.length - b.length);
      best = [a, b];
    }
  }
  return best;
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
  const live = actions.filter((a) => !a.disabled);
  const first = useRef<SVGGElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const n = live.length;
  const step = 360 / n;
  const start = -90 - step / 2;
  const pick = (a: RadialAction) => {
    a.onPick();
    onClose();
  };

  return createPortal(
    <div className="radial-backdrop" role="dialog" aria-modal="true" aria-label={`Ações: ${title}`} onClick={onClose}>
      <svg className="wheel" viewBox="0 0 300 300" onClick={(e) => e.stopPropagation()}>
        <circle className="wheel-halo" cx={C} cy={C} r={R_OUT + 9} />
        {Array.from({ length: 48 }, (_, i) => {
          const a = i * 7.5;
          const [x0, y0] = pt(R_OUT + 5, a);
          const [x1, y1] = pt(R_OUT + (i % 4 === 0 ? 13 : 9), a);
          return <line key={i} className="wheel-tick" x1={x0} y1={y0} x2={x1} y2={y1} />;
        })}
        {live.map((a, i) => {
          const a0 = start + i * step + GAP_DEG / 2;
          const a1 = start + (i + 1) * step - GAP_DEG / 2;
          const mid = (a0 + a1) / 2;
          const [lx, ly] = pt((R_IN + R_OUT) / 2, mid);
          const [ix, iy] = pt(R_OUT - 11, mid);
          const ls = lines(a.label);
          return (
            <g
              key={a.id}
              ref={i === 0 ? first : undefined}
              className={`wheel-slice${a.tone ? ` ${a.tone}` : ""}`}
              role="button"
              tabIndex={0}
              aria-label={a.label}
              onClick={() => pick(a)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(a);
                }
              }}
            >
              <path d={wedge(a0, a1)} />
              <text className="wheel-idx" x={ix} y={iy} textAnchor="middle" dominantBaseline="middle">
                {String(i + 1).padStart(2, "0")}
              </text>
              <text className="wheel-label" x={lx} y={ly + (ls.length > 1 ? -6 : 0)} textAnchor="middle" dominantBaseline="middle">
                {ls.map((l, k) => (
                  <tspan key={k} x={lx} dy={k ? 13 : 0}>
                    {l}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <g className="wheel-hub" role="button" tabIndex={0} aria-label="Fechar" onClick={onClose}>
          <circle cx={C} cy={C} r={R_IN - 8} />
          <text className="hub-title" x={C} y={C - 8} textAnchor="middle" dominantBaseline="middle">
            {title}
          </text>
          {sub && (
            <text className="hub-sub" x={C} y={C + 12} textAnchor="middle" dominantBaseline="middle">
              {sub}
            </text>
          )}
          <text className="hub-x" x={C} y={C + 28} textAnchor="middle" dominantBaseline="middle">
            FECHAR
          </text>
        </g>
      </svg>
    </div>,
    document.body,
  );
}
