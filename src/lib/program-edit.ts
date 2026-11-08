import { LIB_BY_ID, LIB_MUSCLES } from "../data/library";
import { EXT_BY_ID } from "../data/library-extended";
import { MUSCLE_LABEL } from "../data/program";
import { SYNERGISTS } from "../data/science";
import { restLabel } from "../data/templates/ppl";
import type { MuscleId, Program, ProgramDay, ProgramExercise, StopKind } from "../data/types";

// Edição do programa (montador de treino). Funções puras: recebem o programa e devolvem uma cópia alterada, sem
// tocar no banco. Quem salva é a tela (saveProgram em db.ts).
//
// Ids: exercício novo ganha `<dia>.<biblioteca>` (com sufixo se repetir); dia novo, um id curto aleatório.
// Remover exercício não apaga: vai para `retired`, para o histórico continuar com nome e músculos.

const rand = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

const clone = <T>(x: T): T => structuredClone(x);

function touch(p: Program): Program {
  return { ...p, updatedAt: Date.now() };
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item"
  );
}

/** Sigla de 2 letras do dia ("Upper B" → "UB", "Peito e tríceps" → "PT"). */
export function dayCode(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && !["e", "de", "do", "da"].includes(w.toLowerCase()));
  const code = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "T").slice(0, 2);
  return code.toUpperCase();
}

export function muscleLabelOf(muscles: MuscleId[]): string {
  return muscles.map((m) => MUSCLE_LABEL[m]).join(" e ") || "—";
}

