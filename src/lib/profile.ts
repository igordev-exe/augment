import type { Session } from "../data/types";
import { addDays, mondayOf } from "./dates";
import { prsBySession, toKg, workSets } from "./progression";
import { sessionStats } from "./sessions";

// Perfil do operador (conta online e esquadrão): números de verdade, tirados do histórico do aparelho. Nada de
// seguidores ou curtidas inventados.

export interface ProfileTelemetry {
  /** Volume (kg) por semana, da mais antiga para a atual (8 semanas). */
  weeks: { monday: string; volumeKg: number }[];
  /** Variação do volume: últimas 4 semanas × as 4 anteriores, em %. null sem base. */
  volumeChangePct: number | null;
  /** Exercícios com recorde novo nas últimas 7 semanas (um mesociclo). */
  prsCycle: number;
  /** Semanas com treino entre as 8, em %. */
  consistencyPct: number;
  /** Volume dos últimos 90 dias (kg). */
  volume90Kg: number;
}

export function profileTelemetry(sessions: Session[], today: string): ProfileTelemetry {
  const done = sessions.filter((s) => s.status === "done" && s.date <= today);
  const current = mondayOf(today);
  const weeks = Array.from({ length: 8 }, (_, i) => ({ monday: addDays(current, (i - 7) * 7), volumeKg: 0 }));
  const byMonday = new Map(weeks.map((w) => [w.monday, w]));
  let volume90Kg = 0;
  const from90 = addDays(today, -89);
  for (const s of done) {
    const v = sessionStats(s).volumeKg;
    const w = byMonday.get(mondayOf(s.date));
    if (w) w.volumeKg += v;
    if (s.date >= from90) volume90Kg += v;
  }
  const sum = (a: typeof weeks) => a.reduce((t, w) => t + w.volumeKg, 0);
  const recent = sum(weeks.slice(4));
  const before = sum(weeks.slice(0, 4));
  const from7w = addDays(today, -48);
  const cycleExercises = new Set<string>();
  const byId = new Map(done.map((s) => [s.id, s]));
  for (const [id, prs] of prsBySession(done)) if ((byId.get(id)?.date ?? "") >= from7w) for (const p of prs) cycleExercises.add(p.exId);
  const prsCycle = cycleExercises.size;
  return {
    weeks,
    volumeChangePct: before > 0 ? Math.round(((recent - before) / before) * 1000) / 10 : null,
    prsCycle,
    consistencyPct: Math.round((weeks.filter((w) => w.volumeKg > 0).length / weeks.length) * 100),
    volume90Kg,
  };
}

/** Maior carga (kg) de trabalho numa sessão. */
export function sessionTopKg(s: Session): number {
  let top = 0;
  for (const e of s.exercises) for (const st of workSets(e)) top = Math.max(top, toKg(st.weight ?? 0, e.unit));
  return top;
}

/** Identificador estável e curto do operador para o cartão ("ID // AX-4F2C"), a partir do id da conta. */
export function operatorSerial(id: string): string {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hex = h.toString(16).toUpperCase().padStart(8, "0");
  return `AX-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/** Toneladas com 1 casa ("16,8 t"). */
export function tonnes(kg: number): string {
  return `${(Math.round(kg / 100) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`;
}

/** Patente pelo número de treinos: só um selo de progresso, sem efeito em nada. */
export function rankOf(done: number): string {
  return done >= 200 ? "ELITE" : done >= 100 ? "VETERANO" : done >= 40 ? "AUMENTADO" : done >= 10 ? "EM CALIBRAGEM" : "RECRUTA";
}

/** Postos em ordem, com o mínimo de sessões concluídas de cada um (os mesmos cortes de `rankOf`). */
export const RANKS: { name: string; min: number }[] = [
  { name: "RECRUTA", min: 0 },
  { name: "EM CALIBRAGEM", min: 10 },
  { name: "AUMENTADO", min: 40 },
  { name: "VETERANO", min: 100 },
  { name: "ELITE", min: 200 },
];

/** Onde a pessoa está entre o posto atual e o próximo. `next` é null no último posto. */
export function rankProgress(done: number): {
  index: number;
  rank: string;
  next: string | null;
  need: number;
  into: number;
  span: number;
} {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (done >= RANKS[i].min) index = i;
  const cur = RANKS[index];
  const nxt = RANKS[index + 1];
  if (!nxt) return { index, rank: cur.name, next: null, need: 0, into: 1, span: 1 };
  return { index, rank: cur.name, next: nxt.name, need: nxt.min - done, into: done - cur.min, span: nxt.min - cur.min };
}
