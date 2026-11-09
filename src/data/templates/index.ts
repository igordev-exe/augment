import { LIB_BY_ID, LIB_MUSCLES } from "../library";
import { EXT_BY_ID } from "../library-extended";
import { MUSCLE_LABEL } from "../program";
import { SYNERGISTS } from "../science";
import type { MuscleId, Program, ProgramDay, ProgramExercise, StopKind } from "../types";
import { pplProgram, restLabel } from "./ppl";

// Modelos prontos. "Usar modelo" copia para um programa próprio (editável); o modelo em si nunca muda.
// Fontes: "Treino de força e hipertrofia baseado em evidências — banco de fontes" (nov/2026, seções 3 e 4) e
// "Pesquisa Profunda: Ciências do Exercício" (aplicação prática 4×/semana, 60 min). Todos miram ~10–16 séries
// fracionadas por músculo por semana, cada músculo 2–3×/semana e até ~10–11 séries por músculo num treino.
// "Até onde": R = sobra 2 (compostos pesados), T = falha técnica / 1–2 RIR, F = falha ou 0–1 RIR (isoladores).

interface Extra extends Partial<ProgramExercise> {
  /** Faz superset com o próximo exercício da lista (este é o A1, o próximo o A2). */
  pairNext?: boolean;
}
type Spec = [lib: string, sets: number, reps: [number, number], stop?: StopKind, extra?: Extra];

interface DayOpts {
  /** Descanso dos compostos (s). Padrão 2–3 min; os modelos com ênfase em glúteos usam 1,5–2,5 min. */
  compoundRest?: [number, number];
}

function ex(dayId: string, [lib, sets, reps, stop, extra]: Spec, opts: DayOpts): ProgramExercise {
  const ext = LIB_BY_ID[lib] ? undefined : EXT_BY_ID[lib];
  const compound = ext ? ext.compound : (SYNERGISTS[lib]?.length ?? 0) > 0;
  const rest: [number, number] = compound ? (opts.compoundRest ?? [120, 180]) : [60, 90];
  const muscles: MuscleId[] = LIB_MUSCLES[lib] ?? ext?.muscles ?? [];
  const { pairNext: _pair, ...rest_ } = extra ?? {};
  return {
    id: `${dayId}.${lib}`,
    lib,
    name: LIB_BY_ID[lib]?.name ?? ext?.name ?? lib,
    muscleLabel: muscles.map((m) => MUSCLE_LABEL[m]).join(" e ") || "—",
    muscles,
    synergists: ext?.synergists.length ? [...ext.synergists] : undefined,
    sets,
    reps,
    rest,
    restLabel: restLabel(rest),
    stop: stop ?? (compound ? "T" : "F"),
    iso: !compound || undefined,
    cues: [],
    compound,
    increment: 2.5,
    ...rest_,
  };
}

function day(id: string, name: string, code: string, weekday: number, focus: string, specs: Spec[], opts: DayOpts = {}): ProgramDay {
  const exercises = specs.map((s) => ex(id, s, opts));
  // Supersets: o exercício marcado com pairNext vira A1 e o seguinte, A2.
  specs.forEach((s, i) => {
    if (!s[4]?.pairNext || !exercises[i + 1]) return;
    exercises[i].superset = { with: exercises[i + 1].id, order: 1 };
    exercises[i + 1].superset = { with: exercises[i].id, order: 2 };
  });
  return { id, name, code, weekday, focus, notes: [], exercises };
}

function program(id: string, name: string, days: ProgramDay[], now: number): Program {
  return { id, name, template: id, periodization: "meso", days, createdAt: now, updatedAt: now };
}

