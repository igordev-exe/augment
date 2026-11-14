import type { ProgramExercise, Session, SessionExercise, SetEntry, Settings } from "../../data/types";
import { exOf } from "../../data/program";
import { addDays } from "../dates";
import { defaultRest, setsFor } from "../mesocycle";
import { increaseStep, suggestNext, workSets, historyOf } from "../progression";
import { biasPool, dayForm, dropPool, liveCtx, predictFromPrevious, predictSet } from "./live";

// Fase 0 do núcleo ao vivo: mede se as previsões acertam. Para cada sessão do histórico, na ordem, o motor só
// enxerga o passado, prevê e compara com o que aconteceu. Puro: entra histórico, sai a tabela de erros.

export type Predictor = "base" | "live";

export interface BacktestResult {
  predictor: Predictor;
  /** Exercícios avaliados (com histórico anterior). */
  exercises: number;
  firstSets: number;
  /** Erro médio absoluto (reps) da 1ª série de trabalho de cada exercício. */
  firstMae: number;
  laterSets: number;
  /** Erro médio absoluto (reps) das séries 2 em diante. */
  laterMae: number;
  loadChecks: number;
  /** Fração das vezes em que a carga sugerida foi a usada na 1ª série (±1 passo). */
  loadHitRate: number;
}

const sameW = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) < 1e-6;
const r2 = (x: number) => Number(x.toFixed(2));

/** Previsão de hoje (linha de base): a meta da sugestão pré-treino; com outra carga, carga × reps da última vez. */
function basePredict(
  ex: ProgramExercise,
  hist: ReturnType<typeof historyOf>,
  planned: number,
  week: number,
  step: number,
  available: number[] | undefined,
  k: number,
  w: number,
): number | null {
  const sug = suggestNext(ex, hist, planned, week, step, available);
  const plannedW = k > 0 && sug.volumeWeight != null ? sug.volumeWeight : sug.weight;
  if (sameW(plannedW, w)) return sug.targets[Math.min(k, sug.targets.length - 1)] ?? null;
  const last = workSets(hist[hist.length - 1]?.entry, false)[0];
  return last ? predictFromPrevious(last, w, 0) : null;
}

/** `opts.form = false` desliga a leitura do dia (fase 3), para medir a contribuição de cada fase. */
export function backtest(sessions: Session[], settings: Settings, predictor: Predictor, opts: { form?: boolean } = {}): BacktestResult {
  const done = sessions.filter((s) => s.status === "done").sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt);
  let exercises = 0;
  let firstN = 0;
  let firstErr = 0;
  let laterN = 0;
  let laterErr = 0;
  let loadN = 0;
  let loadHit = 0;
  for (let i = 0; i < done.length; i++) {
    const s = done[i];
    const past = done.slice(0, i);
    const pool = predictor === "live" ? dropPool(past.slice(-40)) : undefined;
    const bias = predictor === "live" ? biasPool(past.slice(-40)) : [];
    s.exercises.forEach((entry, ei) => {
      const ex = exOf(entry);
      if (!ex) return;
      const work = entry.sets.filter((x) => x.done && x.kind === "work" && x.reps != null && x.weight != null && x.weight > 0);
      if (!work.length) return;
      const blank: SessionExercise = { ...entry, sets: [] };
      const c = liveCtx(blank, past, settings, s.week);
      if (!c || !c.hist.length) return;
      // Leitura do dia: só os exercícios feitos ANTES deste, na ordem do treino.
      const form = predictor === "live" && opts.form !== false ? dayForm({ ...s, exercises: s.exercises.slice(0, ei) }, past) : undefined;
      exercises++;
      const planned = Math.max(work.length, setsFor(ex, s.week, settings.setAdjust?.[ex.id]));
      const step = increaseStep(ex, entry.unit, settings.increments[ex.id]);
      const sug = suggestNext(ex, c.hist, planned, s.week, step, c.available);
      if (sug.weight != null) {
        loadN++;
        if (Math.abs(sug.weight - work[0].weight!) <= step + 1e-6) loadHit++;
      }
      for (let k = 0; k < work.length; k++) {
        const actual = work[k];
        let predicted: number | null;
        if (predictor === "base") {
          predicted = basePredict(ex, c.hist, planned, s.week, step, c.available, k, actual.weight!);
        } else {
          const pending: SetEntry = { ...actual, done: false, reps: null, rir: undefined, failure: undefined };
          const today: SessionExercise = { ...entry, sets: [...work.slice(0, k), pending] };
          predicted = predictSet({ ...c, entry: today, planned }, pending, s.week, pool, { bias, form }).predicted;
        }
        if (predicted == null) continue;
        const err = Math.abs(predicted - actual.reps!);
        if (k === 0) {
          firstN++;
          firstErr += err;
        } else {
          laterN++;
          laterErr += err;
        }
      }
    });
  }
  return {
    predictor,
    exercises,
    firstSets: firstN,
    firstMae: firstN ? r2(firstErr / firstN) : 0,
    laterSets: laterN,
    laterMae: laterN ? r2(laterErr / laterN) : 0,
    loadChecks: loadN,
    loadHitRate: loadN ? r2(loadHit / loadN) : 0,
  };
}

