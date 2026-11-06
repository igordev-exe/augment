import { useEffect, useRef, useState } from "react";
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
  onWeight,
  onReps,
  onRir,
  onToggle,
  onMenu,
}: {
  set: SetEntry;
  label: string;
  unit: Unit;
  active: boolean;
  weightPh?: number | null;
  repsPh?: number;
  askRir: boolean;
  rirTarget: [number, number];
  onWeight: (w: number | null) => void;
  onReps: (r: number | null) => void;
  onRir: (rir: number) => void;
  onToggle: (w: number | null, r: number | null) => void;
  /** Tocar (ou segurar) o número da série abre o menu circular de ações. */
  onMenu?: () => void;
}) {
  const [w, setW] = useState(set.weight != null ? formatWeight(set.weight) : "");
  const [r, setR] = useState(set.reps != null ? String(set.reps) : "");
  const editing = useRef<"w" | "r" | null>(null);
  const saveW = useRef<number>();
  const saveR = useRef<number>();

  // Sincroniza se o peso ou reps mudaram por fora (−15% na última série, sugestão, desfazer), mas não enquanto digita.
  useEffect(() => {
    if (editing.current !== "w") setW(set.weight != null ? formatWeight(set.weight) : "");
  }, [set.weight]);
  useEffect(() => {
    if (editing.current !== "r") setR(set.reps != null ? String(set.reps) : "");
  }, [set.reps]);
  useEffect(
    () => () => {
      window.clearTimeout(saveW.current);
      window.clearTimeout(saveR.current);
    },
    [],
  );

  // Salva enquanto digita (300 ms depois da última tecla): se o celular encerrar o app no descanso, nada se perde.
  function commitW(v: string) {
    window.clearTimeout(saveW.current);
    const n = parseNum(v);
    if (n !== set.weight) onWeight(n);
  }
  function commitR(v: string) {
    window.clearTimeout(saveR.current);
    const n = v === "" ? null : Number(v);
    if (n !== set.reps) onReps(n);
  }

  const showRir = set.done && set.kind !== "warmup" && askRir;
  const rirText = set.rir != null ? `sobra ${set.rir >= 4 ? "4+" : set.rir}` : null;

  if (!active) {
    return (
      <div className={`set ${set.kind}${set.done ? " done" : ""}`}>
        <div className="set-kind">
          {label}
          {set.done && rirText && <span className="rir-tag">{rirText}</span>}
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
      {onMenu ? (
        <button
          type="button"
          className={`set-kind ${kindCls}`}
          aria-haspopup="menu"
          aria-label={`Série ${label}${rirText ? `, ${rirText}` : ""}: mais ações`}
          onClick={onMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            onMenu();
          }}
        >
          {label}
          {set.done && rirText && <span className="rir-tag">{rirText}</span>}
          <i className="set-more" aria-hidden="true" />
        </button>
      ) : (
        <div className={`set-kind ${kindCls}`}>{label}</div>
      )}
      <div className="field">
        <input
          inputMode="decimal"
          enterKeyHint="next"
          aria-label={`Peso da série ${label} em ${unit}`}
          placeholder={weightPh != null ? formatWeight(weightPh) : "–"}
          value={w}
          onFocus={() => (editing.current = "w")}
          onChange={(e) => {
            const v = e.target.value;
            setW(v);
            window.clearTimeout(saveW.current);
            saveW.current = window.setTimeout(() => commitW(v), 300);
          }}
          onBlur={() => {
            editing.current = null;
            commitW(w);
          }}
        />
      </div>
      <div className="field">
        <input
          inputMode="numeric"
          enterKeyHint="done"
          aria-label={`Repetições da série ${label}`}
          placeholder={repsPh != null ? String(repsPh) : "–"}
          value={r}
          onFocus={() => (editing.current = "r")}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setR(v);
            window.clearTimeout(saveR.current);
            saveR.current = window.setTimeout(() => commitR(v), 300);
          }}
          onBlur={() => {
            editing.current = null;
            commitR(r);
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
          onClick={() => {
            window.clearTimeout(saveW.current);
            window.clearTimeout(saveR.current);
            onToggle(parseNum(w), r === "" ? null : Number(r));
          }}
        >
          <Icon name="check" size={22} />
        </button>
      </span>
      {showRir && (
        <div className="rir-ask" role="group" aria-label={`Quantas reps sobraram na série ${label}?`}>
          <span className="label">Sobraram</span>
          {[0, 1, 2, 3, 4].map((v) => {
            const target = v >= rirTarget[0] && v <= rirTarget[1];
            return (
              <button
                key={v}
                type="button"
                className={target ? "target" : undefined}
                aria-pressed={set.rir === v}
                aria-label={`${v === 4 ? "4 ou mais" : v}${target ? " (alvo)" : ""}`}
                onClick={() => onRir(v)}
              >
                {v === 4 ? "4+" : v}
                {target && <small>alvo</small>}
              </button>
            );
          })}
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
