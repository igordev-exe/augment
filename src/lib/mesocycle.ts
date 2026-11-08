import { exOf, isFixedProgram } from "../data/program";
import type { Checkin, ProgramExercise, Session, StopKind } from "../data/types";
import { addDays, bySessionDesc, daysBetween, mondayOf } from "./dates";

// Regras do mesociclo de 6 semanas + deload.

export const MESO_LENGTH = 7;

/**
 * Semana 1–7 a partir da segunda-feira de início. Repete o ciclo depois do deload.
 * Programa sem mesociclo (periodization "fixed"): sempre 0, a regra "Programa fixo".
 */
export function weekFor(mesoStart: string, date: string): number {
  if (isFixedProgram()) return 0;
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
  0: {
    label: "Programa fixo",
    summary: "Sem mesociclo: séries e até onde ir como no programa, sem deload automático.",
    compounds: "Falha técnica (1–2 sobrando)",
    isolations: "Falha (0–1 sobrando)",
    intensifiers: 0,
    intensifierLabel: "Nenhum",
  },
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

export function isLowDay(c: Checkin | undefined): boolean {
  return !!c && !c.skipped && (c.sleep === "ruim" || c.energy === "baixa");
}

/** O que o check-in muda no treino de hoje. */
export function checkinAdvice(c: Checkin | undefined): string[] {
  if (!c || c.skipped) return [];
  const out: string[] = [];
  if (c.sleep === "ruim" || c.energy === "baixa") {
    out.push(
      "Dia de baixa: mantenha as cargas sugeridas, sem intensificadores, e pare 1 rep antes da meta. Hoje o objetivo é cumprir, não bater recorde.",
    );
  }
  if (c.pain === "leve") out.push("Dor leve: aqueça mais o que incomoda e corte o exercício que piorar a dor.");
  if (c.pain === "forte") {
    out.push("Dor forte: pule o que dói ou use a alternativa em Como fazer. Se continuar nos próximos dias, procure avaliação.");
  }
  return out;
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

/** Calcula o mesoStart para transformar a semana atual imediatamente em Semana 7 (Deload). */
export function earlyDeloadMesoStart(today: string): string {
  return addDays(mondayOf(today), -42);
}

export interface FatigueDeloadAlert {
  week: number;
  lowCheckins: number;
  jointComplaints: number;
  underTargetExs: number;
  /** Exercícios com reps caindo na mesma carga em 2 sessões seguidas. */
  regressingExs: number;
  reasons: string[];
  targetMesoStart: string;
}

/**
 * Detecta fadiga acumulada nas semanas 3–6 (check-ins seguidos de sono ruim / energia baixa,
 * dores articulares, quedas abaixo do piso de repetições ou reps caindo na mesma carga) e sugere antecipar o Deload.
 * Regra: antecipe quando dois sinais aparecem juntos; 3+ exercícios regredindo sozinhos já são "volume cego".
 * `regressing`: nomes dos exercícios com reps caindo na mesma carga (calculado pelo motor, ver engine.ts).
 */
export function fatigueDeloadFor(
  sessions: Session[],
  mesoStart: string,
  today: string,
  dismissed?: string,
  regressing: string[] = [],
): FatigueDeloadAlert | null {
  const monday = mondayOf(today);
  if (dismissed === monday) return null;
  const week = weekFor(mesoStart, today);
  if (week < 3 || week > 6) return null;

  const since = addDays(today, -10);
  const recent = sessions
    .filter((s) => s.status === "done" && s.date >= since && s.date <= today)
    .sort(bySessionDesc)
    .slice(0, 6);
  if (recent.length < 2) return null;

  let lowCheckins = 0;
  let jointComplaints = 0;
  let underTargetExs = 0;

  for (const s of recent) {
    if (s.checkin && !s.checkin.skipped) {
      if (s.checkin.sleep === "ruim" || s.checkin.energy === "baixa" || s.checkin.pain === "forte") {
        lowCheckins += 1;
      }
    }
    for (const entry of s.exercises) {
      if (entry.feedback?.joint === "incomodou") jointComplaints += 1;
      const ex = exOf(entry);
      if (!ex) continue;
      const work = entry.sets.filter((st) => st.done && st.kind === "work" && (st.reps ?? 0) > 0);
      if (work.length >= 2 && work.every((st) => (st.reps ?? 0) < ex.reps[0])) {
        underTargetExs += 1;
      }
    }
  }

  const regressingExs = regressing.length;
  const totalSignals = lowCheckins + jointComplaints + underTargetExs + regressingExs;
  // Tipos de sinal: sono/energia ruins repetidos, articulação reclamando, reps caindo na mesma carga.
  const kinds = [lowCheckins >= 2, jointComplaints >= 1, regressingExs >= 1 || underTargetExs >= 1].filter(Boolean).length;
  const shouldAlert = kinds >= 2 || jointComplaints >= 3 || underTargetExs >= 3 || regressingExs >= 3 || totalSignals >= 4;
  if (!shouldAlert) return null;

  const reasons: string[] = [];
  if (lowCheckins > 0) reasons.push(`${lowCheckins} check-in(s) de sono ruim/energia baixa ou dor`);
  if (underTargetExs > 0) reasons.push(`${underTargetExs} exercício(s) abaixo do mínimo de reps`);
  if (regressingExs > 0) {
    const names = regressing.slice(0, 3).join(", ") + (regressingExs > 3 ? "…" : "");
    reasons.push(`reps caindo com a mesma carga em ${regressingExs} exercício(s) (${names})`);
  }
  if (jointComplaints > 0) reasons.push(`${jointComplaints} queixa(s) de incômodo articular`);

  return {
    week,
    lowCheckins,
    jointComplaints,
    underTargetExs,
    regressingExs,
    reasons,
    targetMesoStart: earlyDeloadMesoStart(today),
  };
}

/** Teto de séries por exercício ("nenhum exercício passa de 4 séries"). */
export const MAX_SETS = 4;

/**
 * Séries do exercício na semana. `adjust`: séries a mais/menos do ajuste de fim de mesociclo (Ajustes → setAdjust).
 * O ajuste muda a base da ficha; as regras da semana (−1 na semana 1, ▲, deload) continuam por cima, sem passar de 4.
 */
export function setsFor(e: Pick<ProgramExercise, "sets" | "iso" | "up">, week: number, adjust = 0): number {
  const base = Math.max(1, e.sets + adjust);
  if (week === 7) return Math.ceil(base / 2);
  let s = base;
  if (week === 1 && e.iso) s -= 1;
  if (week >= 4 && week <= 6 && e.up) s += 1;
  return Math.max(1, Math.min(Math.max(MAX_SETS, e.sets), s));
}

/** Novo mapa de ajuste de séries com `valor` para o exercício (0 remove). */
export function withSetAdjust(cur: Record<string, number> | undefined, exId: string, valor: number): Record<string, number> {
  const next = { ...cur };
  if (valor) next[exId] = valor;
  else delete next[exId];
  return next;
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