// Exercícios da biblioteca completa (nomes em português e sinergistas corrigidos para o volume fracionado:
// no banco original, remadas e barra fixa vinham com "deltoide anterior" e o agachamento com panturrilha e posterior).
const PULL_SYN: Extra = { synergists: ["biceps", "deltPosterior"] };
const SQUAT: Extra = { name: "Agachamento livre com barra", synergists: ["gluteo"] };
const BENCH: Extra = { name: "Supino reto com barra" };
const DB_BENCH: Extra = { name: "Supino reto com halteres" };
const ROW: Extra = { name: "Remada curvada com barra", ...PULL_SYN };
const PULLUP: Extra = { name: "Barra fixa (ou puxada alta)", ...PULL_SYN };
const NEUTRAL_PULLDOWN: Extra = { name: "Puxada alta com pegada neutra", ...PULL_SYN };
const DB_ROW: Extra = { name: "Remada unilateral com halter", perSide: true, ...PULL_SYN };
const CURL: Extra = { name: "Rosca direta com barra" };
const DIPS: Extra = { name: "Paralelas (ou supino fechado)" };
const PRESS: Extra = { name: "Desenvolvimento com barra (em pé ou sentado)", synergists: ["triceps", "deltLateral"] };
const ABDUCTION: Extra = { name: "Abdução de quadril na máquina" };
const HIP_EXT: Extra = { name: "Extensão de quadril (banco 45° ou no cabo)", perSide: true };

// ---------- Base (seção 3 do banco de fontes) ----------

/** Fullbody 3× (seg/qua/sex): iniciante a intermediário. */
function fullBody(now: number): Program {
  return program(
    "fb-3",
    "Fullbody 3 dias",
    [
      day("fb-a", "Full A", "FA", 1, "Agachamento, supino e remada", [
        ["db-Barbell_Squat", 3, [6, 10], "R", SQUAT],
        ["db-Barbell_Bench_Press_-_Medium_Grip", 3, [6, 10], "T", BENCH],
        ["remada-apoio-peito", 3, [8, 12], "T"],
        ["flexora-sentada", 2, [10, 15], "F"],
        ["elevacao-lateral-halteres", 2, [12, 20], "F", { up: true }],
        ["db-Barbell_Curl", 2, [10, 15], "F", CURL],
      ]),
      day("fb-b", "Full B", "FB", 3, "Stiff, desenvolvimento e puxada", [
        ["terra-romeno", 3, [6, 10], "R"],
        ["desenvolvimento-halteres", 3, [8, 12], "T"],
        ["puxada-aberta", 3, [8, 12], "T"],
        ["leg-press-profundo", 2, [10, 15], "T"],
        ["triceps-overhead-cabo", 2, [10, 15], "F"],
        ["panturrilha-em-pe", 3, [10, 15], "F"],
      ]),
      day("fb-c", "Full C", "FC", 5, "Hack, supino inclinado e glúteo", [
        ["hack", 3, [8, 12], "T", { name: "Agachamento hack (ou búlgaro)" }],
        ["supino-inclinado-halteres", 3, [8, 12], "T"],
        ["remada-baixa-neutra", 3, [8, 12], "T"],
        ["elevacao-pelvica", 2, [8, 12], "T"],
        ["crucifixo-cabo", 2, [12, 15], "F", { up: true }],
        ["rosca-inclinada", 2, [10, 15], "F", { pairNext: true }],
        ["triceps-corda", 2, [10, 15], "F", { name: "Tríceps pulley" }],
      ]),
    ],
    now,
  );
}

