import { useEffect, useRef, useState } from "react";

// Gráfico de linha em SVG puro: um eixo só, grade discreta, tooltip ao tocar/passar o dedo.

export interface Series {
  name: string;
  /** Variável CSS da cor, ex.: "--chart-1". */
  color: string;
  values: (number | null)[];
}

export function LineChart({
  labels,
  series,
  unit,
  height = 200,
  format = (v: number) => String(Math.round(v * 10) / 10).replace(".", ","),
}: {
  labels: string[];
  series: Series[];
  unit: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (!all.length || labels.length === 0) return null;

  const pad = { l: 36, r: 44, t: 12, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 5;
    max += 5;
  }
  const span = max - min;
  min = Math.max(0, min - span * 0.12);
  max = max + span * 0.12;

  // Ticks "redondos"
  const rawStep = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? rawStep;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(Number(v.toFixed(4)));

  const n = labels.length;
  const x = (i: number) => pad.l + (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => pad.t + h - ((v - min) / (max - min)) * h;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = n === 1 ? 0 : Math.round(((px - pad.l) / w) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const xLabelIdx = n <= 2 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`Gráfico: ${series.map((s) => s.name).join(" e ")}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {format(t)}
            </text>
          </g>
        ))}
        {xLabelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--ink-3)"
          >
            {labels[i]}
          </text>
        ))}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)));
          const d = pts.reduce((acc, p, i) => {
            if (!p) return acc;
            const prev = pts[i - 1];
            return acc + `${prev ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
          }, "");
          const lastI =
            s.values
              .map((v, i) => (v == null ? -1 : i))
              .filter((i) => i >= 0)
              .pop() ?? -1;
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={`var(${s.color})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) =>
                p ? (
                  <circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r={hover === i ? 5 : 3.5}
                    fill={`var(${s.color})`}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ) : null,
              )}
              {lastI >= 0 && (
                <text x={x(lastI) + 8} y={y(s.values[lastI]!)} dy="0.32em" fontSize={11.5} fontWeight={600} fill="var(--ink-2)">
                  {format(s.values[lastI]!)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="tip"
          style={{
            left: `${(x(hover) / width) * 100}%`,
            transform: `translateX(${hover > n / 2 ? "-105%" : "5%"})`,
          }}
        >
          <div className="faint tiny">{labels[hover]}</div>
          {series.map((s) =>
            s.values[hover] != null ? (
              <div key={s.name}>
                <i
                  style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: `var(${s.color})`, marginRight: 6 }}
                />
                {s.name}:{" "}
                <strong>
                  {format(s.values[hover]!)} {unit}
                </strong>
              </div>
            ) : null,
          )}
        </div>
      )}
      {series.length > 1 && (
        <div className="legend" style={{ marginTop: 6 }}>
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: `var(${s.color})` }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
