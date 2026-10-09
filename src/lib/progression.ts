import type { ProgramExercise, Session, SessionExercise, SetEntry, Unit } from "../data/types";

// Dupla progressão com carga fixa (ficha, página 6) + recordes pessoais.

export const LB_TO_KG = 0.45359237;

export function toKg(weight: number, unit: Unit): number {
  return unit === "lb" ? weight * LB_TO_KG : weight;
}

/** 1RM estimado (Epley). Só como referência: perde precisão acima de ~12 reps. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function roundTo(x: number, step: number): number {
  if (step <= 0) return x;
  const r = Math.round(x / step) * step;
  return Math.max(step, Number(r.toFixed(2)));
}

export function formatWeight(w: number | null | undefined): string {
  if (w == null) return "–";
  return Number.isInteger(w) ? String(w) : w.toFixed(w * 10 === Math.round(w * 10) ? 1 : 2).replace(".", ",");
}

/** Séries válidas (feitas, com peso e reps) que contam como trabalho. */
export function workSets(entry: SessionExercise | undefined, includeDrop = true): SetEntry[] {
  if (!entry) return [];
  return entry.sets.filter(
    (s) => s.done && s.weight != null && s.reps != null && s.reps > 0 && (s.kind === "work" || (includeDrop && s.kind === "drop")),
  );
}

/** Carga de trabalho da sessão: o peso mais usado nas séries "work" (empate: o maior). */
export function mainLoad(sets: SetEntry[]): number | null {
  const work = sets.filter((s) => s.kind === "work" && s.weight != null);
  if (!work.length) return null;
  const count = new Map<number, number>();
  for (const s of work) count.set(s.weight!, (count.get(s.weight!) ?? 0) + 1);
  let best: number | null = null;
  let bestN = 0;
  for (const [w, n] of count) {
    if (n > bestN || (n === bestN && best != null && w > best)) {
      best = w;
      bestN = n;
    }
  }
  return best;
}

export type SuggestionKind = "first" | "up" | "same" | "down" | "deload";

export interface Suggestion {
  kind: SuggestionKind;
  weight: number | null;
  /** Meta de reps por série (placeholder). */
  targets: number[];
  title: string;
  detail: string;
}

export function increaseStep(ex: ProgramExercise, unit: Unit, custom?: number): number {
  if (custom && custom > 0) return custom;
  return unit === "lb" ? 5 : ex.increment;
}

/**
 * Sugestão para a próxima sessão a partir da última vez que o exercício foi feito.
 * Regra: carga fixa; quando TODAS as séries de trabalho baterem o topo da faixa, sobe.
 */
export function suggest(
  ex: ProgramExercise,
  last: SessionExercise | undefined,
  plannedSets: number,
  week: number,
  step: number,
): Suggestion {
  const [lo, hi] = ex.reps;
  const work = workSets(last, false);
  const unit = last?.unit ?? "kg";
  const u = unit === "lb" ? " lb" : " kg";

  if (!last || !work.length) {
    return {
      kind: "first",
      weight: null,
      targets: Array(plannedSets).fill(lo),
      title: "Primeira vez",
      detail: `Escolha uma carga em que a 1ª série caia entre ${lo} e ${hi} reps.`,
    };
  }

  const load = mainLoad(work) ?? work[0].weight!;
  const atLoad = work.filter((s) => s.weight === load);
  const usedDrop = workSets(last, true).some((s) => s.kind === "drop");

  if (week === 7) {
    return {
      kind: "deload",
      weight: load,
      targets: Array(plannedSets).fill(Math.max(lo, (atLoad[0]?.reps ?? lo) - 4)),
      title: `Deload: ${formatWeight(load)}${u}`,
      detail: "Mesma carga, metade das séries, parando com ~4 reps sobrando.",
    };
  }

  const allTop = atLoad.length >= Math.min(plannedSets, work.length) && atLoad.every((s) => (s.reps ?? 0) >= hi) && !usedDrop;
  if (allTop) {
    const next = roundTo(load + step, step >= 1 ? 0.5 : 0.25);
    return {
      kind: "up",
      weight: next,
      targets: Array(plannedSets).fill(lo),
      title: `Subir para ${formatWeight(next)}${u}`,
      detail: `Todas as séries bateram ${hi} reps com ${formatWeight(load)}${u}. Volte a buscar ${lo}+ reps.`,
    };
  }

  const first = atLoad[0]?.reps ?? work[0].reps!;
  if (first < lo) {
    const lower = roundTo(load * 0.9, step);
    return {
      kind: "down",
      weight: lower,
      targets: Array(plannedSets).fill(lo),
      title: `Baixar para ~${formatWeight(lower)}${u}`,
      detail: `Na última vez a 1ª série deu ${first} reps, abaixo da faixa de ${lo}–${hi}.`,
    };
  }

  const targets = Array.from({ length: plannedSets }, (_, i) => {
    const prev = atLoad[i]?.reps ?? atLoad[atLoad.length - 1]?.reps ?? lo;
    return Math.min(hi, prev + 1);
  });
  return {
    kind: "same",
    weight: load,
    targets,
    title: `Manter ${formatWeight(load)}${u}`,
    detail: `Meta: +1 rep por série (${targets.join(", ")}). Sobe quando todas baterem ${hi}.`,
  };
}