/** Upper/Lower 4× (seg/ter/qui/sex): intermediário. */
function upperLower(now: number): Program {
  return program(
    "ul-4",
    "Upper / Lower 4 dias",
    [
      day("ul-ua", "Upper A", "UA", 1, "Força no supino e na remada", [
        ["db-Barbell_Bench_Press_-_Medium_Grip", 3, [5, 8], "T", BENCH],
        ["db-Bent_Over_Barbell_Row", 3, [6, 10], "T", ROW],
        ["desenvolvimento-halteres", 2, [8, 12], "T"],
        ["db-V-Bar_Pulldown", 3, [8, 12], "T", NEUTRAL_PULLDOWN],
        ["crucifixo-cabo", 2, [12, 15], "F", { up: true }],
        ["triceps-overhead-cabo", 2, [10, 15], "F"],
        ["rosca-inclinada", 2, [10, 15], "F"],
      ]),
      day("ul-la", "Lower A", "LA", 2, "Agachamento e stiff", [
        ["db-Barbell_Squat", 3, [5, 8], "R", SQUAT],
        ["terra-romeno", 3, [6, 10], "R"],
        ["leg-press-profundo", 2, [10, 15], "T"],
        ["flexora-sentada", 3, [10, 15], "F"],
        ["panturrilha-em-pe", 3, [10, 15], "F"],
      ]),
      day("ul-ub", "Upper B", "UB", 4, "Supino inclinado, barra fixa e ombro", [
        ["supino-inclinado-halteres", 3, [8, 12], "T"],
        ["db-Pullups", 3, [6, 10], "T", PULLUP],
        ["remada-baixa-neutra", 3, [10, 12], "T"],
        ["elevacao-lateral-halteres", 3, [12, 20], "F", { up: true }],
        ["db-Dips_-_Triceps_Version", 2, [8, 12], "T", DIPS],
        ["rosca-martelo-corda", 2, [10, 15], "F", { name: "Rosca martelo" }],
      ]),
      day("ul-lb", "Lower B", "LB", 5, "Glúteo, quadríceps e posterior", [
        ["elevacao-pelvica", 3, [6, 10], "R", { name: "Hip thrust (ou terra convencional)" }],
        ["hack", 3, [8, 12], "T", { name: "Agachamento hack (ou búlgaro)" }],
        ["cadeira-extensora", 3, [10, 15], "F", { up: true }],
        ["flexora-sentada", 2, [10, 15], "F"],
        ["panturrilha-em-pe", 3, [10, 15], "F", { name: "Panturrilha (em pé ou no leg press)" }],
      ]),
    ],
    now,
  );
}

/** PPL 6× (PPL-PPL, 1 dia de folga): a 1ª volta com foco em força, a 2ª em hipertrofia. */
function ppl6(now: number): Program {
  return program(
    "ppl-6",
    "PPL 6 dias",
    [
      day("p6-push1", "Push 1", "PS1", 1, "Força: supino e desenvolvimento", [
        ["db-Barbell_Bench_Press_-_Medium_Grip", 3, [5, 8], "T", BENCH],
        ["db-Standing_Military_Press", 3, [6, 10], "T", PRESS],
        ["supino-inclinado-halteres", 2, [8, 12], "T"],
        ["elevacao-lateral-halteres", 3, [12, 20], "F", { up: true }],
        ["triceps-overhead-cabo", 3, [10, 15], "F"],
      ]),
      day("p6-pull1", "Pull 1", "PL1", 2, "Força: barra fixa e remada", [
        ["db-Pullups", 3, [6, 10], "T", PULLUP],
        ["db-Bent_Over_Barbell_Row", 3, [6, 10], "T", ROW],
        ["db-V-Bar_Pulldown", 2, [10, 12], "T", NEUTRAL_PULLDOWN],
        ["crucifixo-inverso-maquina", 2, [12, 20], "F"],
        ["rosca-inclinada", 3, [10, 15], "F"],
      ]),
      day("p6-legs1", "Legs 1", "LG1", 3, "Força: agachamento e stiff", [
        ["db-Barbell_Squat", 3, [5, 8], "R", SQUAT],
        ["terra-romeno", 3, [6, 10], "R"],
        ["leg-press-profundo", 2, [10, 15], "T"],
        ["flexora-sentada", 3, [10, 15], "F"],
        ["panturrilha-em-pe", 3, [10, 15], "F"],
      ]),
      day("p6-push2", "Push 2", "PS2", 4, "Hipertrofia: peito, ombro e tríceps", [
        ["supino-inclinado-smith", 3, [8, 12], "T", { name: "Supino inclinado com barra ou Smith" }],
        ["crucifixo-cabo", 3, [12, 15], "F", { up: true }],
        ["db-Dips_-_Triceps_Version", 2, [8, 12], "T", { name: "Paralelas" }],
        ["elevacao-lateral-cabo", 3, [12, 20], "F", { up: true }],
        ["triceps-corda", 2, [12, 15], "F", { name: "Tríceps pulley" }],
      ]),
      day("p6-pull2", "Pull 2", "PL2", 5, "Hipertrofia: costas e bíceps", [
        ["remada-apoio-peito", 3, [8, 12], "T"],
        ["puxada-aberta", 3, [10, 12], "T"],
        ["db-One-Arm_Dumbbell_Row", 2, [10, 12], "T", DB_ROW],
        ["face-pull", 2, [12, 20], "F"],
        ["rosca-scott-bayesian", 3, [10, 15], "F", { name: "Rosca martelo ou bayesian no cabo" }],
      ]),
      day("p6-legs2", "Legs 2", "LG2", 6, "Hipertrofia: quadríceps e glúteo", [
        ["hack", 3, [8, 12], "T", { name: "Agachamento hack (ou búlgaro)" }],
        ["elevacao-pelvica", 3, [8, 12], "T"],
        ["cadeira-extensora", 3, [10, 15], "F", { up: true }],
        ["flexora-sentada", 2, [10, 15], "F"],
        ["panturrilha-em-pe", 3, [12, 20], "F"],
      ]),
    ],
    now,
  );
}

