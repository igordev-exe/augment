import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PRINCIPLES } from "../data/science";

// O Guia saiu da barra de abas e mora junto de Exercícios: um botão holográfico flutuante que abre um painel com
// atalhos para as seções mais consultadas e o Guia completo. Ciano e violeta (informação), nunca vermelho (R4).

/** Seis atalhos: grade exata de 2 × 3, sem célula sobrando (R7). Os ids são as seções do Guia. */
const SHORTCUTS = [
  { id: "carga", t: "Carga e reps" },
  { id: "falha", t: "Até onde ir" },
  { id: "volume", t: "Volume" },
  { id: "deload", t: "Deload" },
  { id: "dieta", t: "Recomposição" },
  { id: "ciencia", t: "Evidências" },
];

export function GuideHolo() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="holo-guide" ref={boxRef}>
      {open && (
        <div className="holo-panel" role="dialog" aria-label="Guia científico">
          <div className="holo-head">
            <span>Guia // base científica</span>
            <small>{PRINCIPLES.length} princípios</small>
          </div>
          <div className="holo-links">
            {SHORTCUTS.map((s, i) => (
              <Link key={s.id} ref={i === 0 ? firstRef : undefined} to={`/guia?s=${s.id}`}>
                {s.t}
              </Link>
            ))}
          </div>
          <Link to="/guia" className="holo-all">
            Abrir o Guia completo <span aria-hidden="true">›</span>
          </Link>
        </div>
      )}
      <button
        type="button"
        className={`holo-fab${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={open ? "Fechar o Guia" : "Abrir o Guia científico"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="holo-ring" aria-hidden="true" />
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          {open ? (
            <path d="m6 6 12 12M18 6 6 18" />
          ) : (
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20M9 8h7M9 12h5" />
          )}
        </svg>
        <span className="holo-label">Guia</span>
      </button>
    </div>
  );
}
