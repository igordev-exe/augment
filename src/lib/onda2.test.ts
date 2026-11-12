import { describe, expect, it } from "vitest";
import type { Session, SessionExercise } from "../data/types";
import { RECORD_BUZZ } from "./hooks";
import { altFirstTimeNote, barWeightIn, platesForBarbell, stepWeight, type ExerciseHistoryItem } from "./progression";

// Onda 2 do plano (docs/melhorias-fable-argon.md): menos toque no meio do treino.

function item(weight: number, alt?: string): ExerciseHistoryItem {
  const entry: SessionExercise = {
    exId: "lower-a.hack",
    unit: "kg",
    alt,
    sets: [{ id: "a", kind: "work", weight, reps: 10, done: true }],
  };
  const session: Session = { id: "s", dayId: "lower-a", date: "2026-11-02", week: 3, startedAt: 0, status: "done", exercises: [entry] };
  return { session, entry };
}

describe("M5: − e + da próxima série", () => {
  it("anda pelo passo do exercício e nunca chega a zero", () => {
    expect(stepWeight(80, 1, 2.5)).toBe(82.5);
    expect(stepWeight(80, -1, 2.5)).toBe(77.5);
    expect(stepWeight(1, -1, 2.5)).toBe(0.5); // nunca negativo nem zero
  });
  it("respeita os pesos da máquina", () => {
    const placas = [12.5, 17.5, 22.5, 27.5];
    expect(stepWeight(17.5, 1, 2.5, placas)).toBe(22.5);
    expect(stepWeight(17.5, -1, 2.5, placas)).toBe(12.5);
  });
});

describe("M7: recorde vibra diferente do fim do descanso", () => {
  it("padrão curto-curto-longo", () => {
    expect(RECORD_BUZZ).toEqual([30, 50, 30, 50, 160]);
  });
});

describe("M8: peso da barra", () => {
  it("20 kg vira 45 lb; outras barras convertem; a conta de anilhas usa a barra escolhida", () => {
    expect(barWeightIn("kg", undefined)).toBe(20);
    expect(barWeightIn("lb", undefined)).toBe(45);
    expect(barWeightIn("kg", 15)).toBe(15);
    expect(barWeightIn("lb", 15)).toBe(33);
    expect(platesForBarbell(55, "kg", 15)).toContain("barra 15kg + [20] / lado");
  });
});

describe("M9: primeira vez numa alternativa", () => {
  it("mostra a carga do titular como referência, só na primeira vez", () => {
    expect(altFirstTimeNote("leg-press", [], [item(80)])).toContain("80 kg");
    expect(altFirstTimeNote("leg-press", [item(60, "leg-press")], [item(80)])).toBeNull();
    expect(altFirstTimeNote("leg-press", [], [])).toBeNull();
    expect(altFirstTimeNote(undefined, [], [item(80)])).toBeNull();
  });
});