function allExerciseIds(p: Program): Set<string> {
  return new Set([...p.days.flatMap((d) => d.exercises.map((e) => e.id)), ...(p.retired ?? []).map((e) => e.id)]);
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

// ---------- Programa ----------

export function blankProgram(name = "Meu programa", now = Date.now()): Program {
  const dayId = `d-${rand()}`;
  return {
    id: `p-${rand()}`,
    name,
    periodization: "meso",
    days: [{ id: dayId, name: "Treino A", code: "TA", weekday: 1, focus: "", notes: [], exercises: [] }],
    createdAt: now,
    updatedAt: now,
  };
}

/** Cópia com id novo. Os ids de dia e exercício ficam: o histórico e a progressão continuam valendo na cópia. */
export function duplicateProgram(p: Program, now = Date.now()): Program {
  return { ...clone(p), id: `p-${rand()}`, name: `${p.name} (cópia)`, createdAt: now, updatedAt: now };
}

/** Programa novo a partir de um modelo (com id novo, se `id` não for dado). */
export function fromTemplate(t: Program, opts: { id?: string; now?: number } = {}): Program {
  const now = opts.now ?? Date.now();
  return { ...clone(t), id: opts.id ?? `p-${rand()}`, createdAt: now, updatedAt: now };
}

export function renameProgram(p: Program, name: string): Program {
  return touch({ ...p, name: name.slice(0, 60) });
}

export function setPeriodization(p: Program, periodization: "meso" | "fixed"): Program {
  return touch({ ...p, periodization });
}

// ---------- Dias ----------

export function addDay(p: Program, name?: string): Program {
  const n = p.days.length;
  const label = name ?? `Treino ${String.fromCharCode(65 + (n % 26))}`;
  const day: ProgramDay = {
    id: `d-${rand()}`,
    name: label,
    code: dayCode(label),
    weekday: (n % 7) + 1,
    focus: "",
    notes: [],
    exercises: [],
  };
  return touch({ ...p, days: [...p.days, day] });
}

export function updateDay(p: Program, dayId: string, patch: Partial<Pick<ProgramDay, "name" | "code" | "focus">>): Program {
  return touch({
    ...p,
    days: p.days.map((d) =>
      d.id === dayId
        ? {
            ...d,
            ...patch,
            name: (patch.name ?? d.name).slice(0, 40),
            code: (patch.code ?? (patch.name != null ? dayCode(patch.name) : d.code)).toUpperCase().slice(0, 3),
          }
        : d,
    ),
  });
}

export function moveDay(p: Program, dayId: string, dir: -1 | 1): Program {
  const i = p.days.findIndex((d) => d.id === dayId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.days.length) return p;
  const days = [...p.days];
  [days[i], days[j]] = [days[j], days[i]];
  return touch({ ...p, days });
}

/** Remove o dia. Os exercícios dele vão para `retired`. Não remove o último dia. */
export function removeDay(p: Program, dayId: string): Program {
  if (p.days.length <= 1) return p;
  const day = p.days.find((d) => d.id === dayId);
  if (!day) return p;
  return touch({ ...p, days: p.days.filter((d) => d.id !== dayId), retired: retire(p.retired, day.exercises) });
}

// ---------- Exercícios ----------

function retire(cur: ProgramExercise[] | undefined, exs: ProgramExercise[]): ProgramExercise[] {
  const map = new Map((cur ?? []).map((e) => [e.id, e]));
  for (const e of exs) {
    const { superset: _drop, ...rest } = e;
    map.set(e.id, rest);
  }
  return [...map.values()];
}

/** Valores iniciais por tipo: composto (com sinergistas) ou isolado. */
function defaultsFor(compound: boolean) {
  return compound
    ? { sets: 3, reps: [6, 10] as [number, number], rest: [120, 180] as [number, number], stop: "T" as StopKind, increment: 2.5 }
    : { sets: 3, reps: [10, 15] as [number, number], rest: [60, 90] as [number, number], stop: "F" as StopKind, increment: 2.5 };
}

/** Novo exercício a partir da biblioteca. */
export function exerciseFromLibrary(libId: string, dayId: string, taken: Set<string>): ProgramExercise {
  const lib = LIB_BY_ID[libId];
  const ext = lib ? undefined : EXT_BY_ID[libId];
  const muscles = LIB_MUSCLES[libId] ?? ext?.muscles ?? [];
  const compound = ext ? ext.compound : (SYNERGISTS[libId]?.length ?? 0) > 0;
  const d = defaultsFor(compound);
  return {
    id: uniqueId(`${dayId}.${slugify(libId)}`, taken),
    lib: libId,
    name: lib?.name ?? ext?.name ?? libId,
    muscleLabel: muscleLabelOf(muscles),
    muscles,
    // Biblioteca ampliada: os sinergistas vêm do próprio banco (a tabela SYNERGISTS só cobre a curada).
    synergists: ext?.synergists.length ? [...ext.synergists] : undefined,
    sets: d.sets,
    reps: d.reps,
    rest: d.rest,
    restLabel: restLabel(d.rest),
    stop: d.stop,
    iso: !compound || undefined,
    cues: [],
    compound,
    increment: d.increment,
  };
}

/** Exercício que não está na biblioteca: nome e músculos escolhidos pelo usuário. */
export function customExercise(
  name: string,
  muscles: MuscleId[],
  dayId: string,
  taken: Set<string>,
  opts: { compound?: boolean; synergists?: MuscleId[] } = {},
): ProgramExercise {
  const compound = !!opts.compound;
  const d = defaultsFor(compound);
  const slug = slugify(name);
  return {
    id: uniqueId(`${dayId}.${slug}`, taken),
    lib: `custom-${slug}`,
    name: name.trim().slice(0, 60) || "Exercício",
    muscleLabel: muscleLabelOf(muscles),
    muscles,
    synergists: opts.synergists?.length ? opts.synergists : undefined,
    sets: d.sets,
    reps: d.reps,
    rest: d.rest,
    restLabel: restLabel(d.rest),
    stop: d.stop,
    iso: !compound || undefined,
    cues: [],
    compound,
    increment: d.increment,
  };
}

export function addExercise(p: Program, dayId: string, make: (taken: Set<string>) => ProgramExercise): Program {
  const ex = make(allExerciseIds(p));
  return touch({
    ...p,
    days: p.days.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, ex] } : d)),
    retired: p.retired?.filter((e) => e.id !== ex.id),
  });
}

export type ExercisePatch = Partial<
  Pick<
    ProgramExercise,
    "name" | "sets" | "reps" | "rest" | "stop" | "iso" | "up" | "intensifier" | "increment" | "perSide" | "muscles" | "compound" | "cues"
  >
