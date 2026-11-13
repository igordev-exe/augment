import { useEffect, useRef, useState } from "react";

// Número que conta até o valor (família "leitura", docs/plano-refino-visual.md seção 3A). Conta uma vez, quando entra
// na vista; depois, cada mudança de valor conta a partir do anterior. Com "reduzir movimento" ou efeitos no mínimo,
// mostra o valor final direto. O leitor de tela lê só o valor final.

const READ_MS = 500;

function motionOff(): boolean {
  if (typeof window === "undefined") return true;
  const root = document.documentElement.classList;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || root.contains("fx-min") || root.contains("fx-gym");
}

/** Curva seca, sem quique: equivale ao --ease-seco do CSS. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function Ticker({
  value,
  decimals = 0,
  format,
  className,
}: {
  value: number;
  decimals?: number;
  /** Formatação própria (unidade, sinal). O padrão é o número em pt-BR com `decimals` casas. */
  format?: (n: number) => string;
  className?: string;
}) {
  const fmt = format ?? ((n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number>(() => (motionOff() ? value : 0));
  const from = useRef<number | null>(null);
  const [seen, setSeen] = useState(false);

  // Só começa quando aparece na tela.
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (motionOff() || !("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    const start = from.current ?? 0;
    from.current = value;
    if (motionOff() || start === value) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / READ_MS);
      setShown(start + (value - start) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setShown(value);
    };
  }, [value, seen]);

  const factor = Math.pow(10, decimals);
  const rounded = Math.round(shown * factor) / factor;
  return (
    <span ref={ref} className={`ticker${className ? ` ${className}` : ""}`}>
      <span aria-hidden="true">{fmt(rounded)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  );
}
