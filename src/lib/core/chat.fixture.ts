import type { BodyEntry, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import type { AnswerData } from "./data-answers";
import { simulateOperator } from "./operator";

// Dados de teste do chat: 6 semanas de um operador simulado, até a véspera de hoje. Os mesmos do `chat.test.ts`.

export const SETTINGS: Settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-09-07", trainingDays: [1, 2, 3, 4, 5] };
export const TODAY = "2026-10-21";
export const NOW_MS = Date.parse(`${TODAY}T08:00:00`);

const sessions = simulateOperator({
  seed: 7,
  weeks: 6,
  startDate: "2026-09-07",
  trainingDays: [1, 2, 3, 4, 5],
  preferredHour: 18,
  trueRestRatio: 1,
  trueMuscleRecovery: {},
}).filter((s) => s.date < TODAY);

const bodyLog: BodyEntry[] = Array.from({ length: 21 }, (_, i) => ({
  id: `b${i}`,
  date: new Date(Date.parse("2026-10-01T12:00:00") + i * 86400000).toISOString().slice(0, 10),
  weightKg: 80 - i * 0.05,
}));

export const FULL_DATA: AnswerData = { sessions, settings: SETTINGS, today: TODAY, bodyLog, now: NOW_MS };

/** Os mesmos dados com um treino em andamento hoje (cópia do último, séries por fazer e carga sugerida). */
export function withOpenSession(base: AnswerData = FULL_DATA) {
  const last = [...base.sessions].filter((s) => s.status === "done").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const open = {
    ...last,
    id: "aberta",
    date: base.today,
    status: "active" as const,
    exercises: last.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: false, reps: null, suggested: true })) })),
  };
  return { data: { ...base, sessions: [...base.sessions, open] }, open };
}
