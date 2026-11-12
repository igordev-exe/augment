import { exById, exOf, MUSCLE_LABEL, MUSCLE_ORDER, shortName, synergistsOf } from "../../data/program";
import { SCIENCE } from "../../data/science";
import type { BodyEntry, MuscleId, ProgramExercise, Session, SessionExercise, Settings } from "../../data/types";
import { addDays, bySessionAsc, fromISO, mondayOf } from "../dates";
import { setsFor } from "../mesocycle";
import { bestE1rm, increaseStep, mainLoad, predictReps, prsBySession, suggest, toKg, workSets } from "../progression";
import { weightTrend, type Absence } from "../visual";

// AUG.CORE — Camada 2: Modelo do Operador ("Gêmeo Digital").
// Separa o que é declarado/persistido (`OperatorMemory`) do que é derivado em O(N) (`OperatorState`).
// Puro, determinístico e sem importar telas ou o banco.

export type EquipmentKind = "halteres" | "barra" | "maquina" | "cabo" | "peso-corporal";

export type Constraint =
  | {
      id: string;
      kind: "time-cap";
      minutes: number;
      createdAt: string;
      expiresAt: string;
      note?: string;
    }
  | {
      id: string;
      kind: "equipment";
      allowed: EquipmentKind[];
      createdAt: string;
      expiresAt: string;
      note?: string;
    }
  | {
      id: string;
      kind: "pain";
      muscle?: MuscleId;
      libId?: string;
      severity: "leve" | "forte";
      createdAt: string;
      expiresAt: string;
      note?: string;
    }
  | {
      id: string;
      kind: "schedule";
      reduceVolume: boolean;
      createdAt: string;
      expiresAt: string;
      note: string;
    };

export interface MesoSummary {
  start: string;
  end: string;
  sessionsDone: number;
  sessionsPlanned: number;
  prsCount: number;
  avgWeeklySets: number;
  bestMuscles: MuscleId[];
}

export interface OperatorMemory {
  version: 1;
  /** Data ISO até quando o gêmeo está na janela inicial de calibração (7 dias após o primeiro uso). */
  calibrationUntil?: string;
  /** Restrições temporárias declaradas pela pessoa (expiram em `expiresAt`). */
  constraints: Constraint[];
  /** Resumo dos mesociclos anteriores já fechados. */
  mesoHistory: MesoSummary[];
  /** Último `mesoStart` visto: quando muda, o ciclo anterior é fechado e resumido mesmo antes da 7ª semana. */
  lastMesoStart?: string;
  /** Ausências declaradas (doença, viagem): a semana coberta não quebra a sequência. Ficam guardadas depois de passar. */
  absences?: Absence[];
}