/** Peso da última série quando as reps caíram abaixo do piso (−15%). */
export function backoffWeight(load: number, step: number): number {
  return roundTo(load * 0.85, step);
}

// ---------- Recordes ----------

export interface Records {
  heaviest?: { weight: number; reps: number; date: string; unit: Unit };
  bestE1rm?: { value: number; weight: number; reps: number; date: string; unit: Unit };
  mostReps?: { weight: number; reps: number; date: string; unit: Unit };
  /** Melhor nº de reps em cada carga (kg normalizado → entrada original). */
  repRecords: { weight: number; reps: number; date: string; unit: Unit }[];
  sessions: number;
}

export interface ExerciseHistoryItem {
  session: Session;
  entry: SessionExercise;
}

/** Histórico (mais antigo → mais novo) de sessões concluídas que têm o exercício com séries feitas. */
export function historyOf(sessions: Session[], exId: string): ExerciseHistoryItem[] {
  return sessions
    .filter((s) => s.status === "done")
    .map((s) => ({ session: s, entry: s.exercises.find((e) => e.exId === exId) }))
    .filter((x): x is ExerciseHistoryItem => !!x.entry && workSets(x.entry).length > 0)
    .sort((a, b) => (a.session.date === b.session.date ? a.session.startedAt - b.session.startedAt : a.session.date < b.session.date ? -1 : 1));
}

export function recordsOf(history: ExerciseHistoryItem[]): Records {
  const rec: Records = { repRecords: [], sessions: history.length };
  const byWeight = new Map<string, { weight: number; reps: number; date: string; unit: Unit }>();
  for (const { session, entry } of history) {
    for (const s of workSets(entry)) {
      const w = s.weight!;
      const r = s.reps!;
      const kg = toKg(w, entry.unit);
      const est = e1rm(kg, r);
      if (!rec.heaviest || kg > toKg(rec.heaviest.weight, rec.heaviest.unit) || (kg === toKg(rec.heaviest.weight, rec.heaviest.unit) && r > rec.heaviest.reps)) {
        rec.heaviest = { weight: w, reps: r, date: session.date, unit: entry.unit };
      }
      if (!rec.bestE1rm || est > rec.bestE1rm.value) {
        rec.bestE1rm = { value: est, weight: w, reps: r, date: session.date, unit: entry.unit };
      }
      if (!rec.mostReps || r > rec.mostReps.reps) {
        rec.mostReps = { weight: w, reps: r, date: session.date, unit: entry.unit };
      }
      const key = `${w}${entry.unit}`;
      const cur = byWeight.get(key);
      if (!cur || r > cur.reps) byWeight.set(key, { weight: w, reps: r, date: session.date, unit: entry.unit });
    }
  }
  rec.repRecords = [...byWeight.values()].sort((a, b) => toKg(b.weight, b.unit) - toKg(a.weight, a.unit));
  return rec;
}

export type PRKind = "carga" | "1rm" | "reps";

export interface PR {
  exId: string;
  kind: PRKind;
  text: string;
}

/** Recordes batidos em `session` comparando com tudo que veio antes. */
export function prsInSession(session: Session, allSessions: Session[]): PR[] {
  const before = allSessions.filter(
    (s) => s.status === "done" && s.id !== session.id && (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt)),
  );
  const out: PR[] = [];
  for (const entry of session.exercises) {
    const sets = workSets(entry);
    if (!sets.length) continue;
    const prev = recordsOf(historyOf(before, entry.exId));
    if (prev.sessions === 0) continue; // primeira vez: só linha de base
    const u = entry.unit === "lb" ? " lb" : " kg";

    const heaviest = sets.reduce((a, b) => (toKg(b.weight!, entry.unit) > toKg(a.weight!, entry.unit) ? b : a));
    if (prev.heaviest && toKg(heaviest.weight!, entry.unit) > toKg(prev.heaviest.weight, prev.heaviest.unit) + 1e-9) {
      out.push({ exId: entry.exId, kind: "carga", text: `Carga máxima: ${formatWeight(heaviest.weight)}${u} × ${heaviest.reps}` });
    }
    const best = sets.reduce((a, b) => (e1rm(toKg(b.weight!, entry.unit), b.reps!) > e1rm(toKg(a.weight!, entry.unit), a.reps!) ? b : a));
    const bestVal = e1rm(toKg(best.weight!, entry.unit), best.reps!);
    if (prev.bestE1rm && bestVal > prev.bestE1rm.value + 1e-9) {
      out.push({ exId: entry.exId, kind: "1rm", text: `1RM estimado: ${formatWeight(Math.round(bestVal))} kg (${formatWeight(best.weight)}${u} × ${best.reps})` });
    }
    for (const s of sets) {
      const prior = prev.repRecords.find((r) => r.weight === s.weight && r.unit === entry.unit);
      if (prior && s.reps! > prior.reps && !out.some((p) => p.exId === entry.exId && p.kind === "reps")) {
        out.push({ exId: entry.exId, kind: "reps", text: `Recorde de reps: ${s.reps} com ${formatWeight(s.weight)}${u} (antes ${prior.reps})` });
      }
    }
  }
  return out;
}

/** Resumo de uma entrada: "80×10, 80×9, 68×9". */
export function summarizeSets(entry: SessionExercise | undefined): string {
  const sets = workSets(entry);
  if (!sets.length) return "";
  return sets.map((s) => `${formatWeight(s.weight)}×${s.reps}`).join(", ");
}
