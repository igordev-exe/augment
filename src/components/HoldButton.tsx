import { useEffect, useRef, useState, type ReactNode } from "react";
import { vibrate } from "../lib/native";

// Segurar para confirmar: ações difíceis de desfazer pedem o dedo parado ~0,8 s em vez de um toque.
// Evita toque acidental com a mão suada na academia. Funciona com dedo, mouse e teclado (segurar Espaço/Enter).

export function HoldButton({
  onConfirm,
  children,
  className = "",
  ms = 800,
  label,
}: {
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  ms?: number;
  /** Texto para leitores de tela (o visual já diz "segure"). */
  label?: string;
}) {
  const [p, setP] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef<number>();
  const fired = useRef(false);

  function tick() {
    if (start.current == null) return;
    const v = Math.min(1, (performance.now() - start.current) / ms);
    setP(v);
    if (v >= 1 && !fired.current) {
      fired.current = true;
      start.current = null;
      vibrate(30);
      onConfirm();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }

  function down() {
    if (start.current != null) return;
    fired.current = false;
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }

  function up() {
    start.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    if (!fired.current) setP(0);
  }

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  return (
    <button
      type="button"
      data-augmented-ui="tl-clip br-clip border"
      className={`btn hold ${className}`}
      style={{ ["--hold" as string]: p }}
      aria-label={label ? `${label} (segure para confirmar)` : undefined}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* ponteiro sem captura (ex.: evento sintético): segue sem */
        }
        down();
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          down();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") up();
      }}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-text">{children}</span>
      <span className="hold-hint" aria-hidden="true">
        {p > 0 && p < 1 ? "segure…" : "segure"}
      </span>
    </button>
  );
}
