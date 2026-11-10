import { describe, expect, it } from "vitest";
import { dayById } from "../../data/program";
import type { Session, SessionExercise, SetEntry, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { historyOf } from "../progression";
import {
  activeConstraints,
  effectiveRecoveryHours,
  EMPTY_OPERATOR_MEMORY,
  learnedRecoveryMultipliers,
  mergeOperatorMemory,
  operatorBrief,
  operatorState,
  predictFirstSetReps,
  sanitizeOperatorMemory,
  simulateOperator,
  type OperatorMemory,
} from "./operator";

function makeSet(weight: number, reps: number, doneAt?: number): SetEntry {
  return {
    id: `s-${Math.random()}`,
    kind: "work",
    weight,
    reps,
    done: true,
    ...(doneAt != null ? { doneAt } : {}),
  };
}

function makeSession(opts: {
  id: string;
  dayId: string;
  date: string;
  week?: number;
  hour?: number;
  sleep?: "ok" | "ruim";
  exercises: SessionExercise[];
}): Session {
  const hour = opts.hour ?? 18;
  const startedAt = new Date(`${opts.date}T${String(hour).padStart(2, "0")}:00:00`).getTime();
  const finishedAt = startedAt + 60 * 60_000;
  return {
    id: opts.id,
    dayId: opts.dayId,
    date: opts.date,
    week: opts.week ?? 2,
    startedAt,
    finishedAt,
    status: "done",
    checkin: opts.sleep ? { sleep: opts.sleep, energy: opts.sleep === "ruim" ? "baixa" : "ok", pain: "nenhuma" } : undefined,
    exercises: opts.exercises,
  };
}

const BASE_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  mesoStart: "2026-09-07",
  trainingDays: [1, 2, 3, 4, 5],
};

