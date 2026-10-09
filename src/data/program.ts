import type { MuscleId, ProgramDay, ProgramExercise, StopKind } from "./types";

// Ficha v2 (set/2026) transcrita. Para mudar o programa, edite só este arquivo.

type Ex = Omit<ProgramExercise, "id" | "restLabel" | "increment" | "compound"> & {
  key: string;
  compound?: boolean;
  increment?: number;
};

function restLabel([a, b]: [number, number]): string {
  if (a === 0) return "Direto para o par";
  const f = (s: number) => (s >= 120 && s % 60 === 0 ? `${s / 60}` : `${s}`);
  const unit = a >= 120 ? "min" : "s";
  if (a === b) return `${f(a)} ${unit}`;
  if (a < 120 && b >= 120) return `${a} s–${b / 60} min`;
  return `${f(a)}–${f(b)} ${unit}`;
}

function day(
  id: string,
  name: string,
  code: string,
  weekday: number,
  focus: string,
  notes: string[],
  exs: Ex[],
): ProgramDay {
  return {
    id,
    name,
    code,
    weekday,
    focus,
    notes,
    exercises: exs.map(({ key, compound, increment, ...e }) => {
      const isCompound = compound ?? !e.iso;
      return {
        ...e,
        id: `${id}.${key}`,
        compound: isCompound,
        increment: increment ?? 2.5,
        restLabel: restLabel(e.rest),
      };
    }),
  };
}

const T: StopKind = "T";
const F: StopKind = "F";
const R: StopKind = "R";
const m = (...ids: MuscleId[]) => ids;

