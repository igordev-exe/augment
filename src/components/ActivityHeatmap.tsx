import { useEffect, useRef, useState, type CSSProperties } from "react";
import { addDays, fromISO, longDate, monthName } from "../lib/dates";
import type { ActivityGrid } from "../lib/visual";
import { dayName } from "./bits";

// Mapa de atividade do ano: uma coluna por semana (seg → dom), um quadrado por dia.

const CELL = 11;
const STEP = 14;
const LEFT = 22;
const TOP = 16;
const OPACITY = [0, 0.3, 0.55, 0.8, 1];

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
          <svg width={width} height={height} role="img" aria-label="Treinos por dia nas últimas 53 semanas">
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

      <div className="spread tiny muted">
        <span>{picked ? longDate(picked) : "Toque num dia para ver o treino."}</span>
        <span className="hm-scale" aria-hidden="true">
          menos
          {OPACITY.map((o, i) => (
            <i key={i} className={i ? "" : "off"} style={i ? { opacity: o } : undefined} />
          ))}
          mais
        </span>
      </div>
      {picked && (
        <p className="small" style={{ margin: 0 }}>
          {pick
            ? `${pick.dayIds.map(dayName).join(" + ")} · ${pick.sets} séries · ${Math.round(pick.volumeKg).toLocaleString("pt-BR")} kg`
            : "Sem treino neste dia."}
        </p>
      )}
    </div>
  );
}
