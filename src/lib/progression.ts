import { exById, exOf } from "../data/program";
import type { ProgramExercise, Session, SessionExercise, SetEntry, Unit } from "../data/types";
import { bySessionAsc } from "./dates";
import { rirRange } from "./mesocycle";

// Dupla progressão com carga fixa + recordes pessoais.

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

/** Arredonda `target` para o peso real mais próximo da pilha/aparelho, se configurado. */
export function snapWeight(target: number, step: number, available?: number[]): number {
  if (available && available.length > 0) {
    let best = available[0];
    let bestDiff = Math.abs(target - best);
    for (const w of available) {
      const d = Math.abs(target - w);
      if (d < bestDiff - 1e-9) {
        best = w;
        bestDiff = d;
      }
    }
    return best;
  }
  return roundTo(target, step);
}

/** Próximo pino/peso acima de `load` quando o aparelho tem pesos específicos cadastrados. */
export function nextAvailableWeight(load: number, step: number, available?: number[]): number {
  if (available && available.length > 0) {
    const sorted = [...available].sort((a, b) => a - b);
    const higher = sorted.find((w) => w > load + 1e-6);
    if (higher != null) return higher;
  }
  return roundTo(load + step, step >= 1 ? 0.5 : 0.25);
}

/** Calculadora de anilhas por lado para exercícios com barra olímpica (20 kg ou 45 lb). */
export function platesForBarbell(total: number | null | undefined, unit: Unit = "kg", barWeight = unit === "lb" ? 45 : 20): string | null {
  if (total == null || !Number.isFinite(total) || total < barWeight) return null;
  const u = unit === "lb" ? "lb" : "kg";
  const remTotal = total - barWeight;
  if (remTotal < 0.01) return `só a barra (${barWeight} ${u})`;
  let side = remTotal / 2;
  const plates = unit === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
  const picked: string[] = [];
  for (const p of plates) {
    while (side >= p - 1e-4) {
      picked.push(formatWeight(p));
      side -= p;
    }
  }
  if (!picked.length) return null;
  const remNote = side >= 0.1 ? ` (+${formatWeight(Number(side.toFixed(2)))} ${u})` : "";
  return `barra ${barWeight}${u} + [${picked.join(" + ")}] / lado${remNote}`;
}

/** Sugestão de peso e reps para série de aquecimento a partir da carga de trabalho. */
export function warmupSpec(
  load: number | null | undefined,
  warmupIdx: number,
  totalWarmups: number,
  step: number,
  available?: number[],
): { weight: number | null; reps: number } {
  if (load == null || load <= 0) return { weight: null, reps: 8 };
  const s = step >= 1 ? 0.5 : 0.25;
  if (totalWarmups >= 2) {
    return warmupIdx === 0
      ? { weight: snapWeight(load * 0.5, s, available), reps: 8 }
      : { weight: snapWeight(load * 0.75, s, available), reps: 4 };
  }
  return { weight: snapWeight(load * 0.65, s, available), reps: 6 };
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
  /** Carga das séries 2+ no formato série-âncora (senão, todas usam `weight`). */
  volumeWeight?: number;
  /** Meta de reps por série (placeholder). */
  targets: number[];
  title: string;
  detail: string;
  /** Observações sobre a última vez: o que fugiu do plano. */
  notes: string[];
}

/** Reps que você faria com `weight`, a partir de um 1RM estimado (Epley invertido). */
export function predictReps(oneRm: number, weight: number): number {
  if (weight <= 0) return 0;
  return Math.max(0, Math.floor(30 * (oneRm / weight - 1)));
}

/** Salto acima disso (fração da carga) é checado contra a previsão de reps antes de subir. */
const BIG_JUMP = 0.075;

