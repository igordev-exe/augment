import { useState } from "react";
import { Link } from "react-router-dom";
import { EXERCISE_BY_ID, shortName } from "../data/program";
import { shortDate } from "../lib/dates";
import type { PRKind } from "../lib/progression";
import { Icon } from "./Icon";

// Recordes compactos: um por exercício, com selos curtos (CARGA · 1RM · REPS). Tocar na linha abre os textos completos;
// só os primeiros exercícios aparecem, o resto fica atrás de "+N exercícios".

export interface RecordItem {
  exId: string;
  kind: PRKind;
  text: string;
  date?: string;
}

const TAG: Record<PRKind, string> = { carga: "CARGA", "1rm": "1RM", reps: "REPS" };

export function RecordList({ items, show = 3, linkToExercise = false }: { items: RecordItem[]; show?: number; linkToExercise?: boolean }) {
  const [all, setAll] = useState(false);
  const groups: { key: string; exId: string; date?: string; items: RecordItem[] }[] = [];
  for (const it of items) {
    const key = `${it.exId}|${it.date ?? ""}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(it);
    else groups.push({ key, exId: it.exId, date: it.date, items: [it] });
  }
  const visible = all ? groups : groups.slice(0, show);
  const hidden = groups.length - visible.length;

  return (
    <div data-augmented-ui="tl-clip br-clip border" className="rec-list">
      <div className="rec-head">
        <span>
          <b>{items.length}</b> {items.length === 1 ? "recorde" : "recordes"} · {groups.length}{" "}
          {groups.length === 1 ? "exercício" : "exercícios"}
        </span>
      </div>
      {visible.map((g) => {
        const ex = EXERCISE_BY_ID[g.exId];
        const kinds = [...new Set(g.items.map((i) => i.kind))];
        return (
          <details key={g.key} className="rec-row">
            <summary>
              <span className="rec-icon">
                <Icon name="trophy" size={18} />
              </span>
              <span className="rec-name">
                {ex ? shortName(ex) : g.exId}
                {g.date && <small>{shortDate(g.date)}</small>}
              </span>
              <span className="rec-tags">
                {kinds.map((k) => (
                  <i key={k}>{TAG[k]}</i>
                ))}
              </span>
            </summary>
            <div className="rec-body">
              {g.items.map((i, n) => (
                <span key={n}>{i.text}</span>
              ))}
              {linkToExercise && ex && (
                <Link to={`/exercicios/${ex.lib}`} className="tiny">
                  Ver exercício &gt;
                </Link>
              )}
            </div>
          </details>
        );
      })}
      {(hidden > 0 || all) && groups.length > show && (
        <button type="button" className="rec-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "▴ Recolher" : `▸ +${hidden} ${hidden === 1 ? "exercício" : "exercícios"}`}
        </button>
      )}
    </div>
  );
}
