import type { ProgramExercise, Session, SessionExercise, SetEntry, Settings } from "../../data/types";
import { exOf, shortName } from "../../data/program";
import { defaultRest, isLowDay, setsFor } from "../mesocycle";
import {
  backoffWeight,
  historyOf,
  increaseStep,
  mainLoad,
  snapWeight,
  suggestNext,
  workSets,
  type ExerciseHistoryItem,
} from "../progression";
import type { OperatorState } from "./operator";
import { cueCandidates, ignoredRules, isLowForm, pickCue, type Cue } from "./director";

// Núcleo ao vivo (fase 1): o que vem agora no treino aberto. Puro e determinístico: a mesma sessão, o mesmo
// histórico e o mesmo `now` dão sempre o mesmo resultado. Não grava nada; a tela decide o que mostrar.

export type { Cue };

export interface LiveNext {
  exId: string;
  setId: string;
  weight: number | null;
  /** Faixa de reps da ficha. */
  target: [number, number];
  /** Reps previstas nesta carga, hoje (null sem base: 1ª vez no exercício). */
  predicted: number | null;
  /** 0..1: quanto o histórico sustenta a previsão. */
  confidence: number;
  restSec: number;
  /** Só quando o descanso difere do padrão da ficha ("+30 s: foi à falha"). */
  restWhy?: string;
  /** Proposta de baixar a carga ANTES da série (nunca aplicada sozinha). */
  adjust?: { weight: number; why: string };
}

export interface LiveState {
  next?: LiveNext;
  /** Leitura do dia, −1..+1 (fase 3). */
  form: DayForm;
  clock: { elapsedMin: number; endsAt: number | null; overCapMin: number | null };
  cue: Cue | null;
}

// ---------- Queda entre séries ----------

/** Queda padrão (reps) da série n para a n+1, na mesma carga, quando não há dado nenhum. */
export const DEFAULT_DROP = { compound: 1, isolate: 1 } as const;
/** Peso do valor de referência no encolhimento (equivale a K amostras). Mesma técnica do `operator.ts`. */
const SHRINK_K = 4;
/** Mínimo de amostras no grupo (composto ou isolado) para ele virar a referência no lugar do padrão fixo. */
const POOL_MIN = 8;

const sameW = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) < 1e-6;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Quedas observadas num registro do exercício: reps da série n menos a n+1, só entre séries de trabalho seguidas
 * com a mesma carga e descanso parecido com o da ficha (entre metade do mínimo e o dobro do máximo, quando medido).
 */
export function dropSamples(entry: SessionExercise, ex: Pick<ProgramExercise, "rest">): number[] {
  const work = entry.sets.filter((s) => s.done && s.kind === "work" && s.reps != null && s.weight != null);
  const out: number[] = [];
  for (let i = 1; i < work.length; i++) {
    const a = work[i - 1];
    const b = work[i];
    if (!sameW(a.weight, b.weight)) continue;
    if (a.doneAt && b.doneAt && b.doneAt > a.doneAt) {
      const sec = (b.doneAt - a.doneAt) / 1000;
      if (sec < ex.rest[0] * 0.5 || sec > ex.rest[1] * 2 + 120) continue;
    }
    out.push(a.reps! - b.reps!);
  }
  return out;
}

/** Quedas de todos os exercícios do histórico, separadas por tipo (a referência dos exercícios com poucos dados). */
export function dropPool(sessions: Session[]): { compound: number[]; isolate: number[] } {
  const pool = { compound: [] as number[], isolate: [] as number[] };
  for (const s of sessions) {
    if (s.status !== "done") continue;
    for (const e of s.exercises) {
      const ex = exOf(e);
      if (!ex) continue;
      pool[ex.compound ? "compound" : "isolate"].push(...dropSamples(e, ex));
    }
  }
  return pool;
}

export interface DropModel {
  /** Queda esperada (reps) por série, na mesma carga. */
  drop: number;
  /** Amostras do próprio exercício. */
  samples: number;
  confidence: number;
}