/** O que a última vez mostrou fora do plano: cargas misturadas, RIR fora da meta, articulação. */
function lastTimeNotes(ex: ProgramExercise, last: SessionExercise, work: SetEntry[], lastWeek?: number): string[] {
  const notes: string[] = [];
  const u = last.unit === "lb" ? " lb" : " kg";
  const ws = work.map((s) => s.weight!);
  const lo = Math.min(...ws);
  const hi = Math.max(...ws);
  if (lo > 0 && hi / lo > 1.2) {
    notes.push(
      `As cargas variaram (${formatWeight(lo)}–${formatWeight(hi)}${u}). Usei a mais pesada como referência. Séries de rampa entram como aquecimento.`,
    );
  }
  const rirs = work.filter((s) => s.rir != null).map((s) => s.rir!);
  if (rirs.length && lastWeek) {
    const [min, max] = rirRange(ex.stop, lastWeek);
    const target = min === max ? `${min}` : `${min}–${max}`;
    const least = Math.min(...rirs);
    const most = Math.max(...rirs);
    if (least < min) {
      notes.push(
        least === 0
          ? `Na última vez você foi à falha, e a meta da semana ${lastWeek} era sobrar ${target}.`
          : `Na última vez sobrou ${least}, menos que a meta de ${target}.`,
      );
    } else if (most > max + 1) {
      notes.push(`Na última vez sobraram ${most >= 4 ? "4+" : most} reps, e a meta era ${target}: dava para ir mais perto.`);
    }
  }
  if (last.feedback?.joint === "incomodou") {
    notes.push("Na última vez incomodou a articulação. Reduza a amplitude ou troque pela alternativa em Como fazer.");
  }
  return notes;
}

export function increaseStep(ex: ProgramExercise, unit: Unit, custom?: number): number {
  if (custom && custom > 0) return custom;
  return unit === "lb" ? 5 : ex.increment;
}

/** Carga de referência de uma sessão e as séries que contam para a progressão. */
export interface LoadRef {
  load: number;
  atLoad: SetEntry[];
  /** Formato série-âncora: série 1 mais pesada + séries de volume ~10–15% mais leves. */
  anchor: boolean;
  /** Carga das séries de volume (só no formato âncora). */
  volumeLoad?: number;
}

/**
 * Qual carga a dupla progressão acompanha:
 * - série-âncora: a 1ª série é a mais pesada e as outras ficam entre 75% e 97% dela → progride pela âncora;
 * - cargas muito diferentes (>20%, rampa registrada como trabalho) → a mais pesada;
 * - senão, a carga mais usada.
 */
export function loadRef(work: SetEntry[]): LoadRef {
  const weights = work.map((s) => s.weight!);
  const w0 = weights[0];
  const rest = weights.slice(1);
  if (rest.length && w0 > 0 && rest.every((w) => w <= w0 * 0.97 && w >= w0 * 0.75)) {
    return { load: w0, atLoad: [work[0]], anchor: true, volumeLoad: mainLoad(work.slice(1)) ?? rest[0] };
  }
  const mixed = Math.max(...weights) / Math.max(1e-9, Math.min(...weights)) > 1.2;
  const load = mixed ? Math.max(...weights) : (mainLoad(work) ?? w0);
  return { load, atLoad: work.filter((s) => s.weight === load), anchor: false };
}

/**
 * Sugestão para a próxima sessão a partir da última vez que o exercício foi feito.
 * Regra: carga fixa; quando TODAS as séries de trabalho baterem o topo da faixa, sobe.
 * No formato série-âncora, quem decide é a âncora. Se o RIR marcado mostra que sobrou muito, sobe antes.
 */