/**
 * Superior/Inferior 4×, 60 min, força + hipertrofia (Pesquisa Profunda, aplicação prática): supino pesado (80–85% 1RM)
 * para força e o resto em comprimento muscular longo (tríceps acima da cabeça, rosca Scott, flexora sentada).
 */
function upperLowerStrength(now: number): Program {
  return program(
    "ul-forca",
    "Superior / Inferior 4 dias · força + hipertrofia",
    [
      day("ulf-sa", "Superior A", "SA", 1, "Supino pesado e costas", [
        ["db-Barbell_Bench_Press_-_Medium_Grip", 4, [5, 6], "R", BENCH],
        ["puxada-aberta", 3, [8, 12], "T"],
        ["remada-apoio-peito", 3, [8, 12], "T"],
        ["triceps-overhead-cabo", 3, [10, 12], "F"],
        ["rosca-scott-bayesian", 3, [10, 12], "F"],
        ["elevacao-lateral-cabo", 3, [10, 15], "F", { up: true }],
      ]),
      day("ulf-ia", "Inferior A", "IA", 2, "Agachamento e reto femoral", [
        ["db-Barbell_Squat", 3, [6, 10], "R", SQUAT],
        ["cadeira-extensora", 3, [8, 12], "T", { cues: ["Comece com o joelho bem flexionado (~100°): é aí que o reto femoral cresce."] }],
        ["flexora-sentada", 3, [10, 12], "T"],
        ["terra-romeno", 2, [6, 10], "R"],
        ["panturrilha-em-pe", 3, [10, 15], "F"],
      ]),
      day("ulf-sb", "Superior B", "SB", 4, "Supino inclinado, ombro e braço", [
        ["supino-inclinado-halteres", 2, [8, 10], "T"],
        ["desenvolvimento-halteres", 2, [8, 12], "T"],
        ["crucifixo-cabo", 2, [12, 15], "F"],
        ["puxada-unilateral", 3, [8, 12], "T"],
        ["remada-baixa-neutra", 3, [8, 12], "T"],
        ["triceps-overhead-cabo", 3, [10, 12], "F"],
        ["rosca-scott-bayesian", 3, [10, 12], "F", { up: true }],
        ["elevacao-lateral-halteres", 3, [10, 15], "F"],
      ]),
      day("ulf-ib", "Inferior B", "IB", 5, "Leg press e posterior", [
        ["leg-press-profundo", 3, [6, 10], "R"],
        ["cadeira-extensora", 3, [8, 12], "T"],
        ["flexora-sentada", 3, [10, 12], "T", { up: true }],
        ["terra-romeno", 2, [6, 10], "R"],
        ["panturrilha-em-pe", 3, [10, 15], "F"],
      ]),
    ],
    now,
  );
}

// ---------- Ênfase em pernas e glúteos (seção 4 do banco de fontes) ----------
// Mesmo volume e RIR dos modelos base; muda a ênfase. Descanso um pouco menor nos compostos (1,5–2,5 min).

const GLUTE_REST: DayOpts = { compoundRest: [90, 150] };

