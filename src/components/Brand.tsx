import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BARBELL,
  BOOT_MODULES,
  BRAND_CYAN,
  BRAND_RED,
  CORE_A,
  RING_SEGMENTS,
  RING_STROKE,
  WORDMARK_LETTERS,
  WORDMARK_STROKE,
  WORDMARK_VIEWBOX,
  type BootMode,
} from "../lib/brand";

/** Símbolo "Núcleo": anilha de 8 módulos + A cujo travessão é uma barra com anilhas. */
export function BrandMark({ className = "brand-mark", mono = false }: { className?: string; mono?: boolean }) {
  const main = mono ? "currentColor" : BRAND_RED;
  const acc = mono ? "currentColor" : BRAND_CYAN;
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <g fill="none" strokeWidth={RING_STROKE}>
        {RING_SEGMENTS.map((d, i) => (
          <path key={d} d={d} stroke={i === 0 ? acc : main} />
        ))}
      </g>
      <g fill={main}>
        <path d={CORE_A} />
        {BARBELL.map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />
        ))}
      </g>
    </svg>
  );
}

/** Logotipo "AUGMENT" desenhado (não é fonte): mesma grade e mesmo chanfro do símbolo. */
export function Wordmark({ className = "brand-word" }: { className?: string }) {
  return (
    <svg className={className} viewBox={WORDMARK_VIEWBOX} role="img" aria-label="AUGMENT">
      <g fill="none" stroke="currentColor" strokeWidth={WORDMARK_STROKE}>
        {WORDMARK_LETTERS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

// Linha do tempo do boot completo (segundos). O curto usa a mesma sequência comprimida (K_SHORT).
const SEG_START = 0.3;
const SEG_STEP = 0.17;
const A_AT = 1.75;
const BAR_AT = 1.95;
const WORD_AT = 2.25;
const WORD_STEP = 0.09;
const TAG_AT = 3.0;
const ONLINE_AT = 3.25;
const END_AT = 3.6;
const K_SHORT = 0.36;

const sec = (s: number) => `${s.toFixed(3)}s`;

/**
 * Inicialização do sistema: cada módulo carregado acende um segmento da anilha; com os 8 online, o A entra com
 * glitch, a barra abre, o nome se desenha e o app libera. Um toque pula.
 */
export function BootScreen({ mode, onDone }: { mode: Exclude<BootMode, "none">; onDone: () => void }) {
  const k = mode === "full" ? 1 : K_SHORT;
  const [leaving, setLeaving] = useState(false);
  const pctRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    window.setTimeout(onDone, 220);
  };

  useEffect(() => {
    const total = ONLINE_AT * k * 1000;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / total);
      const eased = 1 - (1 - p) * (1 - p);
      if (pctRef.current) pctRef.current.textContent = `${String(Math.round(eased * 100)).padStart(3, "0")}%`;
      if (barRef.current) barRef.current.style.width = `${(eased * 100).toFixed(1)}%`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const end = window.setTimeout(finish, END_AT * k * 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vars = { "--k": k } as CSSProperties;
  const d = (s: number) => ({ "--d": sec(s * k) }) as CSSProperties;

  return (
    <div className={`boot${leaving ? " leaving" : ""}`} style={vars} role="status" aria-label="Iniciando o AUGMENT" onClick={finish}>
      <div className="boot-top" aria-hidden="true">
        <span>AUG.OS // BOOT 2.0</span>
        <span>{mode === "full" ? "INICIALIZAÇÃO" : "RETOMADA"}</span>
      </div>
      <div className="boot-center">
        <svg className="boot-mark" viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" strokeWidth={RING_STROKE}>
            {RING_SEGMENTS.map((p, i) => (
              <path
                key={p}
                className="boot-seg"
                pathLength={1}
                d={p}
                stroke={i === 0 ? BRAND_CYAN : BRAND_RED}
                style={d(SEG_START + i * SEG_STEP)}
              />
            ))}
          </g>
          <path className="boot-a" d={CORE_A} fill={BRAND_RED} style={d(A_AT)} />
          <g className="boot-bar" fill={BRAND_RED} style={d(BAR_AT)}>
            {BARBELL.map(([x, y, w, h]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />
            ))}
          </g>
        </svg>
        <svg className="boot-word" viewBox={WORDMARK_VIEWBOX} role="img" aria-label="AUGMENT">
          <g fill="none" stroke="currentColor" strokeWidth={WORDMARK_STROKE}>
            {WORDMARK_LETTERS.map((p, i) => (
              <path key={p} className="boot-letter" pathLength={1} d={p} style={d(WORD_AT + i * WORD_STEP)} />
            ))}
          </g>
        </svg>
        <span className="boot-tag" style={d(TAG_AT)}>
          HUMAN PERFORMANCE SYSTEM
        </span>
        <div className="boot-modules" aria-hidden="true">
          {BOOT_MODULES.map((m, i) => (
            <div key={m} style={d(SEG_START + i * SEG_STEP)}>
              <span>
                {String(i + 1).padStart(2, "0")} {m}
              </span>
              <b>ONLINE</b>
            </div>
          ))}
        </div>
      </div>
      <div className="boot-bottom">
        <div className="boot-progress" aria-hidden="true">
          <i ref={barRef} />
        </div>
        <div className="boot-status">
          <span className="boot-online" style={d(ONLINE_AT)}>
            SISTEMA ONLINE
          </span>
          <span ref={pctRef} className="boot-pct" aria-hidden="true">
            000%
          </span>
        </div>
        <button type="button" className="boot-skip" onClick={finish}>
          Pular
        </button>
      </div>
    </div>
  );
}
