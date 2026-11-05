import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Módulo colapsável no estilo "subsistema": barra com código, título, leitura resumida e LED. Ao abrir, a gaveta desce
// com uma varredura e o conteúdo "liga". O estado aberto/fechado fica salvo no aparelho. O conteúdo só monta na
// primeira abertura (gráficos e listas longas não pesam enquanto o módulo está fechado).

const KEY = (id: string) => `aug.mod.${id}`;

function readOpen(id: string): boolean {
  try {
    return localStorage.getItem(KEY(id)) === "1";
  } catch {
    return false;
  }
}

export function SysModule({
  id,
  code,
  title,
  hint,
  meta,
  tone = "cyan",
  children,
}: {
  id: string;
  code: string;
  title: string;
  hint?: string;
  /** Leitura curta mostrada na barra (ex.: "92,6 kg", "7/20"). */
  meta?: ReactNode;
  tone?: "cyan" | "red" | "green" | "amber";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id));
  const [mounted, setMounted] = useState(open);
  const bodyId = useId();
  const drawer = useRef<HTMLDivElement>(null);

  // Fechado, a gaveta fica fora do foco e do leitor de tela (React 18 não repassa "inert" como prop).
  useEffect(() => {
    drawer.current?.toggleAttribute("inert", !open);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setMounted(true);
    try {
      localStorage.setItem(KEY(id), next ? "1" : "0");
    } catch {
      /* armazenamento indisponível: só não lembra */
    }
  }

  return (
    <section className={`sysmod tone-${tone}${open ? " open" : ""}`}>
      <button type="button" className="sysmod-bar" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
        <span className="sysmod-code">{code}</span>
        <span className="sysmod-title">
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </span>
        {meta != null && <span className="sysmod-meta">{meta}</span>}
        <span className="sysmod-led" aria-hidden="true" />
        <span className="sysmod-chev" aria-hidden="true" />
        <i className="sysmod-load" aria-hidden="true" />
      </button>
      <div className="sysmod-drawer" id={bodyId} ref={drawer}>
        <div className="sysmod-inner">
          <div className="sysmod-content">{mounted && children}</div>
        </div>
      </div>
    </section>
  );
}

/** Cabeçalho do grupo de módulos. */
export function SysModuleGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div className="sysmod-group">
      <div className="sysmod-group-head">
        <span>{label}</span>
        <i aria-hidden="true" />
        <b>{String(count).padStart(2, "0")} MÓDULOS</b>
      </div>
      {children}
    </div>
  );
}
