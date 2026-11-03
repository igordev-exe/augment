import { useState } from "react";
import type { BodyEntry } from "../data/types";
import { daysBetween, shortDate } from "../lib/dates";
import { formatWeight } from "../lib/progression";

// Antes/depois com cortina arrastável e linha do tempo das fotos da biometria.

type Slot = "antes" | "depois";

function caption(e: BodyEntry): string {
  return `${shortDate(e.date)}${e.weightKg != null ? ` · ${formatWeight(e.weightKg)} kg` : ""}`;
}

export function PhotoCompare({ entries }: { entries: BodyEntry[] }) {
  const photos = entries.filter((e) => e.photoDataUrl).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot>("depois");
  const [pos, setPos] = useState(50);

  if (photos.length === 0) return null;

  const before = photos.find((p) => p.id === beforeId) ?? photos[0];
  const after = photos.find((p) => p.id === afterId) ?? photos[photos.length - 1];
  const single = photos.length === 1;
  const gap = daysBetween(before.date, after.date);
  const dw = before.weightKg != null && after.weightKg != null ? after.weightKg - before.weightKg : null;

  function choose(id: string) {
    if (slot === "antes") setBeforeId(id);
    else setAfterId(id);
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="spread">
        <span className="label">Fotos {single ? "" : "antes × depois"}</span>
        {!single && (
          <span className="tiny muted num">
            {Math.abs(gap)} dias
            {dw != null && dw !== 0 && ` · ${dw > 0 ? "+" : ""}${formatWeight(Number(dw.toFixed(1)))} kg`}
          </span>
        )}
      </div>

      <div className="pc-frame">
        <img src={after.photoDataUrl} alt={`Foto de ${after.date}`} />
        {!single && (
          <>
            <img src={before.photoDataUrl} alt={`Foto de ${before.date}`} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
            <span className="pc-line" style={{ left: `${pos}%` }} aria-hidden="true" />
            <span className="pc-tag l">ANTES · {caption(before)}</span>
            <span className="pc-tag r">DEPOIS · {caption(after)}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              aria-label="Cortina entre antes e depois"
              onChange={(e) => setPos(Number(e.target.value))}
            />
          </>
        )}
        {single && <span className="pc-tag l">{caption(after)}</span>}
      </div>

      {!single && (
        <>
          <div className="spread">
            <span className="tiny faint">Toque numa foto da linha do tempo para trocar</span>
            <span className="unit-toggle" role="group" aria-label="Qual foto trocar">
              {(["antes", "depois"] as Slot[]).map((s) => (
                <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>
                  {s}
                </button>
              ))}
            </span>
          </div>
          <div className="pc-strip">
            {photos.map((p) => {
              const role = p.id === before.id ? "antes" : p.id === after.id ? "depois" : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pc-thumb${role ? ` ${role}` : ""}`}
                  aria-label={`Usar foto de ${p.date} como ${slot}`}
                  onClick={() => choose(p.id)}
                >
                  <img src={p.photoDataUrl} alt="" loading="lazy" />
                  <span className="tiny">{shortDate(p.date)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
