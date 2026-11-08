import { LIB_BY_ID, LIB_MUSCLES } from "../library";
import { MUSCLE_LABEL } from "../program";
import { SYNERGISTS } from "../science";
import type { Program, ProgramDay, ProgramExercise, StopKind } from "../types";
import { pplProgram, restLabel } from "./ppl";

// Modelos prontos. "Usar modelo" copia para um programa próprio (editável); o modelo em si nunca muda.
// Só usam exercícios da biblioteca (imagens, execução e alternativas já existem para eles).

type Spec = [lib: string, sets: number, reps: [number, number], stop?: StopKind, extra?: Partial<ProgramExercise>];

function ex(dayId: string, [lib, sets, reps, stop, extra]: Spec): ProgramExercise {
  const compound = (SYNERGISTS[lib]?.length ?? 0) > 0;
  const rest: [number, number] = compound ? [120, 180] : [60, 90];
  const muscles = LIB_MUSCLES[lib] ?? [];
  return {
    id: `${dayId}.${lib}`,
    lib,
    name: LIB_BY_ID[lib]?.name ?? lib,
    muscleLabel: muscles.map((m) => MUSCLE_LABEL[m]).join(" e ") || "—",
    muscles,
    sets,
    reps,
    rest,
    restLabel: restLabel(rest),
    stop: stop ?? (compound ? "T" : "F"),
    iso: !compound || undefined,
    cues: [],
    compound,
    increment: 2.5,
    ...extra,
  };
}

function day(id: string, name: string, code: string, weekday: number, focus: string, specs: Spec[]): ProgramDay {
  return { id, name, code, weekday, focus, notes: [], exercises: specs.map((s) => ex(id, s)) };
}

function fullBody(now: number): Program {
  return {
    id: "fb-3",
    name: "Full body 3 dias",
    template: "fb-3",
    periodization: "meso",
    days: [
      day("fb-a", "Full A", "FA", 1, "Corpo todo", [
        ["supino-reto-maquina", 3, [8, 12]],
        ["puxada-aberta", 3, [8, 12]],
        ["hack", 3, [8, 12]],
        ["flexora-sentada", 3, [10, 15]],
        ["elevacao-lateral-cabo", 3, [12, 20], "F", { up: true }],
        ["triceps-corda", 2, [10, 15]],
        ["abdominal-polia", 2, [10, 15]],
      ]),
      day("fb-b", "Full B", "FB", 3, "Corpo todo", [
        ["supino-inclinado-halteres", 3, [6, 10]],
        ["remada-apoio-peito", 3, [8, 12]],
        ["leg-press-profundo", 3, [10, 15]],
        ["terra-romeno", 3, [8, 12]],
        ["face-pull", 2, [12, 20]],
        ["rosca-inclinada", 2, [8, 12]],
        ["panturrilha-em-pe", 3, [10, 15]],
      ]),
      day("fb-c", "Full C", "FC", 5, "Corpo todo", [
        ["supino-inclinado-smith", 3, [8, 12]],
        ["puxada-unilateral", 3, [8, 12]],
        ["bulgaro-leg-press-alto", 3, [8, 12], "T"],
        ["elevacao-pelvica", 3, [8, 12], "T"],
        ["elevacao-lateral-maquina", 3, [12, 20], "F", { up: true }],
        ["triceps-overhead-cabo", 2, [10, 15]],
        ["rosca-martelo-corda", 2, [10, 15]],
      ]),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function upperLower(now: number): Program {
  return {
    id: "ul-4",
    name: "Upper / Lower 4 dias",
    template: "ul-4",
    periodization: "meso",
    days: [
      day("ul-ua", "Upper A", "UA", 1, "Ênfase peito e costas", [
        ["supino-inclinado-halteres", 3, [6, 10]],
        ["remada-apoio-peito", 3, [8, 12]],
        ["desenvolvimento-maquina", 2, [8, 12]],
        ["puxada-aberta", 3, [8, 12]],
        ["elevacao-lateral-cabo", 3, [12, 20], "F", { up: true }],
        ["triceps-corda", 2, [10, 15]],
        ["rosca-inclinada", 2, [8, 12]],
      ]),
      day("ul-la", "Lower A", "LA", 2, "Ênfase quadríceps", [
        ["hack", 3, [6, 10]],
        ["terra-romeno", 3, [8, 12]],
        ["cadeira-extensora", 2, [10, 15], "F", { up: true }],
        ["flexora-sentada", 3, [10, 15]],
        ["panturrilha-em-pe", 3, [10, 15]],
        ["abdominal-polia", 2, [10, 15]],
      ]),
      day("ul-ub", "Upper B", "UB", 4, "Ênfase ombro e braço", [
        ["supino-reto-maquina", 3, [8, 12]],
        ["puxada-unilateral", 3, [8, 12]],
        ["crucifixo-cabo", 2, [10, 15]],
        ["remada-baixa-neutra", 2, [10, 12]],
        ["elevacao-lateral-maquina", 3, [12, 20], "F", { up: true }],
        ["crucifixo-inverso-maquina", 2, [12, 20]],
        ["triceps-overhead-cabo", 2, [10, 15]],
        ["rosca-martelo-corda", 2, [10, 15]],
      ]),
      day("ul-lb", "Lower B", "LB", 5, "Ênfase posterior e glúteo", [
        ["leg-press-profundo", 3, [10, 15]],
        ["elevacao-pelvica", 3, [8, 12], "T"],
        ["bulgaro-leg-press-alto", 2, [8, 12], "T"],
        ["flexora-sentada", 2, [10, 15]],
        ["panturrilha-sentada", 3, [12, 20]],
        ["abdominal-roda", 2, [8, 12]],
      ]),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export interface TemplateInfo {
  id: string;
  name: string;
  /** Uma linha sobre para quem é. */
  pitch: string;
  /** Dias de treino sugeridos (0 = domingo … 6 = sábado). */
  trainingDays: number[];
  make: (now?: number) => Program;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "ppl-v2",
    name: "PPL 5 dias",
    pitch: "Push, Pull e Lower em rotação de 5 dias. Mais volume, para quem treina quase todo dia.",
    trainingDays: [1, 2, 3, 4, 5],
    make: (now = Date.now()) => pplProgram(now),
  },
  {
    id: "ul-4",
    name: "Upper / Lower 4 dias",
    pitch: "Superior e inferior duas vezes por semana. Equilíbrio entre volume e recuperação.",
    trainingDays: [1, 2, 4, 5],
    make: (now = Date.now()) => upperLower(now),
  },
  {
    id: "fb-3",
    name: "Full body 3 dias",
    pitch: "Corpo todo três vezes por semana. Para pouco tempo ou para começar.",
    trainingDays: [1, 3, 5],
    make: (now = Date.now()) => fullBody(now),
  },
];