>;

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Atualiza campos do exercício, com limites (1–10 séries, reps 1–50, descanso 0–600 s). */
export function updateExercise(p: Program, exId: string, patch: ExercisePatch): Program {
  return touch({
    ...p,
    days: p.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exId) return e;
        const next: ProgramExercise = { ...e, ...patch };
        next.sets = clampInt(next.sets, 1, 10);
        const r0 = clampInt(next.reps[0], 1, 50);
        next.reps = [r0, Math.max(r0, clampInt(next.reps[1], 1, 50))];
        const s0 = clampInt(next.rest[0], 0, 600);
        next.rest = [s0, Math.max(s0, clampInt(next.rest[1], 0, 600))];
        next.restLabel = restLabel(next.rest);
        next.increment = Math.max(0.25, Math.min(50, Number(next.increment) || 2.5));
        next.name = next.name.trim().slice(0, 60) || e.name;
        if (patch.muscles) next.muscleLabel = muscleLabelOf(next.muscles);
        if (!next.intensifier?.trim()) delete next.intensifier;
        return next;
      }),
    })),
  });
}

export function moveExercise(p: Program, exId: string, dir: -1 | 1): Program {
  return touch({
    ...p,
    days: p.days.map((d) => {
      const i = d.exercises.findIndex((e) => e.id === exId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.exercises.length) return d;
      // Superset anda junto: não separa o par trocando de lugar com ele.
      const exs = [...d.exercises];
      [exs[i], exs[j]] = [exs[j], exs[i]];
      return { ...d, exercises: fixSupersets(exs) };
    }),
  });
}

/** Remove do dia (vai para `retired`) e desfaz o superset do par. */
export function removeExercise(p: Program, exId: string): Program {
  const gone = p.days.flatMap((d) => d.exercises).find((e) => e.id === exId);
  if (!gone) return p;
  return touch({
    ...p,
    days: p.days.map((d) => ({
      ...d,
      exercises: d.exercises.filter((e) => e.id !== exId).map((e) => (e.superset?.with === exId ? withoutSuperset(e) : e)),
    })),
    retired: retire(p.retired, [gone]),
  });
}

function withoutSuperset(e: ProgramExercise): ProgramExercise {
  const { superset: _s, ...rest } = e;
  return rest;
}

/** Superset só vale entre vizinhos (A1 logo antes de A2). Desfaz pares que ficaram separados. */
function fixSupersets(exs: ProgramExercise[]): ProgramExercise[] {
  return exs.map((e, i) => {
    if (!e.superset) return e;
    const partner = e.superset.order === 1 ? exs[i + 1] : exs[i - 1];
    return partner?.id === e.superset.with ? e : withoutSuperset(e);
  });
}

/** Liga (ou desliga) o superset do exercício com o seguinte no dia. */
export function toggleSupersetWithNext(p: Program, exId: string): Program {
  return touch({
    ...p,
    days: p.days.map((d) => {
      const i = d.exercises.findIndex((e) => e.id === exId);
      if (i < 0) return d;
      const a = d.exercises[i];
      const b = d.exercises[i + 1];
      const exs = [...d.exercises];
      if (a.superset?.order === 1 && b && a.superset.with === b.id) {
        exs[i] = withoutSuperset(a);
        exs[i + 1] = withoutSuperset(b);
        return { ...d, exercises: exs };
      }
      if (!b || a.superset || b.superset) return d;
      exs[i] = { ...a, superset: { with: b.id, order: 1 } };
      exs[i + 1] = { ...b, superset: { with: a.id, order: 2 } };
      return { ...d, exercises: exs };
    }),
  });
}

// ---------- Checagem ----------

export interface ProgramIssue {
  dayId?: string;
  text: string;
}

/** Problemas que impedem usar o programa (ou que vão confundir o motor). */
export function programIssues(p: Program): ProgramIssue[] {
  const out: ProgramIssue[] = [];
  if (!p.days.length) out.push({ text: "O programa precisa de pelo menos um dia." });
  for (const d of p.days) {
    if (!d.exercises.length) out.push({ dayId: d.id, text: `${d.name}: sem exercícios.` });
    for (const e of d.exercises) if (!e.muscles.length) out.push({ dayId: d.id, text: `${e.name}: escolha pelo menos um músculo.` });
  }
  return out;
}
