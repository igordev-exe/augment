import { useEffect, useState } from "react";
import type { SetEntry, Unit } from "../data/types";
import { formatWeight } from "../lib/progression";
import { Icon } from "./Icon";

export function parseNum(s: string): number | null {
  const t = s.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function SetRow({
  set,
  label,
  unit,
  active,
  weightPh,
  repsPh,
  askRir,
  rirTarget,
  canRemove,
  onWeight,
  onReps,
  onRir,
  onToggle,
  onRemove,
}: {
  set: SetEntry;
  label: string;
  unit: Unit;
  active: boolean;
  weightPh?: number | null;
  repsPh?: number;
  askRir: boolean;
  rirTarget: [number, number];
  canRemove: boolean;
  onWeight: (w: number | null) => void;
  onReps: (r: number | null) => void;
  onRir: (rir: number) => void;
  onToggle: (w: number | null, r: number | null) => void;
  onRemove: () => void;
}) {
  const [w, setW] = useState(set.weight != null ? formatWeight(set.weight) : "");
  const [r, setR] = useState(set.reps != null ? String(set.reps) : "");
  const [editRir, setEditRir] = useState(false);

  // Sincroniza se o peso ou reps mudaram por fora (−15% na última série, sugestão, desfazer).
  useEffect(() => {
    setW(set.weight != null ? formatWeight(set.weight) : "");
  }, [set.weight]);
  useEffect(() => {
    setR(set.reps != null ? String(set.reps) : "");
  }, [set.reps]);
  useEffect(() => {
    if (!set.done) setEditRir(false);
  }, [set.done]);

  const showRir = set.done && set.kind !== "warmup" && (askRir || editRir);

  if (!active) {
    return (
      <div className={`set ${set.kind}${set.done ? " done" : ""}`}>
        <div className="set-kind">
          {label}
          {set.done && set.rir != null && <span className="rir-tag">sobra {set.rir >= 4 ? "4+" : set.rir}</span>}
        </div>
        <div>
          {formatWeight(set.weight)} <span className="muted small">{unit}</span>
        </div>
        <div>{set.reps ?? "–"} reps</div>
        <div className="muted small">{set.done ? "✓" : "–"}</div>
      </div>
    );
  }

  const kindCls = set.kind === "warmup" ? "warmup" : set.kind === "drop" ? "drop" : "";
  return (
    <div className={`set ${set.kind}${set.done ? " done" : ""}`}>
      <div className={`set-kind ${kindCls}`}>
        {label}
        {set.done && set.rir != null && (
          <button
            type="button"
            className="rir-tag"
            aria-label={`Sobraram ${set.rir} reps. Tocar para mudar.`}
            onClick={() => setEditRir((v) => !v)}
          >
            sobra {set.rir >= 4 ? "4+" : set.rir}
          </button>
        )}
        {canRemove && (
          <button type="button" className="x" aria-label="Remover série" onClick={onRemove}>
            ×
          </button>
        )}
      </div>
      <div className="field">
        <input
          inputMode="decimal"
          enterKeyHint="next"
          aria-label={`Peso da série ${label}`}
          placeholder={weightPh != null ? formatWeight(weightPh) : "–"}
          value={w}
          onChange={(e) => setW(e.target.value)}
          onBlur={() => {
            const n = parseNum(w);
            if (n !== set.weight) onWeight(n);
          }}
        />
        <span className="suffix">{unit}</span>
      </div>
      <div className="field">
        <input
          inputMode="numeric"
          enterKeyHint="done"
          aria-label={`Repetições da série ${label}`}
          placeholder={repsPh != null ? String(repsPh) : "–"}
          value={r}
          onChange={(e) => setR(e.target.value.replace(/\D/g, ""))}
          onBlur={() => {
            const n = r === "" ? null : Number(r);
            if (n !== set.reps) onReps(n);
          }}
        />
      </div>
      {/* Wrapper: o brilho (drop-shadow) fica fora do recorte do canto. */}
      <span className="check-wrap">
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="check"
          aria-pressed={set.done}
          aria-label={set.done ? "Desmarcar série" : "Marcar série como feita"}
          onClick={() => onToggle(parseNum(w), r === "" ? null : Number(r))}
        >
          <Icon name="check" size={22} />
        </button>
      </span>
      {showRir && (
        <div className="rir-ask" role="group" aria-label={`Quantas reps sobraram na série ${label}?`}>
          <span className="label">Sobraram</span>
          {[0, 1, 2, 3, 4].map((v) => (
            <button
              key={v}
              type="button"
              className={v >= rirTarget[0] && v <= rirTarget[1] ? "target" : undefined}
              aria-pressed={set.rir === v}
              onClick={() => {
                onRir(v);
                setEditRir(false);
              }}
            >
              {v === 4 ? "4+" : v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Linha de opções de um toque (check-in, feedback). Tocar de novo na escolhida mantém. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: T[];
  value: T | undefined;
  onPick: (v: T) => void;
}) {
  return (
    <div className="choice" role="group" aria-label={label}>
      <span className="choice-label">{label}</span>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
