import { describe, expect, it } from "vitest";
import { dayById } from "../../data/program";
import type { Session, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { historyOf } from "../progression";
import { buildSession } from "../sessions";
import { EMPTY_OPERATOR_MEMORY, operatorState, sanitizeOperatorMemory } from "./operator";
import { explainLoad, inferEquipment, planDay } from "./planner";

const BASE_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  mesoStart: "2026-09-07",
  trainingDays: [1, 2, 3, 4, 5],
};

describe("AUG.CORE — Planejador Determinístico e Explicabilidade (planner.ts)", () => {
  it("explainLoad gera DecisionTrace completo explicando subida de carga, descanso curto e sensibilidade articular", () => {
    const pushDay = dayById("push-a");
    const supino = pushDay.exercises[0]; // push-a.supino-incl-halt (4x6-10)
    const dates = ["2026-09-07", "2026-09-10", "2026-09-14"];
    const sessions: Session[] = dates.map((date, idx) => {
      const t0 = new Date(`${date}T18:00:00`).getTime();
      return {
        id: `s-${idx}`,
        dayId: "push-a",
        date,
        week: 2,
        startedAt: t0,
        finishedAt: t0 + 50 * 60_000,
        status: "done",
        exercises: [
          {
            exId: supino.id,
            unit: "kg",
            sets: [
              { id: "1", kind: "work", weight: 30, reps: 10, done: true, doneAt: t0 + 1_000 },
              { id: "2", kind: "work", weight: 30, reps: 10, done: true, doneAt: t0 + 41_000 },
              { id: "3", kind: "work", weight: 30, reps: 10, done: true, doneAt: t0 + 81_000 },
              { id: "4", kind: "work", weight: 30, reps: 10, done: true, doneAt: t0 + 121_000 },
            ],
            feedback: { pump: "forte", volume: "ok", joint: idx >= 1 ? "incomodou" : "ok" },
          },
        ],
      };
    });

    const op = operatorState(sessions, [], BASE_SETTINGS, EMPTY_OPERATOR_MEMORY, "2026-09-16");
    const hist = historyOf(sessions, supino.id);
    const trace = explainLoad(supino, hist, 4, 2, 2, undefined, op);

    expect(trace.suggestion.kind).toBe("up");
    expect(trace.suggestion.weight).toBe(32);
    expect(trace.factors.some((f) => f.tag === "historico")).toBe(true);
    expect(trace.factors.some((f) => f.tag === "dupla-progressao")).toBe(true);
    expect(trace.factors.some((f) => f.tag === "articular")).toBe(true);
    expect(trace.factors.some((f) => f.tag === "descanso")).toBe(true);
    expect(trace.recommendedAlt).toBeDefined();
  });

  it("planDay adapta treino para teto de 40 min enxugando isolados primeiro e preservando compostos", () => {
    const memory = sanitizeOperatorMemory({
      version: 1,
      constraints: [
        {
          id: "tc-1",
          kind: "time-cap",
          minutes: 40,
          createdAt: "2026-09-15",
          expiresAt: "2026-09-15",
        },
      ],
      mesoHistory: [],
    });
    const op = operatorState([], [], BASE_SETTINGS, memory, "2026-09-15");
    const plan = planDay("push-a", 3, BASE_SETTINGS, [], op);

    expect(plan.adapted).toBe(true);
    expect(plan.estimatedMinutes).toBeLessThan(plan.originalMinutes);
    expect(plan.reasons.some((r) => r.includes("Modo 40 min"))).toBe(true);

    // Nenhum exercício do dia é zerado e o composto principal mantém pelo menos 2 séries
    const pushDay = dayById("push-a");
    for (const ex of pushDay.exercises) {
      expect(plan.exercises[ex.id].adaptedSets).toBeGreaterThanOrEqual(ex.compound ? 2 : 1);
    }
  });

  it("planDay troca automaticamente exercícios de máquina/cabo quando a pessoa só tem halteres e protege articulação com dor", () => {
    expect(inferEquipment("Supino inclinado com halteres")).toBe("halteres");
    expect(inferEquipment("Crucifixo no cabo")).toBe("cabo");
    expect(inferEquipment("Supino reto na máquina / Hammer")).toBe("maquina");

    const memory = sanitizeOperatorMemory({
      version: 1,
      constraints: [
        {
          id: "eq-1",
          kind: "equipment",
          allowed: ["halteres", "peso-corporal"],
          createdAt: "2026-09-15",
          expiresAt: "2026-09-20",
        },
        {
          id: "pain-1",
          kind: "pain",
          muscle: "deltAnterior",
          severity: "forte",
          createdAt: "2026-09-15",
          expiresAt: "2026-09-18",
        },
      ],
      mesoHistory: [],
    });
    const op = operatorState([], [], BASE_SETTINGS, memory, "2026-09-15");
    const plan = planDay("push-a", 3, BASE_SETTINGS, [], op);

    expect(plan.adapted).toBe(true);
    // Exercícios de máquina/polia no Push A ganham alternativa compatível com halteres/peso corporal
    const machineOrCableAdapted = Object.values(plan.exercises).filter((e) => e.adaptedAlt != null);
    expect(machineOrCableAdapted.length).toBeGreaterThan(0);

    // Exercício de ombro anterior sofre redução de série por dor forte e para antes da falha
    const pushDay = dayById("push-a");
    const shoulderEx = pushDay.exercises.find((e) => e.muscles.includes("deltAnterior"))!;
    expect(plan.exercises[shoulderEx.id].adaptedSets).toBeLessThan(plan.exercises[shoulderEx.id].originalSets);

    // Quando um exercício isolado com stop="F" sofre proteção articular, buildSession aplica stop="T" no retrato da sessão
    const isoShoulder = pushDay.exercises.find((e) => e.stop === "F" && e.muscles.includes("deltAnterior"));
    if (isoShoulder) {
      expect(plan.exercises[isoShoulder.id].adaptedStop).toBe("T");
      const built = buildSession("push-a", "2026-09-15", 3, BASE_SETTINGS, [], undefined, plan);
      const entry = built.exercises.find((e) => e.exId === isoShoulder.id)!;
      expect(entry.snap?.stop).toBe("T");
    }
  });
});