function fullBodyGlutes(now: number): Program {
  return program(
    "fb-3-gluteo",
    "Fullbody 3 dias · pernas e glúteos",
    [
      day(
        "fbg-a",
        "Full A",
        "FA",
        1,
        "Agachamento, supino e hip thrust",
        [
          ["db-Barbell_Squat", 3, [8, 12], "R", { ...SQUAT, name: "Agachamento livre (ou goblet)" }],
          ["db-Dumbbell_Bench_Press", 3, [8, 12], "T", DB_BENCH],
          ["puxada-aberta", 3, [8, 12], "T"],
          ["elevacao-pelvica", 3, [8, 12], "T"],
          ["flexora-sentada", 2, [10, 15], "F"],
          ["elevacao-lateral-halteres", 2, [12, 20], "F", { up: true }],
        ],
        GLUTE_REST,
      ),
      day(
        "fbg-b",
        "Full B",
        "FB",
        3,
        "Stiff, búlgaro e glúteo médio",
        [
          ["terra-romeno", 3, [8, 12], "R", { name: "Stiff com barra ou halteres" }],
          ["desenvolvimento-halteres", 2, [8, 12], "T"],
          ["remada-baixa-neutra", 3, [10, 12], "T"],
          ["bulgaro-leg-press-alto", 3, [8, 12], "T", { name: "Agachamento búlgaro", perSide: true }],
          ["db-Thigh_Abductor", 2, [15, 20], "F", ABDUCTION],
          ["triceps-overhead-cabo", 2, [10, 15], "F"],
        ],
        GLUTE_REST,
      ),
      day(
        "fbg-c",
        "Full C",
        "FC",
        5,
        "Leg press, remada e extensão de quadril",
        [
          ["leg-press-profundo", 3, [10, 15], "T"],
          ["remada-apoio-peito", 3, [8, 12], "T"],
          ["supino-inclinado-halteres", 2, [8, 12], "T"],
          ["db-One-Legged_Cable_Kickback", 3, [12, 15], "F", HIP_EXT],
          ["cadeira-extensora", 2, [12, 15], "F", { up: true }],
          ["rosca-inclinada", 2, [10, 15], "F"],
        ],
        GLUTE_REST,
      ),
    ],
    now,
  );
}

function upperLowerGlutes(now: number): Program {
  return program(
    "ul-4-gluteo",
    "Upper / Lower 4 dias · pernas e glúteos",
    [
      day(
        "ulg-ua",
        "Upper A",
        "UA",
        1,
        "Peito, costas e ombro",
        [
          ["db-Dumbbell_Bench_Press", 3, [8, 12], "T", DB_BENCH],
          ["puxada-aberta", 3, [8, 12], "T"],
          ["remada-baixa-neutra", 3, [10, 12], "T"],
          ["elevacao-lateral-halteres", 3, [12, 20], "F", { up: true }],
          ["triceps-overhead-cabo", 2, [10, 15], "F"],
          ["db-Barbell_Curl", 2, [10, 15], "F", CURL],
        ],
        GLUTE_REST,
      ),
      day(
        "ulg-la",
        "Lower A",
        "LA",
        2,
        "Ênfase quadríceps",
        [
          ["db-Barbell_Squat", 3, [6, 10], "R", { ...SQUAT, name: "Agachamento livre (ou hack)" }],
          ["leg-press-profundo", 3, [10, 15], "T"],
          ["terra-romeno", 3, [8, 12], "R", { name: "Stiff" }],
          ["cadeira-extensora", 2, [12, 15], "F", { up: true }],
          ["panturrilha-em-pe", 2, [12, 20], "F"],
        ],
        GLUTE_REST,
      ),
      day(
        "ulg-ub",
        "Upper B",
        "UB",
        4,
        "Ombro, costas e braço",
        [
          ["desenvolvimento-halteres", 3, [8, 12], "T"],
          ["db-V-Bar_Pulldown", 3, [6, 10], "T", { ...NEUTRAL_PULLDOWN, name: "Puxada neutra (ou barra fixa assistida)" }],
          ["supino-inclinado-halteres", 2, [8, 12], "T"],
          ["db-One-Arm_Dumbbell_Row", 3, [10, 12], "T", DB_ROW],
          ["face-pull", 2, [12, 20], "F"],
          ["rosca-inclinada", 2, [10, 15], "F", { pairNext: true }],
          ["triceps-corda", 2, [10, 15], "F", { name: "Tríceps pulley" }],
        ],
        GLUTE_REST,
      ),
      day(
        "ulg-lb",
        "Lower B",
        "LB",
        5,
        "Ênfase glúteo e posterior",
        [
          ["elevacao-pelvica", 4, [8, 12], "T", { name: "Hip thrust" }],
          ["bulgaro-leg-press-alto", 3, [8, 12], "T", { name: "Agachamento búlgaro", perSide: true }],
          ["flexora-sentada", 3, [10, 15], "F"],
          ["db-One-Legged_Cable_Kickback", 2, [12, 15], "F", HIP_EXT],
          // O documento pede 3 séries; com 2 o glúteo fica no teto de ~11 séries por sessão que ele mesmo recomenda.
          ["db-Thigh_Abductor", 2, [15, 20], "F", ABDUCTION],
        ],
        GLUTE_REST,
      ),
    ],
    now,
  );
}