export function suggest(
  ex: ProgramExercise,
  last: SessionExercise | undefined,
  plannedSets: number,
  week: number,
  step: number,
  /** Semana do mesociclo da última vez (para comparar o RIR marcado com a meta dela). */
  lastWeek?: number,
  /** Pesos específicos disponíveis na polia/máquina para este exercício (F5). */
  availableWeights?: number[],
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
      notes: [],
    };
  }

  const ref = loadRef(work);
  const { load, atLoad, anchor } = ref;
  const notes = lastTimeNotes(ex, last, anchor ? atLoad : work, lastWeek);
  const usedDrop = workSets(last, true).some((s) => s.kind === "drop");
  // Volume no formato âncora: mantém a proporção que ele usou (ex.: 60 → 50 = 83%).
  const ratio = anchor && ref.volumeLoad ? ref.volumeLoad / load : undefined;
  const volumeFor = (w: number) => (ratio ? snapWeight(w * ratio, step, availableWeights) : undefined);
  if (ratio) {
    notes.unshift(
      `Série-âncora: a 1ª com ${formatWeight(load)}${u} guia a progressão; as outras ~${Math.round((1 - ratio) * 100)}% mais leves.`,
    );
  }

  if (week === 7) {
    return {
      kind: "deload",
      weight: load,
      volumeWeight: volumeFor(load),
      targets: Array(plannedSets).fill(Math.max(lo, (atLoad[0]?.reps ?? lo) - 4)),
      title: `Deload: ${formatWeight(load)}${u}`,
      detail: "Mesma carga, metade das séries, parando com ~4 reps sobrando.",
      notes,
    };
  }

  // 1RM estimado na carga atual, contando as reps que sobraram quando foram marcadas.
  const bestAtLoad = Math.max(...atLoad.map((s) => e1rm(load, s.reps! + (s.rir ?? 0))));
  const allTop = anchor
    ? (atLoad[0].reps ?? 0) >= hi && !usedDrop
    : atLoad.length >= Math.min(plannedSets, work.length) && atLoad.every((s) => (s.reps ?? 0) >= hi) && !usedDrop;
  const who = anchor ? "A série-âncora bateu" : "Todas as séries bateram";
  if (allTop) {
    const next = nextAvailableWeight(load, step, availableWeights);
    const predicted = predictReps(bestAtLoad, next);
    const jump = (next - load) / load;
    if (jump > BIG_JUMP && predicted < lo) {
      // Salto grande demais para a faixa (ex.: cabo de 17,5 → 20 kg = +14%): acumula reps antes de subir.
      const cap = hi + 3;
      const targets = Array.from({ length: plannedSets }, (_, i) => {
        const prev = atLoad[i]?.reps ?? atLoad[atLoad.length - 1]?.reps ?? hi;
        return Math.min(cap, prev + 1);
      });
      return {
        kind: "same",
        weight: load,
        volumeWeight: volumeFor(load),
        targets,
        title: `Manter ${formatWeight(load)}${u}, salto grande`,
        detail: `Subir para ${formatWeight(next)}${u} é +${Math.round(jump * 100)}% e daria ~${predicted} reps, abaixo de ${lo}. Passe de ${hi} reps (${targets.join(", ")}) antes de subir.`,
        notes,
      };
    }
    return {
      kind: "up",
      weight: next,
      volumeWeight: volumeFor(next),
      targets: Array(plannedSets).fill(lo),
      title: `Subir para ${formatWeight(next)}${u}`,
      detail: `${who} ${hi} reps com ${formatWeight(load)}${u}. Previsão: ~${predicted} reps. Volte a buscar ${lo}+.`,
      notes,
    };
  }

  const first = atLoad[0]?.reps ?? work[0].reps!;
  if (first < lo) {
    const lower = snapWeight(load * 0.9, step, availableWeights);
    return {
      kind: "down",
      weight: lower,
      volumeWeight: volumeFor(lower),
      targets: Array(plannedSets).fill(lo),
      title: `Baixar para ~${formatWeight(lower)}${u}`,
      detail: `Na última vez a 1ª série deu ${first} reps, abaixo da faixa de ${lo}–${hi}.`,
      notes,
    };
  }

  // Sobrou muito além da meta em todas as séries marcadas: a carga está leve. Se a previsão na carga
  // seguinte (contando o que sobrou) cabe na faixa, sobe já: séries longe da falha estimulam menos.
  if (lastWeek && lastWeek !== 7) {
    const [, tMax] = rirRange(ex.stop, lastWeek);
    const marked = atLoad.filter((s) => s.rir != null);
    const minRir = marked.length ? Math.min(...marked.map((s) => s.rir!)) : -1;
    if (marked.length === atLoad.length && minRir >= tMax + 2) {
      const next = nextAvailableWeight(load, step, availableWeights);
      const predicted = predictReps(bestAtLoad, next);
      if (predicted >= lo + 1) {
        return {
          kind: "up",
          weight: next,
          volumeWeight: volumeFor(next),
          targets: Array(plannedSets).fill(Math.min(hi, predicted - 1)),
          title: `Subir para ${formatWeight(next)}${u}: sobrou reps`,
          detail: `Sobraram ${minRir >= 4 ? "4+" : minRir} reps em todas as séries, e a meta era até ${tMax}. Contando o que sobrou, a previsão com ${formatWeight(next)}${u} é ~${predicted} reps.`,
          notes,
        };
      }
    }
  }

  const targets = Array.from({ length: plannedSets }, (_, i) => {
    const prev =
      anchor && i > 0 ? (work[i]?.reps ?? work[work.length - 1].reps!) : (atLoad[i]?.reps ?? atLoad[atLoad.length - 1]?.reps ?? lo);
    return Math.min(hi, prev + 1);
  });
  return {
    kind: "same",
    weight: load,
    volumeWeight: volumeFor(load),
    targets,
    title: `Manter ${formatWeight(load)}${u}`,
    detail: anchor
      ? `Meta: +1 rep na âncora (${targets[0]}) e nas de volume. Sobe quando a âncora bater ${hi}.`
      : `Meta: +1 rep por série (${targets.join(", ")}). Sobe quando todas baterem ${hi}.`,
    notes,
  };
}

