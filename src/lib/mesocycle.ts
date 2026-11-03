import type { ProgramExercise, StopKind } from "../data/types";
import { addDays, daysBetween, mondayOf } from "./dates";

// Regras do mesociclo de 6 semanas + deload (ficha, página 6).

export const MESO_LENGTH = 7;

/** Semana 1–7 a partir da segunda-feira de início. Repete o ciclo depois do deload. */
export function weekFor(mesoStart: string, date: string): number {
  const diff = daysBetween(mesoStart, date);
  const w = Math.floor(diff / 7);
  return (((w % MESO_LENGTH) + MESO_LENGTH) % MESO_LENGTH) + 1;
}

export interface WeekRule {
  label: string;
  summary: string;
  compounds: string;
  isolations: string;
  /** Máximo de intensificadores por sessão. */
  intensifiers: number;
  intensifierLabel: string;
}

export const WEEK_RULES: Record<number, WeekRule> = {
  1: {
    label: "Semana 1",
    summary: "Entrada: isolados com −1 série, ninguém vai à falha.",
    compounds: "2–3 reps sobrando",
    isolations: "1–2 reps sobrando",
    intensifiers: 0,
    intensifierLabel: "Nenhum",
  },
  2: {
    label: "Semana 2",
    summary: "Séries da ficha. Ainda sobrando reps.",
    compounds: "~2 reps sobrando",
    isolations: "~1 rep sobrando",
    intensifiers: 0,
    intensifierLabel: "Nenhum",
  },
  3: {
    label: "Semana 3",
    summary: "Séries da ficha. Compostos até a falha técnica, isolados até a falha.",
    compounds: "Falha técnica (1–2 sobrando)",
    isolations: "Falha (0–1 sobrando)",
    intensifiers: 1,
    intensifierLabel: "1 por sessão",
  },
  4: {
    label: "Semana 4",
    summary: "▲ ganham +1 série. Compostos até a falha técnica, isolados até a falha.",
    compounds: "Falha técnica (1–2 sobrando)",
    isolations: "Falha (0–1 sobrando)",
    intensifiers: 2,
    intensifierLabel: "2 por sessão",
  },
  5: {
    label: "Semana 5",
    summary: "▲ com +1 série. Compostos com ~1 sobrando, isolados até a falha.",
    compounds: "Falha técnica (~1 sobrando)",
    isolations: "Falha",
    intensifiers: 3,
    intensifierLabel: "2–3 por sessão",
  },
  6: {
    label: "Semana 6",
    summary: "Última semana pesada. ▲ com +1 série. Atenção aos sinais de fadiga.",
    compounds: "Falha técnica (~1 sobrando)",
    isolations: "Falha",
    intensifiers: 3,
    intensifierLabel: "3 por sessão",
  },
  7: {
    label: "Deload",
    summary: "Metade das séries, mesma carga, parando com ~4 reps sobrando. Depois troque 2–3 acessórios.",
    compounds: "~4 reps sobrando",
    isolations: "~4 reps sobrando",
    intensifiers: 0,
    intensifierLabel: "Nenhum",
  },
};

export interface StopInfo {
  /** Cor/semântica: fail = falha, tech = falha técnica, rir = parar antes. */
  tone: "fail" | "tech" | "rir";
  label: string;
  detail: string;
}

export function stopFor(stop: StopKind, week: number): StopInfo {
  if (week === 7) return { tone: "rir", label: "Sobra 4", detail: "Deload: pare com ~4 reps sobrando." };
  if (stop === "R") return { tone: "rir", label: "Sobra 2", detail: "Pare quando aparecer a primeira rep lenta. Nunca à falha." };
  if (stop === "T") {
    if (week === 1) return { tone: "rir", label: "Sobra 2–3", detail: "Semana 1: pare com 2–3 reps sobrando." };
    if (week === 2) return { tone: "rir", label: "Sobra 2", detail: "Semana 2: pare com ~2 reps sobrando." };
    return { tone: "tech", label: "Falha técnica", detail: "Pare na última rep limpa, antes de precisar roubar ou travar." };
  }
  if (week === 1) return { tone: "rir", label: "Sobra 1–2", detail: "Semana 1: pare com 1–2 reps sobrando." };
  if (week === 2) return { tone: "rir", label: "Sobra 1", detail: "Semana 2: pare com ~1 rep sobrando." };
  return { tone: "fail", label: "Falha", detail: "Pelo menos a última série até a carga travar." };
}

/** Faixa de reps sobrando (RIR) que a semana pede, para comparar com o que foi marcado. */
export function rirRange(stop: StopKind, week: number): [number, number] {
  if (week === 7) return [3, 5];
  if (stop === "R") return [2, 3];
  if (stop === "T") return week === 1 ? [2, 3] : week === 2 ? [2, 2] : [1, 2];
  return week === 1 ? [1, 2] : week === 2 ? [1, 1] : [0, 1];
}

export type Reentry = { kind: "restart"; gapDays: number; week: number } | { kind: "repeat"; week: number; done: number; planned: number };

/**
 * A semana do mesociclo anda pelo calendário. Quando o treino parou, avisa antes de mandar para uma semana pesada:
 * 10+ dias sem treinar → recomeçar na semana 1; semana passada com menos da metade dos treinos → repetir a semana.
 */
export function reentryFor(
  doneDates: string[],
  mesoStart: string,
  today: string,
  trainingDays: number[],
  dismissed?: string,
): Reentry | null {
  const monday = mondayOf(today);
  if (dismissed === monday || !doneDates.length) return null;
  const week = weekFor(mesoStart, today);
  if (week === 1) return null;
  const last = doneDates.reduce((a, b) => (a > b ? a : b));
  const gapDays = daysBetween(last, today);
  if (gapDays >= 10) return { kind: "restart", gapDays, week };
  if (week > 6) return null;
  const prevMonday = addDays(monday, -7);
  const done = doneDates.filter((d) => d >= prevMonday && d < monday).length;
  const planned = trainingDays.length;
  if (done < Math.ceil(planned / 2)) return { kind: "repeat", week, done, planned };
  return null;
}

export function setsFor(e: Pick<ProgramExercise, "sets" | "iso" | "up">, week: number): number {
  if (week === 7) return Math.ceil(e.sets / 2);
  let s = e.sets;
  if (week === 1 && e.iso) s -= 1;
  if (week >= 4 && week <= 6 && e.up) s += 1;
  return s;
}

/** Descanso padrão do timer: meio da faixa, arredondado a 15 s. */
export function defaultRest(rest: [number, number]): number {
  const mid = (rest[0] + rest[1]) / 2;
  return Math.round(mid / 15) * 15;
}

/** Aquecimento sugerido: 2 no primeiro exercício do dia, 1 nos demais. */
export function warmupsFor(index: number): number {
  return index === 0 ? 2 : 1;
}