function pplGlutes(now: number): Program {
  return program(
    "ppl-6-gluteo",
    "PPL 6 dias · pernas e glúteos",
    [
      day(
        "p6g-push1",
        "Push 1",
        "PS1",
        1,
        "Peito, ombro e tríceps",
        [
          ["db-Dumbbell_Bench_Press", 3, [6, 10], "T", DB_BENCH],
          ["desenvolvimento-halteres", 3, [8, 12], "T"],
          ["elevacao-lateral-halteres", 3, [12, 20], "F", { up: true }],
          ["triceps-overhead-cabo", 2, [10, 15], "F"],
        ],
        GLUTE_REST,
      ),
      day(
        "p6g-pull1",
        "Pull 1",
        "PL1",
        2,
        "Costas e bíceps",
        [
          ["puxada-aberta", 3, [8, 12], "T"],
          ["remada-apoio-peito", 3, [8, 12], "T"],
          ["face-pull", 2, [12, 20], "F"],
          ["rosca-inclinada", 2, [10, 15], "F"],
        ],
        GLUTE_REST,
      ),
      day(
        "p6g-legs1",
        "Legs 1",
        "LG1",
        3,
        "Ênfase quadríceps",
        [
          ["db-Barbell_Squat", 3, [6, 10], "R", { ...SQUAT, name: "Agachamento livre (ou hack)" }],
          ["leg-press-profundo", 3, [10, 15], "T"],
          ["cadeira-extensora", 3, [12, 15], "F", { up: true }],
          ["flexora-sentada", 2, [10, 15], "F"],
          ["panturrilha-em-pe", 3, [12, 20], "F"],
        ],
        GLUTE_REST,
      ),
      day(
        "p6g-push2",
        "Push 2",
        "PS2",
        4,
        "Peito, ombro e tríceps",
        [
          ["supino-inclinado-halteres", 3, [8, 12], "T"],
          ["crucifixo-cabo", 2, [12, 15], "F", { up: true }],
          ["elevacao-lateral-cabo", 3, [12, 20], "F"],
          ["triceps-corda", 2, [12, 15], "F", { name: "Tríceps pulley" }],
        ],
        GLUTE_REST,
      ),
      day(
        "p6g-pull2",
        "Pull 2",
        "PL2",
        5,
        "Costas e braço",
        [
          ["db-V-Bar_Pulldown", 3, [6, 10], "T", { ...NEUTRAL_PULLDOWN, name: "Puxada neutra (ou barra fixa assistida)" }],
          ["remada-baixa-neutra", 3, [10, 12], "T"],
          ["crucifixo-inverso-maquina", 2, [12, 20], "F"],
          ["rosca-martelo-corda", 2, [10, 15], "F", { name: "Rosca martelo" }],
        ],
        GLUTE_REST,
      ),
      day(
        "p6g-legs2",
        "Legs 2",
        "LG2",
        6,
        "Ênfase glúteo e posterior",
        [
          ["elevacao-pelvica", 4, [8, 12], "T", { name: "Hip thrust" }],
          ["terra-romeno", 3, [8, 12], "R", { name: "Stiff" }],
          ["bulgaro-leg-press-alto", 3, [8, 12], "T", { name: "Agachamento búlgaro", perSide: true }],
          ["flexora-sentada", 2, [10, 15], "F"],
          // 2 em vez de 3 séries: respeita o teto de ~11 séries de glúteo por sessão.
          ["db-Thigh_Abductor", 2, [15, 20], "F", ABDUCTION],
        ],
        GLUTE_REST,
      ),
    ],
    now,
  );
}

export type TemplateGroup = "base" | "gluteo";