export const PROGRAM: ProgramDay[] = [
  day("push-a", "Push A", "PA", 1, "Ênfase peito", [], [
    {
      key: "supino-incl-halt", lib: "supino-inclinado-halteres", name: "Supino inclinado com halteres (30–45°)",
      muscleLabel: "Peito", muscles: m("peito"), sets: 4, reps: [6, 10], rest: [180, 180], stop: T, increment: 2,
      cues: ["Desça até o alongamento máximo confortável.", "Halteres em vez de barra: o braço passa abaixo da linha do tronco."],
    },
    {
      key: "supino-maq", lib: "supino-reto-maquina", name: "Supino reto na máquina / Hammer",
      muscleLabel: "Peito", muscles: m("peito"), sets: 3, reps: [8, 12], rest: [120, 120], stop: T, up: true,
      cues: ["Carga estável: é onde dá para empurrar forte sem risco."],
    },
    {
      key: "crucifixo-cabo", lib: "crucifixo-cabo", name: "Crucifixo no cabo (polia baixa → média)",
      muscleLabel: "Peito", muscles: m("peito"), sets: 3, reps: [12, 15], rest: [90, 90], stop: F, iso: true, up: true,
      cues: ["Pico de resistência na posição alongada: controle bem a abertura."],
    },
    {
      key: "desenv-maq", lib: "desenvolvimento-maquina", name: "Desenvolvimento na máquina",
      muscleLabel: "Ombro anterior", muscles: m("deltAnterior"), sets: 3, reps: [8, 12], rest: [120, 120], stop: T,
      cues: ["Amplitude completa.", "Não trave o cotovelo no topo."],
    },
    {
      key: "lateral-cabo", lib: "elevacao-lateral-cabo", name: "Elevação lateral no cabo, unilateral",
      muscleLabel: "Ombro lateral", muscles: m("deltLateral"), sets: 4, reps: [12, 20], rest: [60, 90], stop: F, iso: true,
      intensifier: "Rest-pause na última", perSide: true,
      cues: ["Cabo passando por trás do corpo."],
    },
    {
      key: "testa-halt", lib: "triceps-testa-halteres", name: "Tríceps testa com halteres",
      muscleLabel: "Tríceps", muscles: m("triceps"), sets: 3, reps: [8, 12], rest: [90, 90], stop: T, iso: true, increment: 2,
      cues: ["Cotovelo levemente atrás da vertical para alongar a cabeça longa."],
    },
    {
      key: "triceps-corda", lib: "triceps-corda", name: "Tríceps corda na polia",
      muscleLabel: "Tríceps", muscles: m("triceps"), sets: 3, reps: [12, 15], rest: [60, 60], stop: F, iso: true,
      intensifier: "Drop set na última",
      cues: ["Corda ou barra: não há diferença demonstrada."],
    },
  ]),
  day("pull-a", "Pull A", "PL", 2, "Ênfase largura de dorsal", [], [
    {
      key: "puxada-aberta", lib: "puxada-aberta", name: "Puxada aberta pronada",
      muscleLabel: "Costas", muscles: m("costas"), sets: 4, reps: [8, 12], rest: [120, 180], stop: T,
      cues: ["Estenda o braço 100% em cima.", "Puxe com o cotovelo, não com a mão."],
    },
    {
      key: "remada-apoio", lib: "remada-apoio-peito", name: "Remada com apoio de peito (ou cavalinho)",
      muscleLabel: "Costas", muscles: m("costas"), sets: 4, reps: [8, 12], rest: [120, 180], stop: T,
      cues: ["Apoio no peito tira a carga da lombar."],
    },
    {
      key: "pullover", lib: "pullover-polia", name: "Pullover na polia alta",
      muscleLabel: "Costas", muscles: m("costas"), sets: 3, reps: [12, 15], rest: [90, 90], stop: F, iso: true, up: true,
      cues: ["Dorsal por extensão de ombro.", "Cotovelo levemente flexionado e fixo."],
    },
    {
      key: "crucifixo-inv", lib: "crucifixo-inverso-maquina", name: "Crucifixo inverso na máquina",
      muscleLabel: "Ombro posterior", muscles: m("deltPosterior"), sets: 3, reps: [15, 20], rest: [60, 90], stop: F, iso: true,
      cues: ["Sem impulso de tronco."],
    },
    {
      key: "encolhimento", lib: "encolhimento-halteres", name: "Encolhimento com halteres",
      muscleLabel: "Trapézio", muscles: m("trapezio"), sets: 3, reps: [10, 15], rest: [90, 90], stop: F, iso: true, increment: 2,
      tempo: "Pausa 1 s no topo",
      cues: ["Suba os ombros em direção às orelhas, sem girar."],
    },
    {
      key: "rosca-incl", lib: "rosca-inclinada", name: "Rosca inclinada com halteres (banco 45–60°)",
      muscleLabel: "Bíceps", muscles: m("biceps"), sets: 3, reps: [8, 12], rest: [90, 90], stop: F, iso: true, increment: 2,
      cues: ["Braço atrás do tronco: cabeça longa do bíceps alongada."],
    },
    {
      key: "martelo-corda", lib: "rosca-martelo-corda", name: "Rosca martelo na corda",
      muscleLabel: "Bíceps e braquial", muscles: m("biceps"), sets: 3, reps: [10, 15], rest: [60, 90], stop: F, iso: true,
      cues: ["Braquial e braquiorradial: espessura do braço."],
    },
  ]),
  day("lower-a", "Lower A", "LA", 3, "Ênfase quadríceps", [], [
    {
      key: "hack", lib: "hack", name: "Hack machine (ou agachamento livre profundo)",
      muscleLabel: "Quadríceps", muscles: m("quadriceps"), sets: 4, reps: [6, 10], rest: [180, 180], stop: T, increment: 5,
      cues: ["Profundidade máxima que a mobilidade permitir sem soltar a lombar."],
    },
    {
      key: "leg-press", lib: "leg-press-profundo", name: "Leg press profundo, pés baixos e estreitos",
      muscleLabel: "Quadríceps", muscles: m("quadriceps"), sets: 3, reps: [10, 15], rest: [120, 180], stop: T, increment: 5,
      cues: ["Desça até o quadril quase enrolar (pare antes da lombar sair do banco)."],
    },
    {
      key: "extensora", lib: "cadeira-extensora", name: "Cadeira extensora",
      muscleLabel: "Quadríceps", muscles: m("quadriceps"), sets: 3, reps: [12, 20], rest: [90, 90], stop: F, iso: true,
      intensifier: "Parciais na parte baixa após a falha (última)",
      cues: ["Volte freando, sem soltar o peso."],
    },
    {
      key: "flexora", lib: "flexora-sentada", name: "Cadeira flexora sentada",
      muscleLabel: "Posterior de coxa", muscles: m("posterior"), sets: 3, reps: [10, 15], rest: [90, 90], stop: F, iso: true,
      changed: "Antes: mesa flexora deitada.",
      cues: ["Varie a posição dos pés em relação ao Lower B.", "Deitada só se a sentada estiver ocupada."],
    },
    {
      key: "panturrilha-pe", lib: "panturrilha-em-pe", name: "Panturrilha em pé · parciais alongadas",
      muscleLabel: "Panturrilha", muscles: m("panturrilha"), sets: 4, reps: [10, 15], rest: [60, 90], stop: F, iso: true,
      tempo: "Sem quicar", changed: "Agora a série inteira em parciais alongadas.",
      cues: ["A série inteira só na metade de baixo do movimento."],
    },
    {
      key: "abd-polia", lib: "abdominal-polia", name: "Abdominal na polia, ajoelhado",
      muscleLabel: "Abdômen", muscles: m("abdomen"), sets: 3, reps: [10, 15], rest: [60, 60], stop: T, iso: true,
      cues: ["Flexione a coluna, não o quadril."],
    },
  ]),
  day("upper-b", "Upper B", "UB", 4, "Ênfase ombro e braço",
    ["Duração estimada ~70–75 min. Se estourar, corte 1 série da face pull."], [
    {
      key: "supino-smith", lib: "supino-inclinado-smith", name: "Supino inclinado no Smith ou máquina",
      muscleLabel: "Peito", muscles: m("peito"), sets: 3, reps: [8, 12], rest: [120, 180], stop: T,
      cues: ["Ângulo diferente do Push A."],
    },
    {
      key: "puxada-uni", lib: "puxada-unilateral", name: "Puxada unilateral na polia alta",
      muscleLabel: "Costas", muscles: m("costas"), sets: 3, reps: [8, 12], rest: [120, 120], stop: T, perSide: true,
      changed: "3 séries por lado (antes 4), para caber no tempo.",
      cues: ["Alterne os lados sem descanso entre eles."],
    },
    {
      key: "remada-baixa", lib: "remada-baixa-neutra", name: "Remada baixa no cabo, pegada neutra",
      muscleLabel: "Costas", muscles: m("costas"), sets: 3, reps: [10, 15], rest: [120, 120], stop: T, up: true,
      cues: ["Deixe a escápula ir para frente no alongamento."],
    },
    {
      key: "desenv-halt", lib: "desenvolvimento-halteres", name: "Desenvolvimento com halteres",
      muscleLabel: "Ombro anterior", muscles: m("deltAnterior"), sets: 3, reps: [8, 12], rest: [120, 120], stop: T, increment: 2,
      cues: ["Amplitude completa, sem bater os halteres no topo."],
    },
    {
      key: "lateral-maq", lib: "elevacao-lateral-maquina", name: "Elevação lateral na máquina",
      muscleLabel: "Ombro lateral", muscles: m("deltLateral"), sets: 4, reps: [12, 20], rest: [60, 90], stop: F, iso: true,
      intensifier: "Drop set duplo na última",
      cues: ["Suba até a linha do ombro, sem dar tranco."],
    },
    {
      key: "face-pull", lib: "face-pull", name: "Face pull ou crucifixo inverso no cabo",
      muscleLabel: "Ombro posterior", muscles: m("deltPosterior"), sets: 3, reps: [15, 20], rest: [60, 60], stop: F, iso: true,
      cues: ["Puxe abrindo os cotovelos para fora e para cima."],
    },
    {
      key: "triceps-overhead", lib: "triceps-overhead-cabo", name: "A1 · Tríceps overhead no cabo",
      muscleLabel: "Tríceps", muscles: m("triceps"), sets: 3, reps: [10, 15], rest: [0, 0], stop: F, iso: true,
      superset: { with: "upper-b.rosca-scott", order: 1 },
      cues: ["Superset com A2: vá direto para a rosca.", "Não passe de ~90° de flexão do cotovelo."],
    },
    {
      key: "rosca-scott", lib: "rosca-scott-bayesian", name: "A2 · Rosca Scott máquina / bayesian no cabo",
      muscleLabel: "Bíceps", muscles: m("biceps"), sets: 3, reps: [10, 15], rest: [60, 60], stop: F, iso: true,
      superset: { with: "upper-b.triceps-overhead", order: 2 },
      intensifier: "Myo-reps na última",
      cues: ["Superset com A1: 60 s de descanso depois da rosca, e volta ao tríceps."],
    },
  ]),
  day("lower-b", "Lower B", "LB", 5, "Ênfase posterior de coxa e glúteo", [], [
    {
      key: "terra-romeno", lib: "terra-romeno", name: "Levantamento terra romeno (halteres ou barra)",
      muscleLabel: "Posterior de coxa", muscles: m("posterior"), sets: 4, reps: [6, 10], rest: [180, 180], stop: R,
      tempo: "Desce em até 4 s",
      cues: ["Quadril para trás, joelho quase travado.", "Nunca à falha."],
    },
    {
      key: "flexora", lib: "flexora-sentada", name: "Cadeira flexora sentada",
      muscleLabel: "Posterior de coxa", muscles: m("posterior"), sets: 4, reps: [10, 15], rest: [90, 90], stop: F, iso: true,
      cues: ["Quadril flexionado pré-alonga o posterior.", "Pés em posição diferente da do Lower A."],
    },
    {
      key: "elevacao-pelvica", lib: "elevacao-pelvica", name: "Elevação pélvica (máquina ou barra)",
      muscleLabel: "Glúteo", muscles: m("gluteo"), sets: 3, reps: [8, 12], rest: [120, 120], stop: T, increment: 5,
      tempo: "Pausa 1 s no topo",
      cues: ["Máquina ou barra: sem diferença demonstrada."],
    },
    {
      key: "bulgaro", lib: "bulgaro-leg-press-alto", name: "Afundo / búlgaro ou leg press pés altos",
      muscleLabel: "Glúteo", muscles: m("gluteo", "quadriceps"), sets: 3, reps: [10, 15], rest: [120, 120], stop: T, increment: 2,
      cues: ["Escolha a opção que você tolera melhor.", "Amplitude profunda."],
    },
    {
      key: "panturrilha-sentada", lib: "panturrilha-sentada", name: "Panturrilha sentada",
      muscleLabel: "Panturrilha (sóleo)", muscles: m("panturrilha"), sets: 4, reps: [10, 15], rest: [60, 90], stop: F, iso: true,
      tempo: "Pausa embaixo",
      cues: ["Amplitude completa."],
    },
    {
      key: "lateral-halt", lib: "elevacao-lateral-halteres", name: "Elevação lateral com halteres (ou cabo)",
      muscleLabel: "Ombro lateral", muscles: m("deltLateral"), sets: 3, reps: [15, 20], rest: [60, 60], stop: F, iso: true, up: true, increment: 2,
      cues: ["Se o cabo estiver livre, prefira: mantém tensão na parte baixa."],
    },
    {
      key: "abd-roda", lib: "abdominal-roda", name: "Abdominal na roda ou prancha com carga",
      muscleLabel: "Abdômen", muscles: m("abdomen"), sets: 3, reps: [8, 12], rest: [60, 60], stop: T, iso: true,
      cues: ["Sem deixar a lombar afundar."],
    },
  ]),
];

export const DAY_BY_ID: Record<string, ProgramDay> = Object.fromEntries(PROGRAM.map((d) => [d.id, d]));

export const EXERCISE_BY_ID: Record<string, ProgramExercise> = Object.fromEntries(
  PROGRAM.flatMap((d) => d.exercises.map((e) => [e.id, e] as const)),
);

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
  "costas", "peito", "quadriceps", "deltLateral", "posterior", "biceps", "triceps",
  "panturrilha", "deltPosterior", "gluteo", "abdomen", "deltAnterior", "trapezio",
];

/** Exercícios da biblioteca e onde aparecem na ficha. */
export function usesOfLibrary(libId: string): ProgramExercise[] {
  return PROGRAM.flatMap((d) => d.exercises.filter((e) => e.lib === libId));
}

export function dayOfExercise(exId: string): ProgramDay | undefined {
  return PROGRAM.find((d) => d.exercises.some((e) => e.id === exId));
}
