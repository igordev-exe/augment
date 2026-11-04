import { DAY_BY_ID, EXERCISE_BY_ID, MUSCLE_ORDER } from "../data/program";
import { SCIENCE, SYNERGISTS } from "../data/science";
import type { MuscleId, ProgramExercise, Session, SessionExercise, SetEntry, Settings, Unit } from "../data/types";
import { addDays, mondayOf } from "./dates";
import { setsFor, warmupsFor } from "./mesocycle";
import { historyOf, increaseStep, loadRef, suggestNext, toKg, workSets } from "./progression";
import { uid } from "./db";

function emptySet(kind: SetEntry["kind"], weight: number | null = null): SetEntry {
  return { id: uid(), kind, weight, reps: null, done: false };
}

export function unitFor(exId: string, settings: Settings, last?: SessionExercise): Unit {
  return settings.units[exId] ?? last?.unit ?? EXERCISE_BY_ID[exId]?.defaultUnit ?? "kg";
}

/** Monta uma sessão nova do dia, já com aquecimentos, séries da semana e cargas sugeridas. */
export function buildSession(
  dayId: string,
  date: string,
  week: number,
  settings: Settings,
  allSessions: Session[],
  repeatFrom?: Session,
): Session {
  const day = DAY_BY_ID[dayId];
  const exercises: SessionExercise[] = day.exercises.map((ex, i) => {
    const defaultAlt = settings.swaps?.[ex.id] || undefined;
    const hist = historyOf(allSessions, ex.id, defaultAlt);
    const lastItem = hist[hist.length - 1];
    const last = lastItem?.entry;
    const unit = unitFor(ex.id, settings, last);
    const planned = setsFor(ex, week);
    const sets: SetEntry[] = [];
    for (let w = 0; w < warmupsFor(i); w++) sets.push(emptySet("warmup"));

    const source = repeatFrom?.exercises.find((e) => e.exId === ex.id);
    if (source && workSets(source).length) {
      // Carga fixa: todas as séries de trabalho com a carga principal (ignora a última com −15%).
      const main = workSets(source, false);
      const ref = main.length ? loadRef(main) : { load: workSets(source)[0].weight!, anchor: false, volumeLoad: undefined };
      for (let k = 0; k < planned; k++) sets.push(emptySet("work", k > 0 && ref.anchor ? (ref.volumeLoad ?? ref.load) : ref.load));
      return { exId: ex.id, unit: source.unit, alt: source.alt ?? defaultAlt, sets };
    }

    const step = increaseStep(ex, unit, settings.increments[ex.id]);
    const available = settings.machineWeights?.[ex.id];
    const s = suggestNext(ex, hist, planned, week, step, available);
    // Formato série-âncora: a 1ª com a carga da âncora, as de volume com a carga mais leve.
    for (let k = 0; k < planned; k++) sets.push(emptySet("work", k > 0 && s.volumeWeight != null ? s.volumeWeight : s.weight));
    return { exId: ex.id, unit, alt: defaultAlt, sets };
  });

  return {
    id: uid(),
    dayId,
    date,
    week,
    startedAt: Date.now(),
    status: "active",
    exercises,
    repeatedFrom: repeatFrom?.id,
  };
}

export function newSet(kind: SetEntry["kind"], weight: number | null): SetEntry {
  return emptySet(kind, weight);
}

/**
 * Calcula o horário final real ao concluir o treino: se ficou aberto por mais de 2h30
 * após o início e a última série foi marcada há mais de 30 min (esqueceu de concluir),
 * usa o horário da última série marcada (+3 min). Se ainda estava marcando séries nos
 * últimos 30 min, preserva a duração real.
 */
export function effectiveEndAt(s: Session, now = Date.now()): { finishedAt: number; capped: boolean } {
  const maxIdleMs = 2.5 * 3600_000;
  if (now - s.startedAt <= maxIdleMs) return { finishedAt: now, capped: false };
  const lastDoneAt = Math.max(0, ...s.exercises.flatMap((e) => e.sets.filter((x) => x.done && x.doneAt != null).map((x) => x.doneAt!)));
  if (lastDoneAt > s.startedAt) {
    if (now - lastDoneAt <= 30 * 60_000) return { finishedAt: now, capped: false };
    return { finishedAt: lastDoneAt + 3 * 60_000, capped: true };
  }
  return { finishedAt: s.startedAt + 90 * 60_000, capped: true };
}

export function sessionStats(s: Session) {
  let sets = 0;
  let volumeKg = 0;
  for (const e of s.exercises) {
    for (const st of workSets(e)) {
      sets++;
      volumeKg += toKg(st.weight!, e.unit) * st.reps!;
    }
  }
  const duration = Math.max(0, (s.finishedAt ?? Date.now()) - s.startedAt);
  return { sets, volumeKg, duration };
}

function emptyVolume(): Record<MuscleId, number> {
  return Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as Record<MuscleId, number>;
}

/** Soma `n` séries do exercício: 1,0 nos músculos diretos e, no modo fracionado, 0,5 nos sinergistas (Pelland 2026). */
function addSets(out: Record<MuscleId, number>, ex: ProgramExercise, n: number, fractional: boolean) {
  for (const m of ex.muscles) out[m] += n;
  if (!fractional) return;
  for (const m of SYNERGISTS[ex.lib] ?? []) if (!ex.muscles.includes(m)) out[m] += n * SCIENCE.indirectSetWeight;
}

/**
 * Séries de trabalho feitas por músculo na semana (seg–dom) que contém `date`.
 * `fractional`: soma também 0,5 por série indireta (supino → tríceps etc.).
 */
export function weeklyVolume(sessions: Session[], date: string, fractional = false): Record<MuscleId, number> {
  const start = mondayOf(date);
  const end = addDays(start, 7);
  const out = emptyVolume();
  for (const s of sessions) {
    if (s.date < start || s.date >= end) continue;
    for (const e of s.exercises) {
      const ex = EXERCISE_BY_ID[e.exId];
      if (ex) addSets(out, ex, workSets(e).length, fractional);
    }
  }
  return out;
}

/** Séries planejadas por músculo para uma semana do mesociclo (diretas, ou fracionadas com `fractional`). */
export function plannedVolume(week: number, fractional = false): Record<MuscleId, number> {
  const out = emptyVolume();
  for (const d of Object.values(DAY_BY_ID)) {
    for (const ex of d.exercises) addSets(out, ex, setsFor(ex, week), fractional);
  }
  return out;
}