/** Queda esperada para o exercício: a mediana dele, encolhida para a do grupo (ou para o padrão fixo). */
export function dropModel(ex: ProgramExercise, hist: ExerciseHistoryItem[], pool?: { compound: number[]; isolate: number[] }): DropModel {
  const own = hist.slice(-8).flatMap((h) => dropSamples(h.entry, ex));
  const group = pool?.[ex.compound ? "compound" : "isolate"] ?? [];
  const prior = group.length >= POOL_MIN ? median(group) : DEFAULT_DROP[ex.compound ? "compound" : "isolate"];
  const n = own.length;
  const drop = n ? (n * median(own) + SHRINK_K * prior) / (n + SHRINK_K) : prior;
  return { drop: Math.max(0, drop), samples: n, confidence: Number(Math.min(1, n / 10).toFixed(2)) };
}

/**
 * Reps previstas para a próxima série de hoje, a partir da série anterior feita hoje: a mesma carga perde a queda
 * aprendida; carga diferente passa pela relação de Epley (só para prever; a régua de 1RM não muda).
 */
export function predictFromPrevious(prev: SetEntry, weight: number, drop: number, k = 30): number | null {
  const raw = rawFromPrevious(prev, weight, k);
  return raw == null ? null : Math.max(0, Math.round(raw - drop));
}

function rawFromPrevious(prev: SetEntry, weight: number, k = 30): number | null {
  if (prev.reps == null || prev.weight == null || prev.weight <= 0 || weight <= 0) return null;
  return sameW(prev.weight, weight) ? prev.reps : k * ((prev.weight * (1 + prev.reps / k)) / weight - 1);
}

// ---------- Fase 4: conhecer a pessoa ----------

/** Pares (1ª série da sessão anterior → 1ª série desta) do mesmo exercício. */
function firstSetPairs(hist: ExerciseHistoryItem[]): { a: SetEntry; b: SetEntry }[] {
  const out: { a: SetEntry; b: SetEntry }[] = [];
  for (let i = 1; i < hist.length; i++) {
    if (hist[i].session.week === 7 || hist[i - 1].session.week === 7) continue;
    const a = workSets(hist[i - 1].entry, false)[0];
    const b = workSets(hist[i].entry, false)[0];
    if (a && b) out.push({ a, b });
  }
  return out;
}

/** Pares de sessões do exercício a partir dos quais a previsão própria da 1ª série substitui a meta. */
export const PERSONAL_MIN_PAIRS = 2;

/** Constantes candidatas da curva carga × reps (Epley usa 30). */
const K_GRID = [18, 21, 24, 27, 30, 33, 36, 40, 45];

/**
 * Curva própria de carga × reps do exercício: a constante que melhor explica as trocas de carga do histórico,
 * encolhida para 30 com poucos dados. Vale só para PREVER reps; a régua de 1RM (recordes, ranking) não muda.
 */
export function personalEpley(hist: ExerciseHistoryItem[]): { k: number; samples: number } {
  const pairs = firstSetPairs(hist.slice(-12)).filter((p) => !sameW(p.a.weight, p.b.weight));
  if (pairs.length < 2) return { k: 30, samples: pairs.length };
  let best = 30;
  let bestErr = Infinity;
  for (const k of K_GRID) {
    const err = pairs.reduce((s, p) => s + Math.abs((rawFromPrevious(p.a, p.b.weight!, k) ?? 0) - p.b.reps!), 0);
    if (err < bestErr - 1e-9) (best = k), (bestErr = err);
  }
  const n = pairs.length;
  return { k: (n * best + 6 * 30) / (n + 6), samples: n };
}

/**
 * Viés próprio da 1ª série: quanto a pessoa costuma fazer a mais (ou a menos) do que a última vez prevê, por
 * exercício, encolhido para o viés de todos os exercícios dela e depois para zero.
 */
export function firstSetBias(hist: ExerciseHistoryItem[], pool: number[], k = 30): number {
  const own = firstSetPairs(hist.slice(-10)).map((p) => p.b.reps! - (rawFromPrevious(p.a, p.b.weight!, k) ?? p.b.reps!));
  const prior = pool.length >= POOL_MIN ? (pool.length * median(pool)) / (pool.length + SHRINK_K) : 0;
  return own.length ? (own.length * median(own) + SHRINK_K * prior) / (own.length + SHRINK_K) : prior;
}

/** Resíduos da 1ª série (feito − previsto pela última vez) de todos os exercícios: a referência do viés. */
export function biasPool(sessions: Session[]): number[] {
  const lastFirst = new Map<string, SetEntry>();
  const out: number[] = [];
  for (const s of [...sessions]
    .filter((x) => x.status === "done")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)) {
    if (s.week === 7) continue;
    for (const e of s.exercises) {
      const f = workSets(e, false)[0];
      if (!f) continue;
      const key = `${e.exId}|${e.alt ?? ""}`;
      const prev = lastFirst.get(key);
      const raw = prev ? rawFromPrevious(prev, f.weight!) : null;
      if (raw != null) out.push(f.reps! - raw);
      lastFirst.set(key, f);
    }
  }
  return out;
}