export const EMPTY_OPERATOR_MEMORY: OperatorMemory = {
  version: 1,
  constraints: [],
  mesoHistory: [],
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EQUIP_SET = new Set<EquipmentKind>(["halteres", "barra", "maquina", "cabo", "peso-corporal"]);
const MUSCLE_SET = new Set<MuscleId>(MUSCLE_ORDER);

function isConstraint(raw: unknown): raw is Constraint {
  if (!raw || typeof raw !== "object") return false;
  const c = raw as Partial<Constraint> & Record<string, unknown>;
  if (typeof c.id !== "string" || !c.id.trim()) return false;
  if (typeof c.createdAt !== "string" || !ISO_DATE_RE.test(c.createdAt)) return false;
  if (typeof c.expiresAt !== "string" || !ISO_DATE_RE.test(c.expiresAt)) return false;
  if (c.kind === "time-cap") {
    const m = Number(c.minutes);
    return Number.isFinite(m) && m >= 15 && m <= 180;
  }
  if (c.kind === "equipment") {
    return Array.isArray(c.allowed) && c.allowed.length > 0 && c.allowed.every((k) => EQUIP_SET.has(k as EquipmentKind));
  }
  if (c.kind === "pain") {
    if (c.severity !== "leve" && c.severity !== "forte") return false;
    if (c.muscle !== undefined && !MUSCLE_SET.has(c.muscle as MuscleId)) return false;
    if (c.libId !== undefined && typeof c.libId !== "string") return false;
    return c.muscle !== undefined || (typeof c.libId === "string" && c.libId.length > 0);
  }
  if (c.kind === "schedule") {
    return typeof c.reduceVolume === "boolean" && typeof c.note === "string" && c.note.trim().length > 0;
  }
  return false;
}

function isMesoSummary(raw: unknown): raw is MesoSummary {
  if (!raw || typeof raw !== "object") return false;
  const m = raw as Partial<MesoSummary>;
  return (
    typeof m.start === "string" &&
    ISO_DATE_RE.test(m.start) &&
    typeof m.end === "string" &&
    ISO_DATE_RE.test(m.end) &&
    typeof m.sessionsDone === "number" &&
    Number.isFinite(m.sessionsDone) &&
    typeof m.sessionsPlanned === "number" &&
    Number.isFinite(m.sessionsPlanned) &&
    typeof m.prsCount === "number" &&
    Number.isFinite(m.prsCount) &&
    typeof m.avgWeeklySets === "number" &&
    Number.isFinite(m.avgWeeklySets) &&
    Array.isArray(m.bestMuscles) &&
    m.bestMuscles.every((x) => MUSCLE_SET.has(x as MuscleId))
  );
}

export function sanitizeOperatorMemory(raw: unknown): OperatorMemory {
  if (!raw || typeof raw !== "object") return { ...EMPTY_OPERATOR_MEMORY, constraints: [], mesoHistory: [] };
  const obj = raw as Partial<OperatorMemory>;
  const calibrationUntil =
    typeof obj.calibrationUntil === "string" && ISO_DATE_RE.test(obj.calibrationUntil) ? obj.calibrationUntil : undefined;
  const lastMesoStart = typeof obj.lastMesoStart === "string" && ISO_DATE_RE.test(obj.lastMesoStart) ? obj.lastMesoStart : undefined;
  const constraints = Array.isArray(obj.constraints) ? obj.constraints.filter(isConstraint) : [];
  const mesoHistory = Array.isArray(obj.mesoHistory) ? obj.mesoHistory.filter(isMesoSummary) : [];
  const absences = Array.isArray(obj.absences)
    ? obj.absences
        .filter(
          (a): a is Absence =>
            !!a &&
            typeof a.from === "string" &&
            typeof a.until === "string" &&
            ISO_DATE_RE.test(a.from) &&
            ISO_DATE_RE.test(a.until) &&
            a.from <= a.until,
        )
        .map((a) => ({ from: a.from, until: a.until }))
        .slice(-50)
    : [];
  return {
    version: 1,
    ...(calibrationUntil ? { calibrationUntil } : {}),
    ...(lastMesoStart ? { lastMesoStart } : {}),
    constraints,
    mesoHistory,
    ...(absences.length ? { absences } : {}),
  };
}

/** Semanas do mesociclo em dias: 7 semanas (6 de carga + deload). */
const MESO_DAYS = 49;

/** Resumo de um mesociclo (ou do pedaço dele que foi treinado) entre `start` e `end`, inclusive. */
export function mesoSummaryFor(sessions: Session[], start: string, end: string, trainingDays: number[]): MesoSummary | null {
  const done = sessions.filter((s) => s.status === "done" && s.date >= start && s.date <= end).sort(bySessionAsc);
  if (!done.length) return null;
  const prs = prsBySession(sessions);
  let prsCount = 0;
  let totalSets = 0;
  const setsByMuscle = new Map<MuscleId, number>();
  for (const s of done) {
    prsCount += prs.get(s.id)?.length ?? 0;
    for (const entry of s.exercises) {
      const ex = exOf(entry);
      const n = workSets(entry, false).length;
      totalSets += n;
      for (const m of ex?.muscles ?? []) setsByMuscle.set(m, (setsByMuscle.get(m) ?? 0) + n);
    }
  }
  const days = Math.max(1, Math.round((fromISO(end).getTime() - fromISO(start).getTime()) / 86_400_000) + 1);
  const weeks = Math.max(1, days / 7);
  const planned = Math.round(weeks * Math.max(1, trainingDays.length));
  const bestMuscles = [...setsByMuscle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);
  return {
    start,
    end,
    sessionsDone: done.length,
    sessionsPlanned: planned,
    prsCount,
    avgWeeklySets: Math.round(totalSets / weeks),
    bestMuscles,
  };
}

/**
 * Fecha mesociclos que terminaram: o ciclo atual passou das 7 semanas, ou `mesoStart` mudou (a pessoa reiniciou).
 * Devolve a memória nova, ou `null` quando não há nada a fechar. Puro: quem chama decide gravar.
 */
export function closeFinishedMesos(memory: OperatorMemory, sessions: Session[], settings: Settings, today: string): OperatorMemory | null {
  const known = new Set(memory.mesoHistory.map((m) => m.start));
  const add: MesoSummary[] = [];
  const prev = memory.lastMesoStart;
  if (prev && prev !== settings.mesoStart && !known.has(prev)) {
    // Reiniciou o ciclo: resume o anterior até o dia antes do novo começo (ou até o fim natural dele).
    const naturalEnd = addDays(prev, MESO_DAYS - 1);
    const end = settings.mesoStart > prev && settings.mesoStart <= naturalEnd ? addDays(settings.mesoStart, -1) : naturalEnd;
    const s = mesoSummaryFor(sessions, prev, end, settings.trainingDays);
    if (s) add.push(s);
  }
  const curEnd = addDays(settings.mesoStart, MESO_DAYS - 1);
  if (today > curEnd && !known.has(settings.mesoStart)) {
    const s = mesoSummaryFor(sessions, settings.mesoStart, curEnd, settings.trainingDays);
    if (s) add.push(s);
  }
  if (!add.length && prev === settings.mesoStart) return null;
  return {
    ...memory,
    lastMesoStart: settings.mesoStart,
    mesoHistory: [...memory.mesoHistory, ...add].sort((a, b) => a.start.localeCompare(b.start)).slice(-24),
  };
}

/** Mescla duas memórias (ex.: ao importar backup em modo "merge"), preservando restrições e ciclos por id/data. */
export function mergeOperatorMemory(current: OperatorMemory, incoming: OperatorMemory): OperatorMemory {
  const byId = new Map<string, Constraint>();
  for (const c of incoming.constraints) byId.set(c.id, c);
  for (const c of current.constraints) byId.set(c.id, c);
  const byStart = new Map<string, MesoSummary>();
  for (const m of incoming.mesoHistory) byStart.set(m.start, m);
  for (const m of current.mesoHistory) byStart.set(m.start, m);
  return {
    version: 1,
    calibrationUntil: current.calibrationUntil ?? incoming.calibrationUntil,
    constraints: [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    mesoHistory: [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)),
    ...(current.absences?.length || incoming.absences?.length
      ? {
          absences: [
            ...new Map([...(incoming.absences ?? []), ...(current.absences ?? [])].map((a) => [`${a.from}|${a.until}`, a])).values(),
          ].sort((a, b) => a.from.localeCompare(b.from)),
        }
      : {}),
  };
}

/** Restrições ainda válidas na data `today` (`expiresAt >= today`). */
export function activeConstraints(memory: OperatorMemory | undefined, today: string): Constraint[] {
  if (!memory) return [];
  return memory.constraints.filter((c) => c.expiresAt >= today);
}

// ---------- Estado Derivado do Operador ----------

export type CalibrationStage = "calibrando" | "aprendendo" | "calibrado";
export type ExerciseResponsiveness = "alta" | "normal" | "estagnado" | "desgastante";

export interface MuscleTwin {
  muscle: MuscleId;
  /** Multiplicador aprendido sobre a janela padrão de 36h/48h/72h (0.75 = recupera rápido, 1.0 = padrão, 1.35 = lento). */
  recoveryMultiplier: number;
  /** Confiança de 0 a 1 (precisa >= 0.5 para substituir a tabela fixa). */
  confidence: number;
  /** Quantos intervalos entre treinos desse músculo foram observados. */
  observations: number;
  /** Teto semanal tolerado (séries fracionadas) aprendido para o músculo. */
  volumeTolerance: number;
  /** Média de séries fracionadas por semana nas últimas 4 semanas. */
  avgWeeklySets: number;
}

export interface ExerciseTwin {
  libId: string;
  name: string;
  exposures: number;
  confidence: number;
  responsiveness: ExerciseResponsiveness;
  /** Variação relativa média do 1RM estimado por sessão (ex.: 0.02 = +2%/sessão). */
  e1rmSlopePct: number;
  /** Risco articular aprendido nas últimas 6 sessões (0 a 1). */
  jointRisk: number;
  /** Queixas articulares nas últimas 6 sessões. */
  jointComplaints: number;
}

export interface BehaviorTwin {
  /** Taxa de falta por dia da semana (0 = dom .. 6 = sáb) nas últimas semanas fechadas. */
  weekdayMissRate: Record<number, number>;
  /** Dia planejado em `trainingDays` com padrão recorrente de falta (>= 60% em >= 3 semanas), ou null. */
  vulnerableWeekday: number | null;
  /** Hora mediana em que costuma iniciar os treinos (0..23) ou null se < 4 sessões. */
  preferredHour: number | null;
  /** Razão mediana entre descanso real medido e descanso mínimo da ficha (1.0 = cumpre; < 0.65 = corta descanso). */
  restRatio: number;
  restConfidence: number;
  /** Fração de treinos cumpridos vs. planejados nas últimas 4 semanas fechadas (0..1). */
  adherenceRate: number;
  /** Taxa de aceitação da carga sugerida pelo motor (0..1; 1.0 = segue a sugestão). */
  loadAcceptanceRate: number;
}

/** Peso corporal: só a tendência recente (kg por semana) e se ela está rápida demais para progredir carga com folga. */
export interface BodyTwin {
  kgPerWeek: number | null;
  /** Perdendo 0,7 kg/semana ou mais por 2+ semanas: menos energia para subir carga nos compostos. */
  rapidLoss: boolean;
  /** Ganhando 0,7 kg/semana ou mais: provavelmente gordura, vale conferir a dieta. */
  rapidGain: boolean;
}

export interface OperatorState {
  body: BodyTwin;
  calibration: {
    stage: CalibrationStage;
    confidence: number;
    sessionsDone: number;
    inCalibrationWindow: boolean;
  };
  muscles: Record<MuscleId, MuscleTwin>;
  /** Indexado pelo id canônico da biblioteca (`ex.lib`), ou `exId` quando fora da biblioteca. */
  exercises: Record<string, ExerciseTwin>;
  behavior: BehaviorTwin;
  activeConstraints: Constraint[];
}

/** Janela padrão de recuperação em horas pelo volume da sessão anterior (mesma base de `visual.ts`). */
export function baseRecoveryHours(sets: number): number {
  return sets <= 3 ? 36 : sets <= 6 ? 48 : 72;
}

/**
 * Horas efetivas de recuperação para um músculo: usa o multiplicador aprendido do gêmeo apenas quando
 * a confiança mínima (`>= 0.5`, ou seja, pelo menos 4 intervalos medidos) foi atingida.
 */
export function effectiveRecoveryHours(sets: number, twin?: Pick<MuscleTwin, "recoveryMultiplier" | "confidence">): number {
  const base = baseRecoveryHours(sets);
  if (!twin || twin.confidence < 0.5) return base;
  return Math.round(base * twin.recoveryMultiplier);
}

/** Mapa de multiplicadores dos músculos que já atingiram confiança >= 0.5 (para alimentar `muscleStatus` em `visual.ts`). */
export function learnedRecoveryMultipliers(state: OperatorState | undefined): Partial<Record<MuscleId, number>> {
  if (!state) return {};
  const out: Partial<Record<MuscleId, number>> = {};
  for (const m of MUSCLE_ORDER) {
    const t = state.muscles[m];
    if (t && t.confidence >= 0.5 && Math.abs(t.recoveryMultiplier - 1) >= 0.03) {
      out[m] = t.recoveryMultiplier;
    }
  }
  return out;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

interface MuscleSessionPoint {
  date: string;
  week: number;
  at: number;
  sets: number;
  directSets: number;
  sleepBad: boolean;
  underFirstSetAtSameOrLowerLoad: boolean;
  beatTop: boolean;
  tooMuchVolume: boolean;
  easyOrGoodVolume: boolean;
  /** Só trabalho indireto relevante (ex.: supino pesado para o tríceps): reinicia o relógio, não gera sinal. */
  indirectOnly?: boolean;
}

/** Séries indiretas (já com o peso de sinergista) a partir das quais um treino conta como estresse para o músculo. */
export const INDIRECT_STRESS_SETS = 2;

function RestIntervalsOfEntry(entry: SessionExercise): number[] {
  const work = entry.sets.filter((s) => s.done && (s.kind === "work" || s.kind === "drop") && s.doneAt != null);
  const out: number[] = [];
  for (let i = 1; i < work.length; i++) {
    const sec = Math.round((work[i].doneAt! - work[i - 1].doneAt!) / 1000);
    if (sec >= 15 && sec <= 600) out.push(sec);
  }
  return out;
}

/**
 * Calcula o estado completo do gêmeo digital em O(N) a partir das sessões concluídas, peso corporal,
 * ajustes e memória declarada.
 */
export function operatorState(
  sessions: Session[],
  bodyLog: BodyEntry[],
  settings: Settings,
  memory: OperatorMemory = EMPTY_OPERATOR_MEMORY,
  today: string,
): OperatorState {
  const trend = weightTrend(bodyLog.filter((e) => e.date <= today));
  const trendOk = trend != null && trend.spanDays >= 14;
  const body: BodyTwin = {
    kgPerWeek: trendOk ? Math.round(trend.kgPerWeek * 100) / 100 : null,
    rapidLoss: trendOk && trend.kgPerWeek <= -0.7,
    rapidGain: trendOk && trend.kgPerWeek >= 0.7,
  };
  const done = sessions.filter((s) => s.status === "done" && s.date <= today).sort(bySessionAsc);
  const sessionsDone = done.length;
  const stage: CalibrationStage = sessionsDone < 4 ? "calibrando" : sessionsDone < 12 ? "aprendendo" : "calibrado";
  const calConfidence = Number(clamp(sessionsDone / 12, 0, 1).toFixed(2));
  const inCalibrationWindow = (memory.calibrationUntil != null && today <= memory.calibrationUntil) || sessionsDone < 4;

  // ---------- 1. Curva por músculo ----------
  const musclePoints = new Map<MuscleId, MuscleSessionPoint[]>();
  for (const m of MUSCLE_ORDER) musclePoints.set(m, []);

  // Volume nas últimas 4 semanas (28 dias até `today`)
  const since28 = addDays(today, -27);
  const setsLast28: Record<MuscleId, number> = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as Record<MuscleId, number>;
  // Última carga principal (em kg) vista por libId para distinguir queda de reps por subida de peso vs. falta de recuperação
  const lastLoadByLib = new Map<string, { entry: SessionExercise; week: number; loadKg: number }>();
  let suggestionChecks = 0;
  let suggestionMatches = 0;

  for (const s of done) {
    const at = s.finishedAt ?? Date.parse(`${s.date}T12:00:00`);
    const sleepBad = !!s.checkin && !s.checkin.skipped && (s.checkin.sleep === "ruim" || s.checkin.energy === "baixa");
    const perMuscle = new Map<
      MuscleId,
      {
        sets: number;
        directSets: number;
        underFirstSetAtSameOrLowerLoad: boolean;
        beatTop: boolean;
        tooMuchVolume: boolean;
        easyOrGoodVolume: boolean;
      }
    >();

    const ensure = (m: MuscleId) => {
      let cur = perMuscle.get(m);
      if (!cur) {
        cur = {
          sets: 0,
          directSets: 0,
          underFirstSetAtSameOrLowerLoad: false,
          beatTop: false,
          tooMuchVolume: false,
          easyOrGoodVolume: false,
        };
        perMuscle.set(m, cur);
      }
      return cur;
    };

    for (const entry of s.exercises) {
      const ex = exOf(entry);
      if (!ex) continue;
      const w = workSets(entry, false);
      if (!w.length) continue;
      const n = w.length;
      const libKey = entry.alt ? `${ex.lib}::${entry.alt}` : ex.lib;
      const prevSeen = lastLoadByLib.get(libKey);
      const curLoadRaw = mainLoad(w);
      const curLoadKg = curLoadRaw != null ? toKg(curLoadRaw, entry.unit) : 0;

      if (prevSeen && curLoadRaw != null && s.week !== 7) {
        const step = increaseStep(ex, entry.unit, settings.increments[ex.id]);
        const planned = setsFor(ex, s.week, settings.setAdjust?.[ex.id]);
        const sug = suggest(ex, prevSeen.entry, planned, s.week, step, prevSeen.week, settings.machineWeights?.[ex.id]);
        if (sug.weight != null) {
          suggestionChecks += 1;
          if (Math.abs(curLoadRaw - sug.weight) <= 0.1) suggestionMatches += 1;
        }
      }

      // Só conta queda abaixo do piso como falha de recuperação quando NÃO houve subida de carga em relação à última sessão
      const loadIncreased = prevSeen != null && curLoadKg > prevSeen.loadKg + 0.1;
      if (curLoadKg > 0 && s.week !== 7) {
        lastLoadByLib.set(libKey, { entry, week: s.week, loadKg: curLoadKg });
      }

      const firstReps = w[0]?.reps ?? 0;
      const hitTop = w.every((st) => (st.reps ?? 0) >= ex.reps[1]);
      const underFloor = firstReps > 0 && firstReps < ex.reps[0] && !loadIncreased;
      const volFb = entry.feedback && !entry.feedback.skipped ? entry.feedback.volume : undefined;

      for (const m of ex.muscles) {
        const rec = ensure(m);
        rec.sets += n;
        rec.directSets += n;
        if (underFloor) rec.underFirstSetAtSameOrLowerLoad = true;
        if (hitTop) rec.beatTop = true;
        if (volFb === "pesado") rec.tooMuchVolume = true;
        if (volFb === "leve" || volFb === "ok") rec.easyOrGoodVolume = true;
        if (s.date >= since28) setsLast28[m] += n;
      }
      for (const m of synergistsOf(ex)) {
        if (ex.muscles.includes(m)) continue;
        const rec = ensure(m);
        rec.sets += n * SCIENCE.indirectSetWeight;
        if (s.date >= since28) setsLast28[m] += n * SCIENCE.indirectSetWeight;
      }
    }

    for (const [m, rec] of perMuscle) {
      if (rec.directSets <= 0) {
        // Treino sem série direta, mas com trabalho indireto relevante: vira um ponto de estresse. O intervalo seguinte
        // passa a contar dele (senão o app via "recupera devagar" quando, no meio, houve um supino pesado).
        if (rec.sets >= INDIRECT_STRESS_SETS) {
          musclePoints.get(m)!.push({
            date: s.date,
            week: s.week,
            at,
            sets: Math.ceil(rec.sets),
            directSets: 0,
            sleepBad,
            underFirstSetAtSameOrLowerLoad: false,
            beatTop: false,
            tooMuchVolume: false,
            easyOrGoodVolume: false,
            indirectOnly: true,
          });
        }
        continue;
      }
      musclePoints.get(m)!.push({
        date: s.date,
        week: s.week,
        at,
        sets: Math.ceil(rec.sets),
        directSets: rec.directSets,
        sleepBad,
        underFirstSetAtSameOrLowerLoad: rec.underFirstSetAtSameOrLowerLoad,
        beatTop: rec.beatTop,
        tooMuchVolume: rec.tooMuchVolume,
        easyOrGoodVolume: rec.easyOrGoodVolume,
      });
    }
  }

  const muscles = {} as Record<MuscleId, MuscleTwin>;
  const defaultTolerance = SCIENCE.volume.efficient[1];
  const PRIOR_K = 2.5;

  for (const m of MUSCLE_ORDER) {
    const pts = musclePoints.get(m)!;
    const samples: number[] = [];
    let fastSignals = 0;
    let slowSignals = 0;

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      // Ponto de estresse indireto: só reinicia o relógio (o próximo par mede a partir dele), sem sinal.
      if (curr.indirectOnly) continue;
      // Intervalo medido de um estresse indireto: a fadiga pode ser do supino, não do tríceps. Sem sinal.
      if (prev.indirectOnly) continue;
      const hours = (curr.at - prev.at) / 3600_000;
      if (hours < 16 || hours > 168) continue;
      const expected = baseRecoveryHours(prev.sets);
      const ratio = hours / expected;
      // Nas semanas 5–6 (pico planejado de falha), só interpreta como recuperação lenta se cair abaixo do piso E acusar volume pesado
      const isPeakWeek = curr.week === 5 || curr.week === 6;
      const slowFatigue = isPeakWeek
        ? curr.underFirstSetAtSameOrLowerLoad && curr.tooMuchVolume
        : curr.underFirstSetAtSameOrLowerLoad || curr.tooMuchVolume;

      if (slowFatigue && !curr.sleepBad) {
        samples.push(clamp(Math.max(1.16, ratio * 1.22), 1.12, 1.35));
        slowSignals += 1;
      } else if (ratio <= 1.05 && (curr.beatTop || curr.easyOrGoodVolume) && !curr.underFirstSetAtSameOrLowerLoad && !curr.tooMuchVolume) {
        samples.push(clamp(Math.min(0.88, ratio * 0.86), 0.75, 0.92));
        fastSignals += 1;
      } else if (ratio <= 1.35) {
        // Intervalos muito longos (ex.: 5 dias de descanso) sem fadiga não testam a janela de 36–72h (observação censurada)
        samples.push(1.0);
      }
    }

    const observations = samples.length;
    const sampleSum = samples.reduce((a, b) => a + b, 0);
    // Encolhimento empírico (Empirical Bayes) rumo ao prior 1.0: (k·1.0 + Σx) / (k + n)
    const shrunk = (PRIOR_K * 1.0 + sampleSum) / (PRIOR_K + observations);
    const mean = observations > 0 ? sampleSum / observations : 1.0;
    const variance = observations > 1 ? samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / observations : 0;
    // Confiança cresce com o número de observações (n / (n + k)) e cai quando há alta dispersão entre os sinais
    const rawConf = observations > 0 ? (observations / (observations + PRIOR_K)) * (1 / (1 + 6 * variance)) : 0;
    const confidence = Number(clamp(rawConf, 0, 1).toFixed(2));
    const recoveryMultiplier = Number(clamp(shrunk, 0.75, 1.35).toFixed(2));

    const avgWeeklySets = Number((setsLast28[m] / 4).toFixed(1));
    let volumeTolerance = defaultTolerance;
    if (confidence >= 0.5) {
      if (slowSignals >= 2 && slowSignals > fastSignals) {
        volumeTolerance = Math.max(SCIENCE.volume.minEffective + 2, defaultTolerance - 2);
      } else if (fastSignals >= 2 && slowSignals === 0) {
        volumeTolerance = defaultTolerance + 2;
      }
    }

    muscles[m] = {
      muscle: m,
      recoveryMultiplier,
      confidence,
      observations,
      volumeTolerance,
      avgWeeklySets,
    };
  }

  // ---------- 2. Responsividade e Sensibilidade Articular por Exercício (libId) ----------
  const byLib = new Map<
    string,
    {
      name: string;
      items: { week: number; e1rm: number; jointBad: boolean; heavyVolume: boolean }[];
    }
  >();

  for (const s of done) {
    for (const entry of s.exercises) {
      const w = workSets(entry, false);
      if (!w.length) continue;
      const ex = exOf(entry) ?? exById(entry.exId);
      const libId = ex?.lib ?? entry.exId;
      const name = entry.alt || shortName(ex) || entry.exId;
      let group = byLib.get(libId);
      if (!group) {
        group = { name, items: [] };
        byLib.set(libId, group);
      }
      const topOneRm = bestE1rm(entry);
      const jointBad = entry.feedback?.joint === "incomodou";
      const heavyVolume = entry.feedback?.volume === "pesado";
      group.items.push({ week: s.week, e1rm: topOneRm, jointBad, heavyVolume });
    }
  }

  const exercises: Record<string, ExerciseTwin> = {};
  for (const [libId, group] of byLib) {
    const exposures = group.items.length;
    const confidence = Number(clamp(exposures / 6, 0, 1).toFixed(2));
    const recent6 = group.items.slice(-6);
    const jointComplaints = recent6.filter((x) => x.jointBad).length;

    // Risco articular: mais peso para as 3 exposições mais recentes
    let weightedSum = 0;
    let weightTotal = 0;
    recent6.forEach((item, idx) => {
      const w = idx >= recent6.length - 3 ? 1.5 : 1.0;
      weightTotal += w;
      if (item.jointBad) weightedSum += w;
    });
    const jointRisk = weightTotal > 0 ? Number(clamp(weightedSum / weightTotal, 0, 1).toFixed(2)) : 0;

    // Inclinação de 1RM nas sessões fora de deload
    const nonDeload = group.items.filter((x) => x.week !== 7 && x.e1rm > 0);
    const slopes: number[] = [];
    for (let i = 1; i < nonDeload.length; i++) {
      const prev = nonDeload[i - 1].e1rm;
      const cur = nonDeload[i].e1rm;
      if (prev > 0) slopes.push((cur - prev) / prev);
    }
    const e1rmSlopePct = slopes.length > 0 ? Number((slopes.reduce((a, b) => a + b, 0) / slopes.length).toFixed(4)) : 0;

    let responsiveness: ExerciseResponsiveness = "normal";
    if (exposures >= 3) {
      const last3 = nonDeload.slice(-3);
      const stalled3 = last3.length === 3 && last3[1].e1rm <= last3[0].e1rm + 1e-6 && last3[2].e1rm <= last3[0].e1rm + 1e-6;
      const heavyCount = recent6.slice(-3).filter((x) => x.heavyVolume).length;
      if (jointComplaints >= 2 || (heavyCount >= 2 && e1rmSlopePct <= 0.002)) {
        responsiveness = "desgastante";
      } else if (stalled3) {
        responsiveness = "estagnado";
      } else if (e1rmSlopePct >= 0.015) {
        responsiveness = "alta";
      }
    }

    exercises[libId] = {
      libId,
      name: group.name,
      exposures,
      confidence,
      responsiveness,
      e1rmSlopePct,
      jointRisk,
      jointComplaints,
    };
  }

  // ---------- 3. Padrões Comportamentais ----------
  const weekdayMissRate: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let vulnerableWeekday: number | null = null;
  let adherenceRate = 1;

  const currentMonday = mondayOf(today);
  if (done.length > 0 && settings.trainingDays.length > 0) {
    const firstMonday = mondayOf(done[0].date);
    const closedWeeks: string[] = [];
    for (let w = addDays(currentMonday, -7); w >= firstMonday && closedWeeks.length < 6; w = addDays(w, -7)) {
      closedWeeks.push(w);
    }

    if (closedWeeks.length > 0) {
      const doneDates = new Set(done.map((s) => s.date));
      const missCounts = new Map<number, number>();
      for (const wd of settings.trainingDays) missCounts.set(wd, 0);

      let totalPlannedLast4 = 0;
      let totalDoneLast4 = 0;

      closedWeeks.forEach((wStart, wIdx) => {
        const wEnd = addDays(wStart, 7);
        const sessionsInWeek = done.filter((s) => s.date >= wStart && s.date < wEnd).length;
        if (wIdx < 4) {
          totalPlannedLast4 += settings.trainingDays.length;
          totalDoneLast4 += Math.min(settings.trainingDays.length, sessionsInWeek);
        }
        for (let offset = 0; offset < 7; offset++) {
          const d = addDays(wStart, offset);
          const wd = fromISO(d).getDay();
          if (!settings.trainingDays.includes(wd)) continue;
          if (!doneDates.has(d)) {
            missCounts.set(wd, (missCounts.get(wd) ?? 0) + 1);
          }
        }
      });

      if (totalPlannedLast4 > 0) {
        adherenceRate = Number(clamp(totalDoneLast4 / totalPlannedLast4, 0, 1).toFixed(2));
      }

      let worstWd: number | null = null;
      let worstRate = 0;
      for (const [wd, misses] of missCounts) {
        const rate = Number((misses / closedWeeks.length).toFixed(2));
        weekdayMissRate[wd] = rate;
        if (closedWeeks.length >= 3 && rate >= 0.6 && rate > worstRate) {
          worstRate = rate;
          worstWd = wd;
        }
      }
      vulnerableWeekday = worstWd;
    }
  }

  // Hora preferida de treino
  const recentWithClock = done.slice(-12).filter((s) => Number.isFinite(s.startedAt) && s.startedAt > 0);
  const preferredHour =
    recentWithClock.length >= 4 ? Math.round(median(recentWithClock.map((s) => new Date(s.startedAt).getHours()))) : null;

  // Cumprimento do descanso entre séries
  const restRatios: number[] = [];
  for (const s of done.slice(-10)) {
    for (const entry of s.exercises) {
      const ex = exOf(entry);
      if (!ex || ex.superset || ex.rest[0] < 60) continue;
      for (const sec of RestIntervalsOfEntry(entry)) {
        restRatios.push(sec / ex.rest[0]);
      }
    }
  }
  const restConfidence = Number(clamp(restRatios.length / 12, 0, 1).toFixed(2));
  const restRatio = restRatios.length >= 6 ? Number(clamp(median(restRatios), 0.2, 2.0).toFixed(2)) : 1.0;
  const loadAcceptanceRate = suggestionChecks >= 2 ? Number(clamp(suggestionMatches / suggestionChecks, 0, 1).toFixed(2)) : 1.0;

  return {
    calibration: {
      stage,
      confidence: calConfidence,
      sessionsDone,
      inCalibrationWindow,
    },
    muscles,
    exercises,
    behavior: {
      weekdayMissRate,
      vulnerableWeekday,
      preferredHour,
      restRatio,
      restConfidence,
      adherenceRate,
      loadAcceptanceRate,
    },
    activeConstraints: activeConstraints(memory, today),
    body,
  };
}

/**
 * Previsão testável de repetições na 1ª série para `targetWeight` (na unidade do exercício),
 * combinando a tendência recente de 1RM estimado com o desconto de recuperação aprendida do gêmeo.
 */
export function predictFirstSetReps(
  ex: ProgramExercise,
  targetWeight: number,
  hist: { session: Session; entry: SessionExercise }[],
  operator?: OperatorState,
  hoursSinceLast?: number,
): { predictedReps: number; baselineOneRm: number; confidence: number } | null {
  if (targetWeight <= 0) return null;
  const nonDeload = hist.filter((h) => h.session.week !== 7 && workSets(h.entry, false).length > 0).slice(-4);
  if (!nonDeload.length) return null;

  // Média móvel exponencial dos últimos até 4 registros de 1RM (na unidade do último registro)
  let ema = 0;
  for (const h of nonDeload) {
    const w = workSets(h.entry, false);
    const est = Math.max(...w.map((s) => (s.weight ?? 0) * (1 + ((s.reps ?? 0) + (s.rir ?? 0)) / 30)));
    ema = ema === 0 ? est : 0.6 * est + 0.4 * ema;
  }
  const exTwin = operator?.exercises[ex.lib];
  const slopeBoost = exTwin && exTwin.confidence >= 0.5 ? clamp(exTwin.e1rmSlopePct, -0.02, 0.03) : 0;
  let effectiveOneRm = ema * (1 + slopeBoost);

  // Se o músculo primário ainda não completou a janela efetiva de recuperação, desconta até 6% do 1RM
  const primaryMuscle = ex.muscles[0];
  if (primaryMuscle && hoursSinceLast != null && hoursSinceLast > 0) {
    const lastSets = workSets(nonDeload[nonDeload.length - 1].entry, false).length;
    const needed = effectiveRecoveryHours(lastSets, operator?.muscles[primaryMuscle]);
    if (hoursSinceLast < needed) {
      const deficit = clamp(1 - hoursSinceLast / needed, 0, 0.5);
      effectiveOneRm *= 1 - deficit * 0.12;
    }
  }

  const predictedReps = Math.max(1, predictReps(effectiveOneRm, targetWeight));
  const confidence = Number(clamp(nonDeload.length / 4, 0.25, 1).toFixed(2));
  return {
    predictedReps,
    baselineOneRm: Number(effectiveOneRm.toFixed(1)),
    confidence,
  };
}

export interface SyntheticOperatorSpec {
  seed: number;
  weeks: number;
  startDate: string;
  trainingDays: number[];
  preferredHour: number;
  missWeekday?: number;
  trueRestRatio: number;
  /** Multiplicadores reais escondidos (> 1 = recupera devagar; < 1 = recupera rápido). */
  trueMuscleRecovery: Partial<Record<MuscleId, number>>;
  jointPainLibId?: string;
}

/**
 * Simulador determinístico (PRNG Mulberry32 com semente fixa) que gera semanas de sessões com ruído fisiológico
 * a partir de parâmetros reais escondidos, para testar se `operatorState()` recupera esses parâmetros.
 */
export function simulateOperator(spec: SyntheticOperatorSpec): Session[] {
  let state = spec.seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const sessions: Session[] = [];
  const lastAtByMuscle = new Map<MuscleId, { at: number; sets: number }>();
  const baseLoadByEx: Record<string, number> = {
    "push-a.supino-incl-halt": 24,
    "push-a.triceps-testa": 14,
    "lower-a.hack": 90,
  };

  for (let w = 0; w < spec.weeks; w++) {
    const weekMonday = addDays(spec.startDate, w * 7);
    const mesoWeek = (w % 6) + 1;
    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(weekMonday, offset);
      const wd = fromISO(date).getDay();
      if (!spec.trainingDays.includes(wd)) continue;
      if (spec.missWeekday === wd && rand() < 0.85) continue;

      const isPush = offset % 2 === 0;
      const dayId = isPush ? "push-a" : "lower-a";
      const exId = isPush ? "push-a.supino-incl-halt" : "lower-a.hack";
      const muscle: MuscleId = isPush ? "peito" : "quadriceps";
      const libId = isPush ? "supino-inclinado-halteres" : "hack";
      const minRestSec = isPush ? 120 : 180;

      const hourJitter = rand() < 0.2 ? (rand() < 0.5 ? -1 : 1) : 0;
      const hour = clamp(spec.preferredHour + hourJitter, 6, 22);
      const startedAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).getTime();
      const finishedAt = startedAt + 55 * 60_000;

      const prevMuscle = lastAtByMuscle.get(muscle);
      const hoursSince = prevMuscle ? (finishedAt - prevMuscle.at) / 3600_000 : 96;
      const trueMult = spec.trueMuscleRecovery[muscle] ?? 1.0;
      const trueNeededHours = baseRecoveryHours(prevMuscle?.sets ?? 4) * trueMult;
      const recovered = hoursSince >= trueNeededHours;

      // Se recuperou bem, sobe carga ou bate o topo da faixa (10 reps); se não recuperou, cai abaixo do piso (5 reps) na mesma carga
      if (recovered && w > 0 && trueMult <= 0.9) {
        baseLoadByEx[exId] += 2;
      }
      const weight = baseLoadByEx[exId];
      const reps = recovered ? (trueMult <= 0.9 ? 10 : 8) : 5;
      const actualRestSec = Math.round(minRestSec * spec.trueRestRatio * (0.92 + rand() * 0.16));

      const sets = Array.from({ length: 4 }, (_, idx) => ({
        id: `sim-${w}-${offset}-${idx}`,
        kind: "work" as const,
        weight,
        reps,
        done: true,
        doneAt: startedAt + (idx + 1) * actualRestSec * 1000,
      }));

      const exercises: SessionExercise[] = [
        {
          exId,
          unit: "kg",
          sets,
          feedback: {
            pump: "bom",
            volume: recovered ? (trueMult <= 0.9 ? "leve" : "ok") : "pesado",
            joint: spec.jointPainLibId === libId && rand() < 0.75 ? "incomodou" : "ok",
          },
        },
      ];

      lastAtByMuscle.set(muscle, { at: finishedAt, sets: 4 });
      sessions.push({
        id: `sim-${w}-${offset}`,
        dayId,
        date,
        week: mesoWeek,
        startedAt,
        finishedAt,
        status: "done",
        checkin: { sleep: "ok", energy: "ok", pain: "nenhuma" },
        exercises,
      });
    }
  }
  return sessions;
}

