import { PROGRAM } from "../data/program";
import type { Session } from "../data/types";
import { addDays, fromISO } from "./dates";

// Agenda: a sequência Push A → Pull A → Lower A → Upper B → Lower B nunca pula um treino.
// Dia perdido: o próximo dia de treino recebe o treino que ficou para trás (ficha, página 1).

export const ORDER = PROGRAM.map((d) => d.id);

export interface PlannedDay {
  date: string;
  dayId: string;
}

/** Índice do próximo treino na sequência, com base na última sessão concluída. */
export function nextIndex(sessions: Session[], refDate: string, trainingDays: number[]): number {
  const done = sessions
    .filter((s) => s.status === "done" && s.date <= refDate)
    .sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1));
  if (done.length) {
    return (ORDER.indexOf(done[0].dayId) + 1) % ORDER.length;
  }
  // Sem histórico: o treino que a semana padrão manda para o próximo dia de treino.
  let d = refDate;
  for (let i = 0; i < 7; i++) {
    const wd = fromISO(d).getDay();
    if (trainingDays.includes(wd)) {
      const idx = PROGRAM.findIndex((p) => p.weekday === wd);
      return idx >= 0 ? idx : 0;
    }
    d = addDays(d, 1);
  }
  return 0;
}

/**
 * Planeja `days` dias a partir de `from` (inclusive).
 * Se já houver sessão concluída em `from`, o plano começa no dia seguinte.
 */
export function planAhead(sessions: Session[], from: string, days: number, trainingDays: number[]): PlannedDay[] {
  const doneToday = sessions.some((s) => s.status === "done" && s.date === from);
  const active = sessions.find((s) => s.status === "active");
  let idx = nextIndex(sessions, from, trainingDays);
  const out: PlannedDay[] = [];
  let start = from;
  if (active && active.date === from) {
    out.push({ date: from, dayId: active.dayId });
    idx = (ORDER.indexOf(active.dayId) + 1) % ORDER.length;
    start = addDays(from, 1);
  } else if (doneToday) {
    start = addDays(from, 1);
  }
  const end = addDays(from, days);
  for (let d = start; d < end; d = addDays(d, 1)) {
    if (trainingDays.includes(fromISO(d).getDay())) {
      out.push({ date: d, dayId: ORDER[idx] });
      idx = (idx + 1) % ORDER.length;
    }
  }
  return out;
}