describe("AUG.CORE — Modelo do Operador (operator.ts)", () => {
  it("Operador A: calibra do zero, aprende recuperação rápida em peito e alta resposta no supino", () => {
    const dates = ["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-13", "2026-09-15", "2026-09-17"];
    const weights = [24, 26, 28, 30, 32, 34];
    const sessions: Session[] = dates.map((date, idx) =>
      makeSession({
        id: `a-${idx}`,
        dayId: "push-a",
        date,
        week: 2,
        exercises: [
          {
            exId: "push-a.supino-incl-halt",
            unit: "kg",
            sets: Array.from({ length: 5 }, () => makeSet(weights[idx], 10)),
            feedback: { pump: "forte", volume: "leve", joint: "ok" },
          },
        ],
      }),
    );

    const early = operatorState(sessions.slice(0, 2), [], BASE_SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-09-10");
    expect(early.calibration.stage).toBe("calibrando");
    expect(early.muscles.peito.confidence).toBeLessThan(0.5);
    expect(effectiveRecoveryHours(5, early.muscles.peito)).toBe(48);
    expect(operatorBrief(early).code).toBe("AUG.CORE // CALIBRAÇÃO");

    const full = operatorState(sessions, [], BASE_SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-09-18");
    expect(full.calibration.stage).toBe("aprendendo");
    expect(full.muscles.peito.observations).toBe(5);
    expect(full.muscles.peito.confidence).toBeGreaterThanOrEqual(0.5);
    expect(full.muscles.peito.recoveryMultiplier).toBeLessThan(0.95);
    expect(effectiveRecoveryHours(5, full.muscles.peito)).toBeLessThan(48);
    expect(full.muscles.peito.volumeTolerance).toBe(22);

    const learned = learnedRecoveryMultipliers(full);
    expect(learned.peito).toBeDefined();

    const supino = full.exercises["supino-inclinado-halteres"];
    expect(supino).toBeDefined();
    expect(supino.responsiveness).toBe("alta");
    expect(supino.e1rmSlopePct).toBeGreaterThan(0.02);
  });

  it("Operador B: detecta recuperação lenta em quadríceps (descontando sono ruim e subida de carga), risco articular por libId e descanso apressado", () => {
    const legDates = ["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-13", "2026-09-15", "2026-09-17"];
    const sessions: Session[] = legDates.map((date, idx) => {
      const baseTime = new Date(`${date}T19:00:00`).getTime();
      const sets: SetEntry[] = [
        makeSet(100, idx === 0 ? 8 : 5, baseTime + 1_000),
        makeSet(100, 5, baseTime + 36_000),
        makeSet(100, 4, baseTime + 71_000),
        makeSet(100, 4, baseTime + 106_000),
      ];
      return makeSession({
        id: `b-${idx}`,
        dayId: "lower-a",
        date,
        sleep: "ok",
        exercises: [
          {
            exId: "lower-a.hack",
            unit: "kg",
            sets,
            feedback: { pump: "bom", volume: "pesado", joint: "ok" },
          },
          {
            exId: idx % 2 === 0 ? "push-a.triceps-testa" : "push-b.triceps-frances",
            snap: {
              id: "custom.testa",
              lib: "triceps-testa-halteres",
              name: "Tríceps testa com halteres",
              muscleLabel: "Tríceps",
              muscles: ["triceps"],
              sets: 3,
              reps: [8, 12],
              rest: [60, 90],
              restLabel: "60–90 s",
              stop: "F",
              compound: false,
              increment: 2,
              cues: [],
            },
            unit: "kg",
            sets: [makeSet(14, 10), makeSet(14, 10)],
            feedback: { pump: "bom", volume: "ok", joint: idx >= 2 ? "incomodou" : "ok" },
          },
        ],
      });
    });

    const state = operatorState(sessions, [], BASE_SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-09-18");
    expect(state.muscles.quadriceps.confidence).toBeGreaterThanOrEqual(0.5);
    expect(state.muscles.quadriceps.recoveryMultiplier).toBeGreaterThan(1.1);
    expect(effectiveRecoveryHours(4, state.muscles.quadriceps)).toBeGreaterThan(48);
    // SCIENCE.volume.efficient[1] = 20; com sinais lentos repetidos cai exatamente 2 séries (18)
    expect(state.muscles.quadriceps.volumeTolerance).toBe(18);

    const testa = state.exercises["triceps-testa-halteres"];
    expect(testa).toBeDefined();
    expect(testa.jointComplaints).toBe(4);
    expect(testa.jointRisk).toBeGreaterThanOrEqual(0.5);
    expect(testa.responsiveness).toBe("desgastante");

    expect(state.behavior.restConfidence).toBeGreaterThanOrEqual(0.5);
    expect(state.behavior.restRatio).toBeLessThan(0.5);

    // Se todas as sessões ruins tivessem sido em noite de sono ruim, o gêmeo NÃO culpa a curva muscular
    const badSleepSessions = sessions.map((s) => ({
      ...s,
      checkin: { sleep: "ruim" as const, energy: "baixa" as const, pain: "nenhuma" as const },
    }));
    const sleepState = operatorState(badSleepSessions, [], BASE_SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-09-18");
    expect(sleepState.muscles.quadriceps.recoveryMultiplier).toBe(1);

    // Se a queda de reps abaixo do piso aconteceu porque SUBIU A CARGA (+10 kg) com feedback "ok",
    // o gêmeo NÃO confunde progressão de carga com falha de recuperação muscular
    const progSessions = legDates.map((date, idx) =>
      makeSession({
        id: `prog-${idx}`,
        dayId: "lower-a",
        date,
        sleep: "ok",
        exercises: [
          {
            exId: "lower-a.hack",
            unit: "kg",
            sets: [makeSet(100 + idx * 10, idx === 0 ? 10 : 5), makeSet(100 + idx * 10, 5)],
            feedback: { pump: "bom", volume: "ok", joint: "ok" },
          },
        ],
      }),
    );
    const progState = operatorState(progSessions, [], BASE_SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-09-18");
    expect(progState.muscles.quadriceps.recoveryMultiplier).toBe(1);
  });

  it("Operador C: identifica falta recorrente na sexta-feira, horário preferido e filtra restrições expiradas", () => {
    const weeks = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];
    const sessions: Session[] = [];
    weeks.forEach((monday, wIdx) => {
      [0, 1, 2, 3].forEach((offset) => {
        const d = new Date(`${monday}T12:00:00`);
        d.setDate(d.getDate() + offset);
        const iso = d.toISOString().slice(0, 10);
        sessions.push(
          makeSession({
            id: `c-${wIdx}-${offset}`,
            dayId: "push-a",
            date: iso,
            hour: 7,
            exercises: [
              {
                exId: "push-a.supino-incl-halt",
                unit: "kg",
                sets: [makeSet(20, 10), makeSet(20, 10)],
              },
            ],
          }),
        );
      });
    });

    const memory: OperatorMemory = sanitizeOperatorMemory({
      version: 1,
      calibrationUntil: "2026-09-14",
      constraints: [
        {
          id: "c-active",
          kind: "time-cap",
          minutes: 40,
          createdAt: "2026-10-05",
          expiresAt: "2026-10-05",
        },
        {
          id: "c-expired",
          kind: "equipment",
          allowed: ["halteres"],
          createdAt: "2026-09-10",
          expiresAt: "2026-09-12",
        },
      ],
      mesoHistory: [],
    });

    const state = operatorState(sessions, [], BASE_SETTINGS, memory, "2026-10-05");
    expect(state.calibration.stage).toBe("calibrado");
    expect(state.behavior.preferredHour).toBe(7);
    expect(state.behavior.weekdayMissRate[5]).toBe(1);
    expect(state.behavior.vulnerableWeekday).toBe(5);
    expect(state.behavior.adherenceRate).toBe(0.8);

    expect(activeConstraints(memory, "2026-10-05")).toHaveLength(1);
    expect(operatorBrief(state).code).toBe("AUG.CORE // MODO RÁPIDO");

    const nextDayState = operatorState(sessions, [], BASE_SETTINGS, memory, "2026-10-06");
    expect(operatorBrief(nextDayState).code).toBe("AUG.CORE // AGENDA");
    expect(operatorBrief(nextDayState).headline).toContain("sexta");

    const merged = mergeOperatorMemory(
      memory,
      sanitizeOperatorMemory({
        version: 1,
        constraints: [
          {
            id: "c-pain",
            kind: "pain",
            muscle: "deltAnterior",
            severity: "leve",
            createdAt: "2026-10-06",
            expiresAt: "2026-10-10",
          },
        ],
        mesoHistory: [],
      }),
    );
    expect(merged.constraints).toHaveLength(3);
  });

  it("Simulador (parameter recovery): reencontra parâmetros escondidos em 6 semanas com ruído e prevê reps da 1ª série", () => {
    const simulated = simulateOperator({
      seed: 42,
      weeks: 6,
      startDate: "2026-09-07",
      trainingDays: [1, 2, 3, 4, 5],
      preferredHour: 7,
      missWeekday: 5,
      trueRestRatio: 0.5,
      trueMuscleRecovery: {
        peito: 0.8,
        quadriceps: 1.3,
      },
      jointPainLibId: "hack",
    });

    const recovered = operatorState(simulated, [], BASE_SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-10-19");
    expect(recovered.calibration.stage).toBe("calibrado");
    expect(recovered.muscles.peito.recoveryMultiplier).toBeLessThan(0.95);
    expect(recovered.muscles.quadriceps.recoveryMultiplier).toBeGreaterThan(1.1);
    expect(recovered.behavior.preferredHour).toBe(7);
    expect(recovered.behavior.vulnerableWeekday).toBe(5);
    expect(recovered.behavior.restRatio).toBeLessThan(0.65);
    expect(recovered.exercises.hack.jointRisk).toBeGreaterThanOrEqual(0.5);

    const supino = dayById("push-a").exercises[0];
    const hist = historyOf(simulated, supino.id);
    const pred = predictFirstSetReps(supino, 32, hist, recovered, 72);
    expect(pred).not.toBeNull();
    expect(pred!.predictedReps).toBeGreaterThanOrEqual(6);
    expect(pred!.confidence).toBeGreaterThanOrEqual(0.75);
  });
});