export interface OperatorBrief {
  code: string;
  headline: string;
  detail: string;
  tone: "info" | "good" | "warn";
  /** `true` = nada pede atenção hoje. A tela Hoje fica em silêncio; o Relatório ainda mostra. */
  silent: boolean;
}

const WEEKDAY_LABELS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * Resumo curto de 1 cartão do que o AUG.CORE aprendeu sobre o operador até agora,
 * priorizando restrições ativas > alertas biomecânicos/comportamentais > curva aprendida > calibração.
 */
export function operatorBrief(state: OperatorState): OperatorBrief {
  if (state.activeConstraints.length > 0) {
    const c = state.activeConstraints[0];
    if (c.kind === "time-cap") {
      return {
        code: "AUG.CORE // MODO RÁPIDO",
        headline: `Treino de hoje cabe em ${c.minutes} min`,
        detail: "Os exercícios principais ficam inteiros; saem séries do fim do treino.",
        tone: "info",
        silent: false,
      };
    }
    if (c.kind === "equipment") {
      return {
        code: "AUG.CORE // EQUIPAMENTO",
        headline: `Treinando só com ${c.allowed.join(", ").replace(/-/g, " ")}`,
        detail: "O que precisa de outro aparelho foi trocado por uma versão parecida, só por estes dias.",
        tone: "info",
        silent: false,
      };
    }
    if (c.kind === "pain") {
      const target = c.muscle ? MUSCLE_LABEL[c.muscle] : (c.libId ?? "articulação");
      return {
        code: "AUG.CORE // PROTEÇÃO ARTICULAR",
        headline: `Cuidando de ${target.toLowerCase()}`,
        detail: "Nos exercícios dessa região, o app troca por uma versão mais confortável e para antes da falha.",
        tone: "warn",
        silent: false,
      };
    }
    if (c.kind === "schedule") {
      return {
        code: "AUG.CORE // ROTINA",
        headline: c.note,
        detail: "Semana mais leve: menos séries, mesma carga. Dá para manter o que você ganhou sem se desgastar.",
        tone: "info",
        silent: false,
      };
    }
  }

  if (state.calibration.stage === "calibrando") {
    const rem = Math.max(1, 4 - state.calibration.sessionsDone);
    return {
      code: "AUG.CORE // CALIBRAÇÃO",
      headline:
        state.calibration.sessionsDone === 0
          ? "O app ainda está te conhecendo"
          : `Te conhecendo (${state.calibration.sessionsDone} de 4 treinos)`,
      detail: `Faltam ${rem} ${rem === 1 ? "treino" : "treinos"} para o app ajustar as sugestões ao seu ritmo de recuperação.`,
      tone: "info",
      silent: false,
    };
  }

  const highRiskEx = Object.values(state.exercises)
    .filter((e) => e.confidence >= 0.5 && e.jointRisk >= 0.5)
    .sort((a, b) => b.jointRisk - a.jointRisk)[0];
  if (highRiskEx) {
    return {
      code: "AUG.CORE // ARTICULAÇÃO",
      headline: `${highRiskEx.name} incomodou ${highRiskEx.jointComplaints} vezes`,
      detail: "Vale trocar por uma versão parecida por um tempo. O app sugere a troca na hora do treino.",
      tone: "warn",
      silent: false,
    };
  }

  if (state.behavior.restConfidence >= 0.5 && state.behavior.restRatio < 0.65) {
    return {
      code: "AUG.CORE // DESCANSO",
      headline: "Você descansa menos do que a ficha pede",
      detail: `Seu intervalo fica em ${Math.round(state.behavior.restRatio * 100)}% do combinado. Descansar o tempo cheio rende mais repetições nas séries seguintes.`,
      tone: "warn",
      silent: false,
    };
  }

  if (state.behavior.vulnerableWeekday != null) {
    const wdName = WEEKDAY_LABELS[state.behavior.vulnerableWeekday];
    const pct = Math.round(state.behavior.weekdayMissRate[state.behavior.vulnerableWeekday] * 100);
    return {
      code: "AUG.CORE // AGENDA",
      headline: `A ${wdName} costuma falhar (${pct}% das vezes)`,
      detail: `Se esse dia é corrido, mude o dia de treino em Ajustes. A sequência continua de onde parou.`,
      tone: "info",
      silent: false,
    };
  }

  const fastMuscles = MUSCLE_ORDER.filter((m) => state.muscles[m].confidence >= 0.5 && state.muscles[m].recoveryMultiplier <= 0.9).map(
    (m) => MUSCLE_LABEL[m],
  );
  const slowMuscles = MUSCLE_ORDER.filter((m) => state.muscles[m].confidence >= 0.5 && state.muscles[m].recoveryMultiplier >= 1.12).map(
    (m) => MUSCLE_LABEL[m],
  );

  if (state.body.rapidLoss) {
    return {
      code: "AUG.CORE // PESO",
      headline: "Peso caindo rápido",
      detail: `Cerca de ${Math.abs(state.body.kgPerWeek ?? 0)
        .toFixed(1)
        .replace(".", ",")} kg por semana. Com menos energia, é normal a carga não subir: segure o que tem e cuide da comida.`,
      tone: "warn",
      silent: false,
    };
  }

  if (fastMuscles.length || slowMuscles.length) {
    const parts: string[] = [];
    if (fastMuscles.length) parts.push(`${fastMuscles.slice(0, 2).join(" e ").toLowerCase()} se recupera mais rápido que a média`);
    if (slowMuscles.length) parts.push(`${slowMuscles.slice(0, 2).join(" e ").toLowerCase()} precisa de mais descanso`);
    return {
      code: "AUG.CORE // SEU RITMO",
      headline: "O app já conhece seu ritmo",
      detail: `${parts.join("; ")}. O mapa de fadiga usa esses tempos.`,
      tone: "good",
      silent: true,
    };
  }

  const topEx = Object.values(state.exercises)
    .filter((e) => e.confidence >= 0.5 && e.responsiveness === "alta")
    .sort((a, b) => b.e1rmSlopePct - a.e1rmSlopePct)[0];
  if (topEx) {
    return {
      code: "AUG.CORE // SEU RITMO",
      headline: `${topEx.name} está rendendo bem`,
      detail: `Sua força nele sobe cerca de ${(topEx.e1rmSlopePct * 100).toFixed(1).replace(".", ",")}% por treino.`,
      tone: "good",
      silent: true,
    };
  }

  return {
    code: "AUG.CORE // SEU RITMO",
    headline: `Tudo dentro do esperado (${state.calibration.sessionsDone} treinos lidos)`,
    detail: "Recuperação e progressão dentro do que a ficha prevê.",
    tone: "good",
    silent: true,
  };
}