// ---------- Fase 3: leitura do dia ----------

export interface DayForm {
  /** −1..+1 (±6% de força estimada = ±1). */
  value: number;
  confidence: number;
  basis: string[];
  /** Diferença média de força estimada (fração, já ponderada pela confiança): entra nas previsões. */
  delta: number;
  /** Músculos dos exercícios que saíram abaixo hoje. */
  lowMuscles: string[];
}

/** Escala da leitura: 6% de força estimada acima ou abaixo = ±1. */
const FORM_SCALE = 0.06;

/**
 * Junta a 1ª série de trabalho de cada exercício já feito hoje e compara com a última vez (reps + sobra, na relação
 * carga × reps). O check-in de baixa entra como ponto de partida (meio exercício abaixo). Confiança cresce a cada
 * exercício. Na semana de deload fica neutra.
 */
export function dayForm(session: Session, history: Session[]): DayForm {
  // Deload: séries de propósito longe da falha; comparar com a semana pesada daria um falso "dia abaixo".
  if (session.week === 7) return { value: 0, confidence: 0, basis: [], delta: 0, lowMuscles: [] };
  const ratios: number[] = [];
  const basis: string[] = [];
  const lowMuscles = new Set<string>();
  let n = 0;
  if (isLowDay(session.checkin)) {
    ratios.push(-0.03);
    n += 0.5;
    basis.push("check-in de baixa");
  }
  for (const e of session.exercises) {
    const today = workSets(e, false)[0];
    if (!today?.reps || !today.weight) continue;
    const ex = exOf(e);
    if (!ex) continue;
    const hist = historyOf(history, ex.id, e.alt, ex.lib).filter((h) => h.session.week !== 7);
    const last = workSets(hist[hist.length - 1]?.entry, false)[0];
    if (!last?.reps || !last.weight) continue;
    const est = (s: SetEntry) => s.weight! * (1 + (s.reps! + (s.rir ?? 0)) / 30);
    const r = est(today) / est(last) - 1;
    ratios.push(r);
    n += 1;
    basis.push(`${shortName(ex)} ${r >= 0 ? "+" : "−"}${Math.abs(Math.round(r * 100))}%`);
    if (r < 0) for (const m of ex.muscles) lowMuscles.add(m);
  }
  if (!ratios.length) return { value: 0, confidence: 0, basis: [], delta: 0, lowMuscles: [] };
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const confidence = Number((n / (n + 1.5)).toFixed(2));
  return {
    value: Number(Math.max(-1, Math.min(1, mean / FORM_SCALE)).toFixed(2)),
    confidence,
    basis,
    delta: mean * confidence,
    lowMuscles: [...lowMuscles],
  };
}

// ---------- Descanso que acompanha a série ----------

/** Segundos a mais do que o topo da ficha, no máximo. */
export const REST_OVER_TOP = 30;

/**
 * Descanso depois de `last`, dentro da faixa da ficha: série à falha (ou queda de 2+ reps) vai para o topo,
 * isolado com 3+ sobrando vai para o piso; senão, o padrão. Nunca abaixo do mínimo, nunca 30 s acima do topo.
 */
export function restAfter(ex: ProgramExercise, last: SetEntry, prev?: SetEntry): { sec: number; why?: string } {
  const std = defaultRest(ex.rest);
  const [lo, hi] = ex.rest;
  const fell = prev && sameW(prev.weight, last.weight) && prev.reps != null && last.reps != null && prev.reps - last.reps >= 2;
  const failed = last.failure || last.rir === 0;
  let sec = std;
  let why: string | undefined;
  if (failed) {
    sec = hi;
    why = "foi à falha";
  } else if (fell) {
    sec = hi;
    why = `caiu ${prev!.reps! - last.reps!} reps`;
  } else if (!ex.compound && last.rir != null && last.rir >= 3) {
    sec = lo;
    why = `sobraram ${last.rir >= 4 ? "4+" : last.rir}`;
  }
  sec = Math.min(hi + REST_OVER_TOP, Math.max(lo, sec));
  if (sec === std) return { sec };
  const diff = sec - std;
  return { sec, why: `${diff > 0 ? "+" : "−"}${Math.abs(diff)} s: ${why}` };
}

