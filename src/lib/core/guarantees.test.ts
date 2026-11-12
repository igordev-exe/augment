import { describe, expect, it } from "vitest";
import { programDays } from "../../data/program";
import type { BodyEntry, Session, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { addDays } from "../dates";
import { setsFor } from "../mesocycle";
import { historyOf, increaseStep } from "../progression";
import { matchIntent } from "./intents";
import {
  closeFinishedMesos,
  EMPTY_OPERATOR_MEMORY,
  operatorBrief,
  operatorState,
  sanitizeOperatorMemory,
  simulateOperator,
  type Constraint,
  type OperatorMemory,
} from "./operator";
import { explainLoad, planDay, setFloor, trimIsolatesForLowDay } from "./planner";

// Garantias do AUG.CORE: o que o planejador NUNCA faz, sob muitas combinações de restrição e operador.
// Operadores vêm do simulador (sementes fixas), então o teste é determinístico.

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-09-07", trainingDays: [1, 2, 3, 4, 5] };
const TODAY = "2026-10-19";

function memoryWith(constraints: Constraint[]): OperatorMemory {
  return { ...EMPTY_OPERATOR_MEMORY, constraints };
}

const CONSTRAINT_SETS: Constraint[][] = [
  [],
  [{ id: "t", kind: "time-cap", minutes: 30, createdAt: TODAY, expiresAt: TODAY }],
  [{ id: "e", kind: "equipment", allowed: ["halteres", "peso-corporal"], createdAt: TODAY, expiresAt: addDays(TODAY, 2) }],
  [{ id: "p", kind: "pain", muscle: "deltAnterior", severity: "forte", createdAt: TODAY, expiresAt: addDays(TODAY, 5) }],
  [{ id: "p2", kind: "pain", libId: "hack", severity: "leve", createdAt: TODAY, expiresAt: addDays(TODAY, 5) }],
  [{ id: "s", kind: "schedule", reduceVolume: true, note: "Semana de prova", createdAt: TODAY, expiresAt: addDays(TODAY, 6) }],
  [
    { id: "t", kind: "time-cap", minutes: 25, createdAt: TODAY, expiresAt: TODAY },
    { id: "p", kind: "pain", muscle: "quadriceps", severity: "forte", createdAt: TODAY, expiresAt: addDays(TODAY, 5) },
    { id: "e", kind: "equipment", allowed: ["halteres"], createdAt: TODAY, expiresAt: addDays(TODAY, 2) },
  ],
];

describe("AUG.CORE: garantias do planejador", () => {
  const operators = [1, 7, 42].map((seed) =>
    simulateOperator({
      seed,
      weeks: 6,
      startDate: SETTINGS.mesoStart,
      trainingDays: SETTINGS.trainingDays,
      preferredHour: 7,
      trueRestRatio: seed === 7 ? 0.5 : 1,
      trueMuscleRecovery: { quadriceps: 1.3, peito: 0.8 },
      jointPainLibId: seed === 42 ? "hack" : undefined,
    }),
  );

  it("nunca aumenta séries, nunca inventa exercício e nunca muda o programa em memória", () => {
    const before = JSON.stringify(programDays());
    for (const sessions of operators) {
      for (const constraints of CONSTRAINT_SETS) {
        const op = operatorState(sessions, [], SETTINGS, memoryWith(constraints), TODAY);
        for (const day of programDays()) {
          for (const week of [1, 3, 6, 7]) {
            const plan = planDay(day.id, week, SETTINGS, sessions, op);
            for (const ex of day.exercises) {
              const a = plan.exercises[ex.id];
              expect(a).toBeDefined();
              expect(a.originalSets).toBe(setsFor(ex, week, SETTINGS.setAdjust?.[ex.id]));
              expect(a.adaptedSets).toBeLessThanOrEqual(a.originalSets);
              expect(a.adaptedSets).toBeGreaterThanOrEqual(ex.compound ? Math.min(2, a.originalSets) : Math.min(1, a.originalSets));
              if (a.adaptedStop) expect(a.adaptedStop).not.toBe("F");
            }
            expect(Object.keys(plan.exercises).sort()).toEqual(day.exercises.map((e) => e.id).sort());
            expect(plan.estimatedMinutes).toBeLessThanOrEqual(plan.originalMinutes);
          }
        }
      }
    }
    expect(JSON.stringify(programDays())).toBe(before);
  });

  it("sem restrição e sem alerta, não adapta nada", () => {
    const op = operatorState(operators[0], [], SETTINGS, EMPTY_OPERATOR_MEMORY, TODAY);
    for (const day of programDays()) {
      const plan = planDay(day.id, 3, SETTINGS, operators[0], op);
      for (const a of Object.values(plan.exercises)) {
        if (a.adaptedAlt || a.adaptedStop) continue; // só quando o próprio histórico acusou articulação
        expect(a.adaptedSets).toBe(a.originalSets);
      }
    }
  });

  it("restrição expirada não vale e a memória suja é limpa", () => {
    const old: Constraint = { id: "t", kind: "time-cap", minutes: 30, createdAt: "2026-10-01", expiresAt: "2026-10-01" };
    const op = operatorState(operators[0], [], SETTINGS, memoryWith([old]), TODAY);
    expect(op.activeConstraints).toEqual([]);
    const dirty = sanitizeOperatorMemory({ constraints: [old, { id: "x", kind: "time-cap", minutes: 5 }, null], mesoHistory: [{}] });
    expect(dirty.constraints).toEqual([old]);
    expect(dirty.mesoHistory).toEqual([]);
  });

  it("explicação da carga usa a mesma sugestão do motor e tem pelo menos um motivo", () => {
    const sessions = operators[2];
    const op = operatorState(sessions, [], SETTINGS, EMPTY_OPERATOR_MEMORY, TODAY);
    for (const day of programDays()) {
      for (const ex of day.exercises) {
        const hist = historyOf(sessions, ex.id);
        const step = increaseStep(ex, "kg", SETTINGS.increments[ex.id]);
        const trace = explainLoad(ex, hist, setsFor(ex, 3), 3, step, undefined, op);
        expect(trace.factors.length).toBeGreaterThan(0);
        expect(trace.factors[0].tag).toBe("historico");
        expect(trace.summary.length).toBeGreaterThan(5);
        expect(trace.confidence).toBeGreaterThan(0);
        expect(trace.confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("AUG.CORE: o núcleo fala só quando precisa", () => {
  it("fica em silêncio com tudo normal e fala com restrição, calibração ou peso caindo rápido", () => {
    const sessions = simulateOperator({
      seed: 3,
      weeks: 6,
      startDate: SETTINGS.mesoStart,
      trainingDays: SETTINGS.trainingDays,
      preferredHour: 18,
      trueRestRatio: 1,
      trueMuscleRecovery: {},
    });
    const calm = operatorBrief(operatorState(sessions, [], SETTINGS, EMPTY_OPERATOR_MEMORY, TODAY));
    expect(calm.silent).toBe(true);
    expect(calm.headline).not.toMatch(/gêmeo|calibra|telemetria|biomec/i);

    const fresh = operatorBrief(operatorState(sessions.slice(0, 2), [], SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-09-10"));
    expect(fresh.silent).toBe(false);
    expect(fresh.headline).toContain("conhecendo");

    const c: Constraint = { id: "t", kind: "time-cap", minutes: 40, createdAt: TODAY, expiresAt: TODAY };
    const busy = operatorBrief(operatorState(sessions, [], SETTINGS, memoryWith([c]), TODAY));
    expect(busy.silent).toBe(false);
    expect(busy.headline).toContain("40 min");

    // 3 semanas perdendo 1 kg por semana.
    const log: BodyEntry[] = [0, 7, 14, 21].map((d) => ({ id: `b${d}`, date: addDays("2026-09-28", d), weightKg: 80 - d / 7 }));
    const state = operatorState(sessions, log, SETTINGS, EMPTY_OPERATOR_MEMORY, TODAY);
    expect(state.body.rapidLoss).toBe(true);
    expect(state.body.kgPerWeek).toBeLessThan(-0.7);
    const losing = operatorBrief(state);
    expect(losing.silent).toBe(false);
    expect(losing.headline).toContain("Peso caindo");
    const compound = programDays()[0].exercises.find((e) => e.compound)!;
    const hist = historyOf(sessions, compound.id);
    const trace = explainLoad(compound, hist, 3, 3, 2.5, undefined, state);
    if (trace.suggestion.kind === "up") expect(trace.factors.some((f) => f.tag === "corpo")).toBe(true);
  });
});

describe("AUG.CORE: fechamento de mesociclo", () => {
  const sessions = simulateOperator({
    seed: 11,
    weeks: 7,
    startDate: "2026-09-07",
    trainingDays: [1, 2, 3, 4, 5],
    preferredHour: 7,
    trueRestRatio: 1,
    trueMuscleRecovery: {},
  });

  it("não fecha antes do fim, fecha uma vez depois das 7 semanas e resume o ciclo", () => {
    expect(closeFinishedMesos({ ...EMPTY_OPERATOR_MEMORY, lastMesoStart: "2026-09-07" }, sessions, SETTINGS, "2026-10-20")).toBeNull();
    const first = closeFinishedMesos(EMPTY_OPERATOR_MEMORY, sessions, SETTINGS, "2026-10-20");
    expect(first?.lastMesoStart).toBe("2026-09-07");
    expect(first?.mesoHistory).toEqual([]);

    const closed = closeFinishedMesos(first!, sessions, SETTINGS, "2026-10-26")!;
    expect(closed.mesoHistory).toHaveLength(1);
    const m = closed.mesoHistory[0];
    expect(m.start).toBe("2026-09-07");
    expect(m.end).toBe("2026-10-25");
    expect(m.sessionsPlanned).toBe(35);
    expect(m.sessionsDone).toBeGreaterThan(20);
    expect(m.avgWeeklySets).toBeGreaterThan(10);
    expect(m.bestMuscles.length).toBeGreaterThan(0);
    expect(closeFinishedMesos(closed, sessions, SETTINGS, "2026-11-30")).toBeNull();
  });

  it("reiniciar o ciclo no meio fecha o anterior até a véspera", () => {
    const mem = { ...EMPTY_OPERATOR_MEMORY, lastMesoStart: "2026-09-07" };
    const restarted = closeFinishedMesos(mem, sessions, { ...SETTINGS, mesoStart: "2026-10-05" }, "2026-10-05")!;
    expect(restarted.lastMesoStart).toBe("2026-10-05");
    expect(restarted.mesoHistory).toHaveLength(1);
    expect(restarted.mesoHistory[0]).toMatchObject({ start: "2026-09-07", end: "2026-10-04" });
    expect(sanitizeOperatorMemory(restarted)).toEqual(restarted);
  });
});

describe("AUG.CORE: intenções não disparam por engano", () => {
  it("negar dor não vira queixa, e frases soltas vão para o treinador", () => {
    expect(matchIntent("treinei sem dor nenhuma no ombro hoje")).toBeNull();
    expect(matchIntent("o joelho não doeu dessa vez")).toBeNull();
    expect(matchIntent("meu ombro está doendo no supino")?.kind).toBe("dor_articular");
    expect(matchIntent("descansei 90 min entre o almoço e o treino")).toBeNull();
    expect(matchIntent("por que treinar 5 dias?")).toBeNull();
    expect(matchIntent("qual a melhor hora para treinar?")).toBeNull();
  });
});

describe("check-in de baixa: tirar 1 série dos isolados (M6)", () => {
  const defs = new Map(programDays().flatMap((d) => d.exercises.map((e) => [e.id, e] as const)));
  const defOf = (e: { exId: string }) => defs.get(e.exId);

  it("nunca fica abaixo do piso e nunca tira série já feita, com qualquer número de séries e de séries feitas", () => {
    for (const day of programDays()) {
      for (let total = 1; total <= 5; total++) {
        for (let doneCount = 0; doneCount <= total; doneCount++) {
          const session: Session = {
            id: "s",
            dayId: day.id,
            date: TODAY,
            week: 3,
            startedAt: 0,
            status: "active",
            exercises: day.exercises.map((ex) => ({
              exId: ex.id,
              unit: "kg",
              sets: Array.from({ length: total }, (_, i) => ({
                id: `${ex.id}-${i}`,
                kind: "work" as const,
                weight: 50,
                reps: 10,
                done: i < doneCount,
              })),
            })),
          };
          const { session: out, removed } = trimIsolatesForLowDay(session, defOf);
          let expected = 0;
          for (const [i, e] of out.exercises.entries()) {
            const def = defOf(e)!;
            const before = session.exercises[i];
            const work = e.sets.filter((s) => s.kind === "work");
            // Feitas continuam todas.
            expect(work.filter((s) => s.done).length).toBe(before.sets.filter((s) => s.done).length);
            // Composto não muda; isolado nunca abaixo de 1.
            if (def.compound) expect(work.length).toBe(before.sets.length);
            else {
              expect(work.length).toBeGreaterThanOrEqual(Math.min(setFloor(def), before.sets.length));
              expect(before.sets.length - work.length).toBeLessThanOrEqual(1);
              expected += before.sets.length - work.length;
            }
          }
          expect(removed).toBe(expected);
          // O programa não muda: só a sessão aberta.
          expect(defs.get(day.exercises[0].id)).toBe(day.exercises[0]);
        }
      }
    }
  });
});