export interface TemplateInfo {
  id: string;
  name: string;
  /** Uma linha sobre para quem é. */
  pitch: string;
  /** Para quem: nível de experiência sugerido. */
  level: string;
  group: TemplateGroup;
  /** Dias de treino sugeridos (0 = domingo … 6 = sábado). */
  trainingDays: number[];
  make: (now?: number) => Program;
}

export const TEMPLATE_GROUPS: Record<TemplateGroup, { title: string; note: string }> = {
  base: {
    title: "Modelos base",
    note: "Mesmo volume-alvo (~10–16 séries por músculo por semana), cada músculo 2–3× por semana. Com volume igual, as divisões dão o mesmo resultado: escolha pela agenda.",
  },
  gluteo: {
    title: "Ênfase em pernas e glúteos",
    note: "Mesmo volume e esforço dos modelos base, com mais hip thrust, búlgaro e abdução. A ênfase é escolha de objetivo; quem quer mais tronco usa os modelos base.",
  },
};

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "fb-3",
    name: "Fullbody 3 dias",
    level: "Iniciante a intermediário",
    group: "base",
    pitch: "Corpo todo três vezes por semana. Perdoa faltas e cabe numa semana apertada.",
    trainingDays: [1, 3, 5],
    make: (now = Date.now()) => fullBody(now),
  },
  {
    id: "ul-4",
    name: "Upper / Lower 4 dias",
    level: "Intermediário",
    group: "base",
    pitch: "Superior e inferior duas vezes por semana: o melhor equilíbrio entre tempo, volume e recuperação.",
    trainingDays: [1, 2, 4, 5],
    make: (now = Date.now()) => upperLower(now),
  },
  {
    id: "ul-forca",
    name: "Superior / Inferior 4 dias · força + hipertrofia",
    level: "Intermediário a avançado",
    group: "base",
    pitch:
      "Treinos de ~60 min: supino pesado para força e o resto em posição alongada (tríceps acima da cabeça, rosca Scott, flexora sentada). Se o tempo apertar, drop-set na última série dos isoladores.",
    trainingDays: [1, 2, 4, 5],
    make: (now = Date.now()) => upperLowerStrength(now),
  },
  {
    id: "ppl-v2",
    name: "PPL 5 dias",
    level: "Intermediário a avançado",
    group: "base",
    pitch: "Push, Pull e Lower em rotação de 5 dias, com Upper e Lower extras. Mais volume, para quem treina quase todo dia.",
    trainingDays: [1, 2, 3, 4, 5],
    make: (now = Date.now()) => pplProgram(now),
  },
  {
    id: "ppl-6",
    name: "PPL 6 dias",
    level: "Intermediário a avançado",
    group: "base",
    pitch: "Push, Pull e Legs duas vezes: a primeira volta para força (reps baixas), a segunda para hipertrofia. Sessões curtas e focadas.",
    trainingDays: [1, 2, 3, 4, 5, 6],
    make: (now = Date.now()) => ppl6(now),
  },
  {
    id: "fb-3-gluteo",
    name: "Fullbody 3 dias · pernas e glúteos",
    level: "Iniciante a intermediário",
    group: "gluteo",
    pitch: "Corpo todo três vezes por semana, com hip thrust, búlgaro e abdução em todos os ciclos.",
    trainingDays: [1, 3, 5],
    make: (now = Date.now()) => fullBodyGlutes(now),
  },
  {
    id: "ul-4-gluteo",
    name: "Upper / Lower 4 dias · pernas e glúteos",
    level: "Intermediário",
    group: "gluteo",
    pitch: "Lower A focado em quadríceps e Lower B em glúteo e posterior.",
    trainingDays: [1, 2, 4, 5],
    make: (now = Date.now()) => upperLowerGlutes(now),
  },
  {
    id: "ppl-6-gluteo",
    name: "PPL 6 dias · pernas e glúteos",
    level: "Intermediário a avançado",
    group: "gluteo",
    pitch: "Legs 1 para quadríceps e Legs 2 para glúteo e posterior. Variante de 5 dias: Upper / Lower / folga / Push / Pull / Legs.",
    trainingDays: [1, 2, 3, 4, 5, 6],
    make: (now = Date.now()) => pplGlutes(now),
  },
];
