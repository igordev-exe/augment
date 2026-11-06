import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { addDays, fromISO, longDate, monthName } from "../lib/dates";
import type { ActivityGrid } from "../lib/visual";
import { dayName } from "./bits";

// Mapa de atividade do ano: uma coluna por semana (seg → dom), um quadrado por dia.
// As células são pequenas (11 px) para caber o ano; a alternativa de toque são os botões ‹ › de 44 px abaixo,
// e pelo teclado o mapa aceita as setas (← → semana, ↑ ↓ dia).

const CELL = 11;
const STEP = 14;
const LEFT = 22;
const TOP = 16;
/** Opacidade por nível: o nível 1 já fica a ≥ 3:1 da célula vazia. */
const OPACITY = [0, 0.5, 0.68, 0.85, 1];

export function ActivityHeatmap({ grid, today }: { grid: ActivityGrid; today: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);

  // Abre já mostrando as semanas mais recentes (à direita).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [grid.weeks.length]);

  const width = LEFT + grid.weeks.length * STEP;
  const height = TOP + 7 * STEP;
  const first = grid.weeks[0] ?? today;

  // Mantém o dia escolhido à vista quando muda pelos botões ou pelo teclado.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !picked) return;
    const col = grid.weeks.findIndex((w) => picked >= w && picked < addDays(w, 7));
    if (col < 0) return;
    const x = LEFT + col * STEP;
    if (x < el.scrollLeft + LEFT || x > el.scrollLeft + el.clientWidth - STEP) el.scrollLeft = x - el.clientWidth / 2;
  }, [picked, grid.weeks]);

  function move(days: number) {
    const base = picked ?? today;
    let next = addDays(base, days);
    if (next > today) next = today;
    if (next < first) next = first;
    setPicked(next);
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    const step: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    if (e.key in step) {
      e.preventDefault();
      move(step[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setPicked(today);
    } else if (e.key === "Escape") {
      setPicked(null);
    }
  }

  // Rótulo do mês na primeira semana que começa nele.
  const months: { x: number; label: string }[] = [];
  let lastMonth = -1;
  grid.weeks.forEach((w, i) => {
    const m = fromISO(w).getMonth();
    if (m !== lastMonth) {
      if (i > 0 || fromISO(w).getDate() <= 7) months.push({ x: LEFT + i * STEP, label: monthName(m).slice(0, 3) });
      lastMonth = m;
    }
  });

  const pick = picked ? grid.days.get(picked) : undefined;

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="hm-holo">
        <i className="holo-corner tl" aria-hidden="true" />
        <i className="holo-corner tr" aria-hidden="true" />
        <i className="holo-corner bl" aria-hidden="true" />
        <i className="holo-corner br" aria-hidden="true" />
        <i className="hm-sweep" aria-hidden="true" />
        <div ref={scroller} className="hm-scroll holo-scroll">
          <svg
            width={width}
            height={height}
            role="application"
            tabIndex={0}
            aria-label="Treinos por dia nas últimas 53 semanas. Setas escolhem o dia: esquerda e direita mudam a semana, cima e baixo o dia."
            className="hm-svg"
            onKeyDown={onKey}
          >
            {months.map((m) => (
              <text key={m.x} x={m.x} y={10} className="hm-label">
                {m.label}
              </text>
            ))}
            {["S", "Q", "S"].map((d, i) => (
              <text key={i} x={0} y={TOP + (i * 2 + 1) * STEP - 3} className="hm-label">
                {d}
              </text>
            ))}
            {grid.weeks.map((w, col) =>
              Array.from({ length: 7 }, (_, row) => {
                const date = addDays(w, row);
                if (date > today) return null;
                const d = grid.days.get(date);
                const level = d?.level ?? 0;
                return (
                  <rect
                    key={date}
                    x={LEFT + col * STEP}
                    y={TOP + row * STEP}
                    width={CELL}
                    height={CELL}
                    className={`hm-cell${level ? ` lv${level}` : " off"}${picked === date ? " sel" : ""}${date === today ? " today" : ""}`}
                    style={{ ...(level ? { fillOpacity: OPACITY[level] } : {}), "--c": col } as CSSProperties}
                    onClick={() => setPicked(picked === date ? null : date)}
                  >
                    <title>{d ? `${date}: ${d.sets} séries` : date}</title>
                  </rect>
                );
              }),
            )}
          </svg>
        </div>
      </div>

      <div className="hm-nav">
        <button type="button" onClick={() => move(-1)} aria-label="Dia anterior">
          ‹
        </button>
        <span aria-live="polite">{picked ? longDate(picked) : "Toque num dia ou use ‹ ›"}</span>
        <button type="button" onClick={() => move(1)} aria-label="Próximo dia" disabled={picked === today}>
          ›
        </button>
      </div>
      <div className="spread tiny muted">
        {picked ? (
          <span className="small" style={{ color: "var(--ink)" }}>
            {pick
              ? `${pick.dayIds.map(dayName).join(" + ")} · ${pick.sets} séries · ${Math.round(pick.volumeKg).toLocaleString("pt-BR")} kg`
              : "Sem treino neste dia."}
          </span>
        ) : (
          <span />
        )}
        <span className="hm-scale" aria-hidden="true">
          menos
          {OPACITY.map((o, i) => (
            <i key={i} className={i ? "" : "off"} style={i ? { opacity: o } : undefined} />
          ))}
          mais
        </span>
      </div>
    </div>
  );
}