// ---------- Operadores simulados com queda entre séries ----------

export interface LiveSimSpec {
  seed: number;
  weeks: number;
  startDate: string;
  /** Queda real (reps por série, na mesma carga) de cada pessoa. */
  trueDrop: number;
  /** Reps que a pessoa costuma deixar sobrando. */
  habitRir: number;
  /** Ruído do dia (± reps na 1ª série). */
  dayNoise: number;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simEx(id: string, lib: string, compound: boolean, reps: [number, number], rest: [number, number]): ProgramExercise {
  return {
    id,
    lib,
    name: id,
    muscleLabel: "",
    muscles: [compound ? "peito" : "biceps"],
    sets: 3,
    reps,
    rest,
    restLabel: "",
    stop: compound ? "T" : "F",
    cues: [],
    compound,
    increment: compound ? 2.5 : 1,
  };
}

export const SIM_EXERCISES: { ex: ProgramExercise; oneRm: number }[] = [
  { ex: simEx("sim.supino", "supino-reto", true, [6, 10], [150, 210]), oneRm: 100 },
  { ex: simEx("sim.remada", "remada-curvada", true, [8, 12], [120, 180]), oneRm: 90 },
  { ex: simEx("sim.rosca", "rosca-direta", false, [10, 15], [60, 90]), oneRm: 30 },
  { ex: simEx("sim.elevacao", "elevacao-lateral", false, [12, 20], [60, 90]), oneRm: 18 },
];

/**
 * Pessoa simulada que segue a carga sugerida pelo app (quando há) e perde `trueDrop` reps por série. Serve para o
 * backtest ter queda entre séries de verdade (o `simulateOperator` faz todas as séries iguais).
 */
export function simulateLiveOperator(spec: LiveSimSpec): Session[] {
  const rand = rng(spec.seed);
  const sessions: Session[] = [];
  const strength = SIM_EXERCISES.map((x) => x.oneRm);
  for (let w = 0; w < spec.weeks; w++) {
    for (const offset of [0, 2, 4]) {
      const date = addDays(spec.startDate, w * 7 + offset);
      const week = (w % 7) + 1;
      const startedAt = new Date(`${date}T07:00:00`).getTime();
      let t = startedAt;
      const day = (rand() - 0.5) * 2 * spec.dayNoise;
      const exercises: SessionExercise[] = [];
      SIM_EXERCISES.forEach(({ ex }, idx) => {
        const hist = historyOf(sessions, ex.id, undefined, ex.lib);
        const planned = setsFor(ex, week);
        const step = increaseStep(ex, "kg");
        const sug = suggestNext(ex, hist, planned, week, step);
        const oneRm = strength[idx];
        const weight = sug.weight ?? Math.round((oneRm * 0.72) / step) * step;
        const toFail = 30 * (oneRm / weight - 1) + day;
        const sets: SetEntry[] = [];
        for (let k = 0; k < planned; k++) {
          const noise = (rand() - 0.5) * 1.2;
          const reps = Math.max(1, Math.round(toFail - spec.habitRir - k * spec.trueDrop + noise));
          t += (defaultRest(ex.rest) + 35) * 1000;
          sets.push({ id: `ls-${w}-${offset}-${idx}-${k}`, kind: "work", weight, reps, done: true, doneAt: t, rir: spec.habitRir });
        }
        exercises.push({ exId: ex.id, snap: ex, unit: "kg", sets });
        strength[idx] = oneRm * (week === 7 ? 1 : 1.004);
      });
      sessions.push({
        id: `ls-${spec.seed}-${w}-${offset}`,
        dayId: "sim",
        date,
        week,
        startedAt,
        finishedAt: t,
        status: "done",
        exercises,
      });
    }
  }
  return sessions;
}
