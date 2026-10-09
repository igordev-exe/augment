// Tipos centrais do app. O programa (ficha) é estático; os registros ficam no IndexedDB.

/** Até onde levar a série de trabalho. F = falha, T = falha técnica, R = parar com ~2 reps sobrando. */
export type StopKind = "F" | "T" | "R";

export type Unit = "kg" | "lb";

export type MuscleId =
  | "costas"
  | "peito"
  | "quadriceps"
  | "deltLateral"
  | "posterior"
  | "biceps"
  | "triceps"
  | "panturrilha"
  | "deltPosterior"
  | "gluteo"
  | "abdomen"
  | "deltAnterior"
  | "trapezio";

/** Conteúdo de biblioteca: como executar, erros, ciência. Um por exercício físico. */
export interface LibraryEntry {
  id: string;
  name: string;
  primary: string;
  secondary?: string;
  equipment: string;
  setup: string[];
  execution: string[];
  errors: string[];
  why: string;
  /** Busca no YouTube (pt) e (en). */
  videoPt: string;
  videoEn: string;
  alternatives?: string[];
}

/** Um exercício dentro de um dia da ficha. */
export interface ProgramExercise {
  /** id único dentro do programa (dia + exercício). */
  id: string;
  lib: string;
  /** Nome como aparece na ficha. */
  name: string;
  muscleLabel: string;
  /** Músculos que recebem séries diretas (contagem da ficha). */
  muscles: MuscleId[];
  sets: number;
  reps: [number, number];
  /** Descanso em segundos [mín, máx]. */
  rest: [number, number];
  restLabel: string;
  stop: StopKind;
  /** Isolado: −1 série na semana 1. */
  iso?: boolean;
  /** ▲: +1 série nas semanas 4–6. */
  up?: boolean;
  /** Intensificador da última série (a partir da semana 3). */
  intensifier?: string;
  /** Cadência própria além da regra geral. */
  tempo?: string;
  /** Detalhes da ficha. */
  cues: string[];
  /** Exercício composto (progressão +2,5 kg) ou isolado. */
  compound: boolean;
  /** Incremento padrão de carga (kg). */
  increment: number;
  defaultUnit?: Unit;
  perSide?: boolean;
  /** Superset: id do par e posição. */
  superset?: { with: string; order: 1 | 2 };
  /** Exercício alterado na v2 da ficha. */
  changed?: string;
}

export interface ProgramDay {
  id: string;
  name: string;
  code: string;
  weekday: number; // 1 = segunda
  focus: string;
  notes: string[];
  exercises: ProgramExercise[];
}

export type SetKind = "warmup" | "work" | "drop";

export interface SetEntry {
  id: string;
  kind: SetKind;
  weight: number | null;
  reps: number | null;
  done: boolean;
  /** Chegou na falha real nessa série. */
  failure?: boolean;
  doneAt?: number;
}

export interface SessionExercise {
  exId: string;
  unit: Unit;
  notes?: string;
  sets: SetEntry[];
}

export interface Session {
  id: string;
  dayId: string;
  /** Data local AAAA-MM-DD. */
  date: string;
  week: number;
  startedAt: number;
  finishedAt?: number;
  status: "active" | "done";
  notes?: string;
  exercises: SessionExercise[];
  /** Sessão criada a partir de "repetir treino". */
  repeatedFrom?: string;
}

export interface Settings {
  /** Como o app te chama ("Operador: …"). */
  operator: string;
  /** Segunda-feira de início do mesociclo atual (AAAA-MM-DD). */
  mesoStart: string;
  /** Dias de treino (0 = domingo … 6 = sábado). */
  trainingDays: number[];
  sound: boolean;
  vibrate: boolean;
  /** Unidade escolhida por exercício (id do programa). */
  units: Record<string, Unit>;
  /** Incremento personalizado por exercício (id do programa). */
  increments: Record<string, number>;
  /** Vídeo de referência escolhido (id da biblioteca → URL). */
  videos: Record<string, string>;
}
