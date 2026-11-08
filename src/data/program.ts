import { SYNERGISTS } from "./science";
import { PPL_DAYS, pplProgram } from "./templates/ppl";
import type { MuscleId, Program, ProgramDay, ProgramExercise, Session } from "./types";

// Registro do programa ativo. O programa é um dado salvo (tabela `programs`); o app carrega o ativo ao abrir e
// todo o resto lê por aqui: dias em ordem, dia pelo id, exercício pelo id.
// Exercício que saiu do programa continua resolvendo: pelo `retired` do programa ou pelo retrato (`snap`) que cada
// sessão guarda. Até o banco carregar (e nos testes), o ativo é o modelo PPL.

let active: Program = pplProgram(0);
let dayIndex = new Map<string, ProgramDay>();
let exIndex = new Map<string, ProgramExercise>();
/** Exercícios conhecidos só pelo histórico (retratos das sessões e `retired`). */
const known = new Map<string, ProgramExercise>();
/**
 * Dias de fora do programa ativo: dos outros programas salvos, do modelo PPL (o programa original do app) e dos
 * retratos das sessões. Só nome/sigla importam aqui; os exercícios de um treino antigo vêm dos retratos.
 */
const knownDays = new Map<string, ProgramDay>(PPL_DAYS.map((d) => [d.id, d]));
let version = 0;
const listeners = new Set<() => void>();

function reindex() {
  dayIndex = new Map(active.days.map((d) => [d.id, d]));
  exIndex = new Map(active.days.flatMap((d) => d.exercises.map((e) => [e.id, e] as const)));
  for (const e of active.retired ?? []) if (!exIndex.has(e.id)) known.set(e.id, e);
}
reindex();

/** Troca o programa ativo (ao abrir o app, ao importar um backup, ao editar o programa). */
export function setActiveProgram(p: Program) {
  active = p;
  reindex();
  version++;
  listeners.forEach((fn) => fn());
}

export function activeProgram(): Program {
  return active;
}

/** Dias do programa ativo, na ordem da rotação. */
export function programDays(): ProgramDay[] {
  return active.days;
}

/**
 * Dia pelo id. Tipado como sempre presente, como o antigo `DAY_BY_ID[id]`: quem pode receber um id de outro
 * programa usa `?.`.
 */
export function dayById(id: string): ProgramDay {
  return (dayIndex.get(id) ?? knownDays.get(id)) as ProgramDay;
}

/** Guarda os dias e exercícios de outros programas salvos (o histórico pode ter vindo deles). */
export function rememberPrograms(programs: Program[]) {
  for (const p of programs) {
    for (const d of p.days) if (!knownDays.has(d.id) || !dayIndex.has(d.id)) knownDays.set(d.id, d);
    for (const e of [...(p.retired ?? []), ...p.days.flatMap((d) => d.exercises)]) if (!known.has(e.id)) known.set(e.id, e);
  }
}

/**
 * Dia de uma sessão para mostrar o treino: o do programa ativo ou, se ele não existir mais aí, montado do retrato
 * da sessão (nome e sigla) com os exercícios como foram feitos.
 */
export function dayOf(session: Session): ProgramDay {
  const live = dayIndex.get(session.dayId);
  if (live) return live;
  const base = knownDays.get(session.dayId);
  return {
    id: session.dayId,
    name: session.day?.name ?? base?.name ?? session.dayId,
    code: session.day?.code ?? base?.code ?? "?",
    weekday: base?.weekday ?? 0,
    focus: session.day?.focus ?? base?.focus ?? "",
    notes: base?.notes ?? [],
    exercises: session.exercises.map((e) => exOf(e)).filter(Boolean),
  };
}

/** Exercício pelo id: primeiro o programa ativo, depois o histórico (retratos e removidos). */
export function exById(id: string): ProgramExercise {
  return (exIndex.get(id) ?? known.get(id)) as ProgramExercise;
}

/**
 * Exercício de uma entrada de sessão: o retrato salvo (como era no dia do treino) ou, sem retrato, o do programa.
 * Histórico, volume e recordes usam este, para que editar o programa não reescreva as semanas passadas.
 */
export function exOf(entry: { exId: string; snap?: ProgramExercise }): ProgramExercise {
  return entry.snap ?? exById(entry.exId);
}

/** Registra os retratos das sessões, para o histórico resolver exercícios que já não estão no programa. */
export function rememberSessions(sessions: Session[]) {
  for (const s of sessions) {
    for (const e of s.exercises) if (e.snap && !exIndex.has(e.exId) && !known.has(e.exId)) known.set(e.exId, e.snap);
    if (s.day && !dayIndex.has(s.dayId) && !knownDays.has(s.dayId)) {
      knownDays.set(s.dayId, {
        id: s.dayId,
        name: s.day.name,
        code: s.day.code,
        weekday: 0,
        focus: s.day.focus ?? "",
        notes: [],
        exercises: [],
      });
    }
  }
}

export function subscribeProgram(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function programVersion(): number {
  return version;
}

export const MUSCLE_LABEL: Record<MuscleId, string> = {
  costas: "Costas",
  peito: "Peito",
  quadriceps: "Quadríceps",
  deltLateral: "Deltoide lateral",
  posterior: "Posterior de coxa",
  biceps: "Bíceps",
  triceps: "Tríceps",
  panturrilha: "Panturrilha",
  deltPosterior: "Deltoide posterior",
  gluteo: "Glúteo",
  abdomen: "Abdômen",
  deltAnterior: "Deltoide anterior",
  trapezio: "Trapézio",
};

/** Ordem de exibição dos músculos (como na tabela de volume da ficha). */
export const MUSCLE_ORDER: MuscleId[] = [
  "costas",
  "peito",
  "quadriceps",
  "deltLateral",
  "posterior",
  "biceps",
  "triceps",
  "panturrilha",
  "deltPosterior",
  "gluteo",
  "abdomen",
  "deltAnterior",
  "trapezio",
];

/** Sinergistas do exercício (0,5 série cada): os do próprio exercício ou os da tabela da biblioteca. */
export function synergistsOf(ex: ProgramExercise): MuscleId[] {
  return ex.synergists ?? SYNERGISTS[ex.lib] ?? [];
}

/** Programa sem mesociclo (semana 0 nas regras). */
export function isFixedProgram(p: Program = active): boolean {
  return p.periodization === "fixed";
}

/** Exercícios da biblioteca e onde aparecem no programa ativo. */
export function usesOfLibrary(libId: string): ProgramExercise[] {
  return programDays().flatMap((d) => d.exercises.filter((e) => e.lib === libId));
}

export function dayOfExercise(exId: string): ProgramDay | undefined {
  return programDays().find((d) => d.exercises.some((e) => e.id === exId));
}

/** Nome curto do exercício: sem prefixo de superset, parênteses e variações depois de " · ". */
export function shortName(ex: ProgramExercise | undefined): string {
  if (!ex) return "";
  return ex.name
    .replace(/^A[12] · /, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/ · .*/, "")
    .trim();
}