// ---------- Relógio ----------

/** Segundos que uma série leva, quando o ritmo da sessão ainda não dá para medir. */
const SET_SECONDS = 35;

function pendingWork(entry: SessionExercise): SetEntry[] {
  return entry.sets.filter((s) => s.kind !== "warmup" && !s.done);
}

/** Ritmo medido hoje: mediana dos intervalos entre séries feitas seguidas do mesmo exercício (segundos). */
export function measuredPace(session: Session): number | null {
  const gaps: number[] = [];
  for (const e of session.exercises) {
    const done = e.sets.filter((s) => s.done && s.doneAt && s.kind !== "warmup").sort((a, b) => a.doneAt! - b.doneAt!);
    for (let i = 1; i < done.length; i++) {
      const g = (done[i].doneAt! - done[i - 1].doneAt!) / 1000;
      if (g > 20 && g < 900) gaps.push(g);
    }
  }
  return gaps.length >= 2 ? median(gaps) : null;
}

export function liveClock(session: Session, operator: OperatorState | undefined, now: number): LiveState["clock"] {
  const elapsedMin = Math.max(0, Math.round((now - session.startedAt) / 60000));
  const pace = measuredPace(session);
  let remainingSec = 0;
  let sets = 0;
  for (const e of session.exercises) {
    const ex = exOf(e);
    if (!ex) continue;
    const n = pendingWork(e).length;
    sets += n;
    remainingSec += n * (pace ?? defaultRest(ex.rest) + SET_SECONDS);
  }
  const endsAt = sets ? now + remainingSec * 1000 : null;
  const cap = operator?.activeConstraints.find((c) => c.kind === "time-cap");
  const overCapMin =
    cap && cap.kind === "time-cap" && endsAt
      ? Math.max(0, Math.round((endsAt - (session.startedAt + cap.minutes * 60000)) / 60000)) || null
      : null;
  return { elapsedMin, endsAt, overCapMin };
}

// ---------- Próxima série ----------

export interface LiveCtx {
  ex: ProgramExercise;
  entry: SessionExercise;
  hist: ExerciseHistoryItem[];
  step: number;
  available?: number[];
  planned: number;
}

/** Contexto de um exercício da sessão aberta (histórico só do passado). */
export function liveCtx(entry: SessionExercise, past: Session[], settings: Settings, week: number): LiveCtx | null {
  const ex = exOf(entry);
  if (!ex) return null;
  return {
    ex,
    entry,
    hist: historyOf(past, ex.id, entry.alt, ex.lib),
    step: increaseStep(ex, entry.unit, settings.increments[ex.id]),
    available: settings.machineWeights?.[ex.id],
    planned: setsFor(ex, week, settings.setAdjust?.[ex.id]),
  };
}

/**
 * Previsão de uma série de trabalho ainda não feita do exercício. Sem série feita hoje: a meta da sugestão (se a carga
 * é a sugerida) ou a relação carga × reps da última vez. Com série feita: {@link predictFromPrevious}.
 */
export interface PersonalCtx {
  /** Resíduos da 1ª série de todos os exercícios ({@link biasPool}). */
  bias: number[];
  /** Leitura do dia (fase 3). */
  form?: Pick<DayForm, "delta">;
}

