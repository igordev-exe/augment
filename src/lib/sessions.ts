import { DAY_BY_ID, EXERCISE_BY_ID, MUSCLE_ORDER } from "../data/program";
import type { MuscleId, Session, SessionExercise, SetEntry, Settings, Unit } from "../data/types";
import { addDays, mondayOf } from "./dates";
import { setsFor, warmupsFor } from "./mesocycle";
import { historyOf, increaseStep, mainLoad, suggest, workSets } from "./progression";
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
    const hist = historyOf(allSessions, ex.id);
    const last = hist[hist.length - 1]?.entry;
    const unit = unitFor(ex.id, settings, last);
    const planned = setsFor(ex, week);
    const sets: SetEntry[] = [];
    for (let w = 0; w < warmupsFor(i); w++) sets.push(emptySet("warmup"));

    const source = repeatFrom?.exercises.find((e) => e.exId === ex.id);
    if (source && workSets(source).length) {
      // Carga fixa: todas as séries de trabalho com a carga principal (ignora a última com −15%).
      const load = mainLoad(workSets(source, false)) ?? workSets(source)[0].weight;
      for (let k = 0; k < planned; k++) sets.push(emptySet("work", load));
      return { exId: ex.id, unit: source.unit, sets };
    }

    const step = increaseStep(ex, unit, settings.increments[ex.id]);
    const s = suggest(ex, last, planned, week, step);
    for (let k = 0; k < planned; k++) sets.push(emptySet("work", s.weight));
    return { exId: ex.id, unit, sets };
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

export function sessionStats(s: Session) {
  let sets = 0;
  let volumeKg = 0;
  for (const e of s.exercises) {
    for (const st of workSets(e)) {
      sets++;
      volumeKg += (e.unit === "lb" ? st.weight! * 0.45359237 : st.weight!) * st.reps!;
    }
  }
  const duration = s.finishedAt ? s.finishedAt - s.startedAt : Date.now() - s.startedAt;
  return { sets, volumeKg, duration };
}

/** Séries de trabalho feitas por músculo na semana (seg–dom) que contém `date`. */
export function weeklyVolume(sessions: Session[], date: string): Record<MuscleId, number> {
  const start = mondayOf(date);
  const end = addDays(start, 7);
  const out = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as Record<MuscleId, number>;
  for (const s of sessions) {
    if (s.date < start || s.date >= end) continue;
    for (const e of s.exercises) {
      const ex = EXERCISE_BY_ID[e.exId];
      if (!ex) continue;
      const n = workSets(e).length;
      for (const m of ex.muscles) out[m] += n;
    }
  }
  return out;
}

/** Séries planejadas por músculo para uma semana do mesociclo. */
export function plannedVolume(week: number): Record<MuscleId, number> {
  const out = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as Record<MuscleId, number>;
  for (const d of Object.values(DAY_BY_ID)) {
    for (const ex of d.exercises) {
      const n = setsFor(ex, week);
      for (const m of ex.muscles) out[m] += n;
    }
  }
  return out;
}