/** Peso da última série quando as reps caíram abaixo do piso (−15%). Nunca retorna valor >= `load`. */
export function backoffWeight(load: number, step: number, available?: number[]): number {
  const raw = snapWeight(load * 0.85, step, available);
  if (raw < load - 1e-6) return raw;
  if (available && available.length > 0) {
    const lower = [...available].sort((a, b) => b - a).find((w) => w < load - 1e-6);
    if (lower != null) return lower;
  }
  const s = step > 0 ? step : 1;
  return Math.max(s, Number((load - s).toFixed(2)));
}

/**
 * Desfaz ou corrige o −15% quando ele deixou de fazer sentido (série desmarcada, reps corrigidas ou carga já reduzida):
 * - se a última série feita já bateu o piso (ex.: o usuário já diminuiu o peso na 2ª série e entrou na faixa),
 *   ou se nenhuma série feita ficou abaixo do piso, a série "−15%" pendente volta a ser normal com a carga atual;
 * - se a última série feita continuou abaixo do piso com um peso menor, recalcula o −15% sobre esse novo peso.
 */
export function revertBackoff(entry: SessionExercise, floor: number, step = 2.5, available?: number[]): boolean {
  const doneWork = entry.sets.filter((s) => s.done && s.kind !== "warmup");
  const lastDone = doneWork[doneWork.length - 1];
  const below = doneWork.some((s) => s.reps != null && s.reps < floor);
  const recoveredOnLast = lastDone != null && lastDone.reps != null && lastDone.reps >= floor;

  if (!below || recoveredOnLast) {
    const refWeight = lastDone?.weight ?? mainLoad(entry.sets.filter((s) => s.kind === "work" && s.weight != null));
    let changed = false;
    for (const s of entry.sets) {
      if (s.kind === "drop" && !s.done) {
        s.kind = "work";
        if (refWeight != null) s.weight = refWeight;
        s.suggested = undefined;
        changed = true;
      }
    }
    return changed;
  }

  if (lastDone?.weight != null) {
    let changed = false;
    const targetDrop = backoffWeight(lastDone.weight, step, available);
    for (const s of entry.sets) {
      if (s.kind === "drop" && !s.done && (s.weight == null || s.weight >= lastDone.weight - 1e-6)) {
        s.weight = targetDrop;
        s.suggested = undefined;
        changed = true;
      }
    }
    return changed;
  }
  return false;
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

/**
 * Histórico (mais antigo → mais novo) de sessões concluídas que têm o exercício com séries feitas.
 * Por padrão (`alt` omitido), traz apenas sessões feitas no exercício titular (sem alternativa).
 */
/**
 * `libId` informa a biblioteca quando o exercício não está no programa ativo (exercício extra adicionado no treino);
 * sem ele, a biblioteca vem do programa.
 */
export function historyOf(sessions: Session[], exId: string, alt?: string, libId?: string): ExerciseHistoryItem[] {
  const targetAlt = alt || undefined;
  const pick = (match: (e: SessionExercise) => boolean) =>
    sessions
      .filter((s) => s.status === "done")
      .map((s) => ({ session: s, entry: s.exercises.find(match) }))
      .filter((x): x is ExerciseHistoryItem => !!x.entry && (x.entry.alt || undefined) === targetAlt && workSets(x.entry).length > 0)
      .sort((a, b) => bySessionAsc(a.session, b.session));
  const own = pick((e) => e.exId === exId);
  if (own.length) return own;
  // Exercício que nunca foi feito com este id (programa novo, dia novo): continua do mesmo exercício da biblioteca
  // feito em outro dia ou programa. Quem já tem histórico próprio fica separado (a flexora de dois dias, por exemplo).
  const lib = libId ?? exById(exId)?.lib;
  if (!lib) return own;
  return pick((e) => e.exId !== exId && (e.snap?.lib ?? exById(e.exId)?.lib) === lib);
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
      if (
        !rec.heaviest ||
        kg > toKg(rec.heaviest.weight, rec.heaviest.unit) ||
        (kg === toKg(rec.heaviest.weight, rec.heaviest.unit) && r > rec.heaviest.reps)
      ) {
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

interface RunningExerciseRecord {
  sessions: number;
  maxKg: number;
  maxE1rm: number;
  repsByWeight: Map<string, number>;
}

function evaluateSessionPRs(session: Session, tracker: Map<string, RunningExerciseRecord>, mutateTracker: boolean): PR[] {
  const out: PR[] = [];
  for (const entry of session.exercises) {
    const sets = workSets(entry);
    if (!sets.length) continue;
    const canonicalId = exOf(entry)?.lib ?? entry.exId;
    const key = `${canonicalId}::${entry.alt || ""}`;
    let state = tracker.get(key);
    if (!state) {
      state = { sessions: 0, maxKg: 0, maxE1rm: 0, repsByWeight: new Map() };
      if (mutateTracker) tracker.set(key, state);
    }

    if (state.sessions > 0) {
      const u = entry.unit === "lb" ? " lb" : " kg";
      const prefix = entry.alt ? `[${entry.alt}] ` : "";

      const heaviest = sets.reduce((a, b) => (toKg(b.weight!, entry.unit) > toKg(a.weight!, entry.unit) ? b : a));
      if (toKg(heaviest.weight!, entry.unit) > state.maxKg + 1e-9) {
        out.push({
          exId: entry.exId,
          kind: "carga",
          text: `${prefix}Carga máxima: ${formatWeight(heaviest.weight)}${u} × ${heaviest.reps}`,
        });
      }

      const best = sets.reduce((a, b) => (e1rm(toKg(b.weight!, entry.unit), b.reps!) > e1rm(toKg(a.weight!, entry.unit), a.reps!) ? b : a));
      const bestVal = e1rm(toKg(best.weight!, entry.unit), best.reps!);
      if (bestVal > state.maxE1rm + 1e-9) {
        out.push({
          exId: entry.exId,
          kind: "1rm",
          text: `${prefix}1RM estimado: ${formatWeight(Math.round(bestVal))} kg (${formatWeight(best.weight)}${u} × ${best.reps})`,
        });
      }

      for (const s of sets) {
        const wKey = `${s.weight}${entry.unit}`;
        const prior = state.repsByWeight.get(wKey);
        if (prior != null && s.reps! > prior && !out.some((p) => p.exId === entry.exId && p.kind === "reps")) {
          out.push({
            exId: entry.exId,
            kind: "reps",
            text: `${prefix}Recorde de reps: ${s.reps} com ${formatWeight(s.weight)}${u} (antes ${prior})`,
          });
        }
      }
    }

    if (mutateTracker) {
      state.sessions += 1;
      for (const s of sets) {
        const kg = toKg(s.weight!, entry.unit);
        const est = e1rm(kg, s.reps!);
        if (kg > state.maxKg) state.maxKg = kg;
        if (est > state.maxE1rm) state.maxE1rm = est;
        const wKey = `${s.weight}${entry.unit}`;
        const cur = state.repsByWeight.get(wKey);
        if (cur == null || s.reps! > cur) state.repsByWeight.set(wKey, s.reps!);
      }
    }
  }
  return out;
}

/**
 * Calcula os PRs de todas as sessões concluídas em uma única passagem cronológica O(N).
 */
export function prsBySession(allSessions: Session[]): Map<string, PR[]> {
  const ordered = allSessions.filter((s) => s.status === "done").sort(bySessionAsc);
  const tracker = new Map<string, RunningExerciseRecord>();
  const result = new Map<string, PR[]>();
  for (const s of ordered) {
    result.set(s.id, evaluateSessionPRs(s, tracker, true));
  }
  return result;
}

/** Recordes batidos em `session` comparando com tudo que veio antes (respeitando a variante/alternativa). */
export function prsInSession(session: Session, allSessions: Session[]): PR[] {
  const before = allSessions
    .filter(
      (s) =>
        s.status === "done" &&
        s.id !== session.id &&
        (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt)),
    )
    .sort(bySessionAsc);
  const tracker = new Map<string, RunningExerciseRecord>();
  for (const s of before) {
    evaluateSessionPRs(s, tracker, true);
  }
  return evaluateSessionPRs(session, tracker, false);
}

/** Resumo de uma entrada: "80×10, 80×9, 68×9". */
export function summarizeSets(entry: SessionExercise | undefined): string {
  const sets = workSets(entry);
  if (!sets.length) return "";
  return sets.map((s) => `${formatWeight(s.weight)}×${s.reps}`).join(", ");
}

// ---------- Estagnação: destravar com −10% ----------

/** Treinos seguidos (fora do deload) na mesma carga sem 1RM estimado novo antes de baixar para destravar. */
export const STALL_SESSIONS = 3;

export interface ExerciseStall {
  /** Carga em que travou, na unidade do último treino. */
  load: number;
  /** "80×8,8,7" por treino, do mais antigo para o mais novo. */
  trail: string[];
  /** Sobrou 3+ reps em todas as séries marcadas do último treino: falta esforço, não é fadiga. */
  easyRir: boolean;
}

/** 1RM estimado do treino, contando as reps que sobraram quando foram marcadas. */
export function bestE1rm(entry: SessionExercise): number {
  return Math.max(0, ...workSets(entry, false).map((s) => e1rm(toKg(s.weight!, entry.unit), s.reps! + (s.rir ?? 0))));
}

export function stallOf(hist: ExerciseHistoryItem[]): ExerciseStall | null {
  const h = hist.filter((x) => x.session.week !== 7).slice(-STALL_SESSIONS);
  if (h.length < STALL_SESSIONS) return null;
  const loads = h.map(({ entry }) => {
    const ws = workSets(entry, false);
    return ws.length ? toKg(loadRef(ws).load, entry.unit) : null;
  });
  // Mudou a carga no meio (subiu, baixou ou já destravou): a contagem recomeça.
  if (loads.some((l) => l == null || Math.abs(l - loads[0]!) > 1e-6)) return null;
  const best = h.map((x) => bestE1rm(x.entry));
  if (best.slice(1).some((b) => b > best[0] + 1e-6)) return null;

  const last = h[h.length - 1].entry;
  const lastWork = workSets(last, false);
  const marked = lastWork.filter((s) => s.rir != null);
  return {
    load: loadRef(lastWork).load,
    trail: h.map(({ entry }) => {
      const ws = workSets(entry, false);
      const l = loadRef(ws).load;
      return `${formatWeight(l)}×${ws
        .filter((s) => s.weight === l)
        .map((s) => s.reps)
        .join(",")}`;
    }),
    easyRir: marked.length > 0 && marked.every((s) => s.rir! >= 3),
  };
}

// ---------- Queda de desempenho: reps caindo com a mesma carga ----------

export interface ExerciseRegression {
  load: number;
  /** "80×10,9 → 80×9,8 → 80×8,7", do mais antigo para o mais novo. */
  trail: string[];
}

/** Reps médias na carga de referência, somando o que sobrou (normaliza semanas com RIR diferente). */
function effortReps(entry: SessionExercise): { kg: number; reps: number; label: string } | null {
  const ws = workSets(entry, false);
  if (!ws.length) return null;
  const { load, atLoad } = loadRef(ws);
  const reps = atLoad.reduce((a, s) => a + s.reps! + (s.rir ?? 0), 0) / atLoad.length;
  return { kg: toKg(load, entry.unit), reps, label: `${formatWeight(load)}×${atLoad.map((s) => s.reps).join(",")}` };
}

/**
 * Reps caindo com a mesma carga em 2 sessões seguidas (3 pontos, fora do deload), já contando o que sobrou.
 * É o sinal de fadiga de "volume cego": não falta força, falta recuperação.
 */
export function regressionOf(hist: ExerciseHistoryItem[]): ExerciseRegression | null {
  const h = hist.filter((x) => x.session.week !== 7).slice(-3);
  if (h.length < 3) return null;
  const pts = h.map((x) => effortReps(x.entry));
  if (pts.some((p) => !p) || pts.some((p) => Math.abs(p!.kg - pts[0]!.kg) > 1e-6)) return null;
  const [a, b, c] = pts as { kg: number; reps: number; label: string }[];
  if (!(b.reps <= a.reps - 0.5 && c.reps <= b.reps - 0.5)) return null;
  const lastWork = workSets(h[2].entry, false);
  return { load: loadRef(lastWork).load, trail: pts.map((p) => p!.label) };
}

/**
 * Sugestão da próxima sessão a partir do histórico (mais antigo → mais novo): a dupla progressão de `suggest`
 * e, quando travou {@link STALL_SESSIONS} treinos na mesma carga, baixa ~10% para destravar.
 */
export function suggestNext(
  ex: ProgramExercise,
  hist: ExerciseHistoryItem[],
  plannedSets: number,
  week: number,
  step: number,
  availableWeights?: number[],
): Suggestion {
  const lastItem = hist[hist.length - 1];
  const base = suggest(ex, lastItem?.entry, plannedSets, week, step, lastItem?.session.week, availableWeights);
  if (week === 7) return base;
  const reg = regressionOf(hist);
  const s = reg
    ? {
        ...base,
        notes: [
          ...base.notes,
          `Reps caindo com a mesma carga há 2 treinos (${reg.trail.join(" → ")}): sinal de fadiga, não de falta de força. Priorize sono e proteína; se acontecer em vários exercícios, o app sugere antecipar o deload.`,
        ],
      }
    : base;
  if (s.kind !== "same") return s;
  const stall = stallOf(hist);
  if (!stall) return s;
  if (stall.easyRir) {
    return {
      ...s,
      notes: [
        ...s.notes,
        `${STALL_SESSIONS} treinos sem progresso (${stall.trail.join(" → ")}), mas sobrando 3+ reps: falta esforço, não é fadiga. Vá mais perto da falha antes de baixar a carga.`,
      ],
    };
  }
  const [lo, hi] = ex.reps;
  const u = lastItem.entry.unit === "lb" ? " lb" : " kg";
  const lower = snapWeight(stall.load * 0.9, step, availableWeights);
  return {
    kind: "down",
    weight: lower,
    targets: Array(plannedSets).fill(Math.min(hi, lo + 2)),
    title: `Destravar: baixar para ${formatWeight(lower)}${u}`,
    detail: `${STALL_SESSIONS} treinos seguidos com ${formatWeight(stall.load)}${u} sem 1RM estimado novo (${stall.trail.join(" → ")}). Baixe ~10% e volte a subir daqui: costuma passar do ponto travado em 2–3 semanas.`,
    notes: s.notes,
  };
}

/**
 * O que o número do peso significa, para não haver dúvida entre "cada halter" e "a soma". A convenção do app é
 * anotar o que está escrito no equipamento: o peso de UM halter, o total da barra (com a barra), a placa da máquina.
 */
export function loadBasis(name: string, equipment: string | undefined, perSide?: boolean): string {
  // O nome manda; do equipamento vale só a 1ª opção ("Barra ou halteres" → barra).
  const kind = basisKind(name) ?? basisKind((equipment ?? "").split(/\s+ou\s+/i)[0]);
  if (kind === "halter") return perSide ? "um halter, por lado" : "cada halter";
  if (perSide) return "por lado";
  if (kind === "cabo") return "na pilha do cabo";
  if (kind === "maquina") return "total da máquina";
  if (kind === "barra") return "total, com a barra";
  if (kind === "corpo") return "carga extra";
  return "total";
}

function basisKind(txt: string): "halter" | "cabo" | "maquina" | "barra" | "corpo" | undefined {
  if (/halter|kettle/i.test(txt)) return "halter";
  if (/polia|pulley|cabo|crossover|puxada|remada baixa|tr[ií]ceps corda|face pull/i.test(txt)) return "cabo";
  if (/m[aá]quina|leg press|hack|cadeira|mesa flexora|peck|voador|smith|hammer/i.test(txt)) return "maquina";
  if (/barra fixa|paralela|peso do corpo|corporal|flex[aã]o/i.test(txt)) return "corpo";
  if (/barra/i.test(txt)) return "barra";
  return undefined;
}

export interface OverloadOption {
  weight: number;
  reps: number;
  /** "reps" = mesma carga, +1 rep; "carga" = próxima carga disponível, reps previstas pelo 1RM estimado. */
  via: "reps" | "carga";
}

/**
 * Sobrecarga progressiva sugerida, não só acompanhada: a partir da melhor série da última vez na carga de referência,
 * as duas formas de superar o que já foi feito. Subir reps e subir carga dão hipertrofia parecida (Plotkin et al.,
 * PeerJ 2022); o app mostra as duas e a pessoa escolhe no dia.
 * Ex.: última vez 10 kg × 10 → "10 × 11" ou "12,5 × 8" (previsão de Epley a partir do 1RM estimado, com o RIR).
 * Vazio na 1ª vez, no deload ou quando a última série ficou abaixo da faixa (aí o certo é baixar, não superar).
 */
export function overloadOptions(
  ex: ProgramExercise,
  last: SessionExercise | undefined,
  week: number,
  step: number,
  availableWeights?: number[],
): OverloadOption[] {
  const work = workSets(last, false);
  if (!last || !work.length || week === 7) return [];
  const [lo, hi] = ex.reps;
  const { load, atLoad } = loadRef(work);
  if (!(load > 0)) return [];
  const bestReps = Math.max(...atLoad.map((s) => s.reps ?? 0));
  if (bestReps < lo) return [];
  const out: OverloadOption[] = [];
  // +1 rep na mesma carga, até 3 acima do topo da faixa (passou disso, a carga é que tem que subir).
  if (bestReps + 1 <= hi + 3) out.push({ weight: load, reps: bestReps + 1, via: "reps" });
  const next = nextAvailableWeight(load, step, availableWeights);
  if (next > load) {
    const oneRm = Math.max(...atLoad.map((s) => e1rm(load, (s.reps ?? 0) + (s.rir ?? 0))));
    // Reps previstas com a carga nova, menos o que sobrou da última vez (a meta é o mesmo esforço).
    const rir = Math.min(...atLoad.map((s) => s.rir ?? 0));
    const reps = Math.min(hi, predictReps(oneRm, next) - rir);
    if (reps >= Math.max(1, lo - 2)) out.push({ weight: next, reps, via: "carga" });
  }
  return out;
}
