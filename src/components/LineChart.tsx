import { useEffect, useId, useRef, useState } from "react";

// Gráfico de linha holográfico em SVG puro: grade tracejada, área com degradê sob a primeira série, linha com brilho
// que se desenha ao abrir, retícula ao tocar/passar o dedo e etiqueta no último valor.

export interface Series {
  name: string;
  /** Cor: nome de variável CSS ("--chart-1"), "var(--x)" ou uma cor literal. */
  color: string;
  values: (number | null)[];
  /** Linha de referência (meta): tracejada, sem pontos nem área. */
  dashed?: boolean;
}

const paint = (c: string) => (c.startsWith("--") ? `var(${c})` : c);

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
  const uid = useId().replace(/:/g, "");
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

  const pad = { l: 36, r: 48, t: 14, b: 24 };
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
  const showDots = n <= 24;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = n === 1 ? 0 : Math.round(((px - pad.l) / w) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const xLabelIdx = n <= 2 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1];
  const vCols = Array.from({ length: 9 }, (_, i) => pad.l + (i / 8) * w);

  return (
    <div className="chart holo" ref={ref}>
      <i className="holo-corner tl" aria-hidden="true" />
      <i className="holo-corner tr" aria-hidden="true" />
      <i className="holo-corner bl" aria-hidden="true" />
      <i className="holo-corner br" aria-hidden="true" />
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
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.name} id={`${uid}-g${si}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={paint(s.color)} stopOpacity="0.32" />
              <stop offset="1" stopColor={paint(s.color)} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {vCols.map((vx, i) => (
          <line key={i} className="holo-vgrid" x1={vx} x2={vx} y1={pad.t} y2={pad.t + h} />
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line className="holo-grid" x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="holo-axis">
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
            className="holo-axis"
          >
            {labels[i]}
          </text>
        ))}
        {series.map((s, si) => {
          const color = paint(s.color);
          const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)));
          const d = pts.reduce((acc, p, i) => {
            if (!p) return acc;
            const prev = pts[i - 1];
            return acc + `${prev ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
          }, "");
          const valid = pts.filter((p): p is readonly [number, number] => p != null);
          const area =
            !s.dashed && si === 0 && valid.length > 1
              ? `${d}L${valid[valid.length - 1][0].toFixed(1)},${pad.t + h}L${valid[0][0].toFixed(1)},${pad.t + h}Z`
              : null;
          const lastI =
            s.values
              .map((v, i) => (v == null ? -1 : i))
              .filter((i) => i >= 0)
              .pop() ?? -1;
          const last = lastI >= 0 ? s.values[lastI]! : null;
          const label = last != null ? format(last) : "";
          return (
            <g key={s.name} className={`holo-series${s.dashed ? " dashed" : ""}`} style={{ color }}>
              {area && <path className="holo-area" d={area} fill={`url(#${uid}-g${si})`} />}
              <path className="holo-line" d={d} pathLength={s.dashed ? undefined : 1} stroke={color} />
              {showDots &&
                !s.dashed &&
                pts.map((p, i) =>
                  p ? (
                    <rect
                      key={i}
                      className="holo-dot"
                      x={p[0] - (hover === i ? 4 : 2.5)}
                      y={p[1] - (hover === i ? 4 : 2.5)}
                      width={hover === i ? 8 : 5}
                      height={hover === i ? 8 : 5}
                      transform={`rotate(45 ${p[0]} ${p[1]})`}
                      fill={color}
                    />
                  ) : null,
                )}
              {last != null && !s.dashed && (
                <g className="holo-head">
                  <circle className="holo-ping" cx={x(lastI)} cy={y(last)} r={4} stroke={color} />
                  <circle cx={x(lastI)} cy={y(last)} r={3} fill={color} />
                </g>
              )}
              {last != null && (
                <g className="holo-tag" transform={`translate(${x(lastI) + 7} ${y(last)})`}>
                  <path d={`M0 0 L6 -8 H${label.length * 7 + 14} V8 H6 Z`} stroke={color} />
                  <text x={10} dy="0.34em" fill={color}>
                    {label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {hover != null && (
          <g className="holo-cross">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} />
            {series.map((s) =>
              s.values[hover] != null && !s.dashed ? (
                <g key={s.name} transform={`translate(${x(hover)} ${y(s.values[hover]!)})`}>
                  <circle r={7} />
                  <path d="M-12 0H-8M8 0H12M0 -12V-8M0 8V12" />
                </g>
              ) : null,
            )}
          </g>
        )}
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
                <i style={{ display: "inline-block", width: 8, height: 8, background: paint(s.color), marginRight: 6 }} />
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
            <span key={s.name} className={s.dashed ? "dashed" : undefined}>
              <i style={{ background: paint(s.color), color: paint(s.color) }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