export function predictSet(
  c: LiveCtx,
  set: SetEntry,
  week: number,
  pool?: { compound: number[]; isolate: number[] },
  personal?: PersonalCtx,
): { predicted: number | null; confidence: number } {
  const w = set.weight;
  if (w == null || w <= 0 || !c.hist.length) return { predicted: null, confidence: 0 };
  const doneToday = c.entry.sets.filter((s) => s.done && s.kind !== "warmup" && s.reps != null && s.weight != null);
  const prev = doneToday[doneToday.length - 1];
  const k = personal ? personalEpley(c.hist).k : 30;
  if (prev) {
    const m = dropModel(c.ex, c.hist, pool);
    return { predicted: predictFromPrevious(prev, w, m.drop, k), confidence: Number((0.4 + 0.5 * m.confidence).toFixed(2)) };
  }
  // Com pouca história (menos de 2 pares de sessões), a meta da sugestão erra menos que a curva própria.
  if (personal && week !== 7 && firstSetPairs(c.hist).length >= PERSONAL_MIN_PAIRS) {
    // 1ª série: a última vez na curva própria + o viés próprio + a leitura do dia (na mesma curva).
    const lastFirst = workSets(c.hist[c.hist.length - 1].entry, false)[0];
    const raw = lastFirst ? rawFromPrevious(lastFirst, w, k) : null;
    if (raw != null) {
      const bias = firstSetBias(c.hist, personal.bias, k);
      const form = (personal.form?.delta ?? 0) * (k + raw);
      return {
        predicted: Math.max(0, Math.round(raw + bias + form)),
        confidence: Number(Math.min(1, c.hist.length / 4).toFixed(2)),
      };
    }
  }
  const sug = suggestNext(c.ex, c.hist, c.planned, week, c.step, c.available);
  if (sameW(sug.weight, w)) return { predicted: sug.targets[0] ?? null, confidence: Number(Math.min(1, c.hist.length / 4).toFixed(2)) };
  const last = workSets(c.hist[c.hist.length - 1].entry, false)[0];
  if (!last) return { predicted: null, confidence: 0 };
  return { predicted: predictFromPrevious(last, w, 0), confidence: 0.3 };
}

/** Exercício e série que vêm agora: o exercício aberto mais cedo na ordem com série de trabalho pendente. */
function nextPending(session: Session): { entry: SessionExercise; set: SetEntry } | null {
  for (const e of session.exercises) {
    const set = pendingWork(e)[0];
    if (set) return { entry: e, set };
  }
  return null;
}

/**
 * Estado ao vivo da sessão aberta. `history` = sessões concluídas ANTES desta (o motor nunca olha o futuro).
 * `focusExId` escolhe o exercício em foco na tela; sem ele, o primeiro com série pendente.
 */
export function liveState(
  session: Session,
  history: Session[],
  operator: OperatorState | undefined,
  settings: Settings,
  now: number,
  focusExId?: string,
): LiveState {
  const clock = liveClock(session, operator, now);
  const form = dayForm(session, history);
  const recent = history.slice(-40);
  const focus = focusExId ? session.exercises.find((e) => e.exId === focusExId && pendingWork(e).length) : undefined;
  const pick = focus ? { entry: focus, set: pendingWork(focus)[0] } : nextPending(session);
  let next: LiveNext | undefined;
  if (pick) {
    const c = liveCtx(pick.entry, history, settings, session.week);
    if (c) {
      const p = predictSet(c, pick.set, session.week, dropPool(recent), { bias: biasPool(recent), form });
      const doneToday = pick.entry.sets.filter((s) => s.done && s.kind !== "warmup" && s.reps != null);
      const last = doneToday[doneToday.length - 1];
      const rest = last ? restAfter(c.ex, last, doneToday[doneToday.length - 2]) : { sec: defaultRest(c.ex.rest) };
      next = {
        exId: pick.entry.exId,
        setId: pick.set.id,
        weight: pick.set.weight,
        target: c.ex.reps,
        predicted: p.predicted,
        confidence: p.confidence,
        restSec: rest.sec,
        restWhy: rest.why,
      };
      // Carga antes do erro: previsão (com base) abaixo do piso → propõe baixar agora. Deload não mexe.
      const w = pick.set.weight;
      if (session.week !== 7 && w != null && w > 0 && p.predicted != null && p.confidence >= 0.4 && p.predicted < c.ex.reps[0]) {
        const lower = backoffWeight(w, c.step, c.available);
        const snapped = snapWeight(lower, c.step, c.available);
        if (snapped < w - 1e-6) {
          next.adjust = { weight: snapped, why: `previsão de ${p.predicted} reps com a carga atual, abaixo de ${c.ex.reps[0]}` };
        }
      }
      // Dia abaixo (fase 3): nos exercícios do mesmo grupo, a carga que subiu hoje volta para a da última vez.
      if (!next.adjust && session.week !== 7 && w != null && isLowForm(form) && c.ex.muscles.some((m) => form.lowMuscles.includes(m))) {
        const lastLoad = mainLoad(workSets(c.hist[c.hist.length - 1]?.entry, false));
        if (lastLoad != null && lastLoad < w - 1e-6) next.adjust = { weight: lastLoad, why: "dia abaixo: mantenha a carga da última vez" };
      }
    }
  }
  const state: LiveState = { next, form, clock, cue: null };
  state.cue = pickCue(cueCandidates(session, history, settings, state, operator), session, ignoredRules(recent));
  return state;
}
