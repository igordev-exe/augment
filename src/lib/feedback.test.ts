import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { EXTENDED } from "../data/library-extended";
import { exOf, MUSCLE_LABEL, MUSCLE_ORDER } from "../data/program";
import { pplProgram } from "../data/templates/ppl";
import type { Session } from "../data/types";
import { coachSystem } from "./coach/context";
import { coachHandoffText } from "./coach/handoff";
import { DEFAULT_SETTINGS } from "./db";
import { exerciseFromLibrary } from "./program-edit";
import { historyOf } from "./progression";
import { newSet, snapOf } from "./sessions";

// Achados dos testes com usuários (nov/2026): antebraço, exercício extra no treino e treinador sem chave.

describe("antebraço", () => {
  it("é um músculo do app, com nome, e a biblioteca completa tem exercícios para ele", () => {
    expect(MUSCLE_ORDER).toContain("antebraco");
    expect(MUSCLE_LABEL.antebraco).toBe("Antebraço");
    const wrist = EXTENDED.find((e) => e.muscles.includes("antebraco") && /Wrist Curl/.test(e.name));
    expect(wrist).toBeTruthy();
    expect(exerciseFromLibrary(wrist!.id, "d1", new Set()).muscles).toEqual(["antebraco"]);
  });
});

describe("exercício extra no treino", () => {
  it("leva o próprio retrato e herda o histórico do mesmo exercício da biblioteca", () => {
    const supino = pplProgram(1).days[0].exercises[0];
    const extra = exerciseFromLibrary(supino.lib, "push-a", new Set(pplProgram(1).days[0].exercises.map((e) => e.id)));
    expect(extra.id).not.toBe(supino.id);
    const entry = { exId: extra.id, snap: snapOf(extra), unit: "kg" as const, sets: [newSet("work", null)], extra: true };
    expect(exOf(entry)?.lib).toBe(supino.lib);
    const before: Session = {
      id: "a",
      dayId: "push-a",
      date: "2026-11-02",
      week: 2,
      startedAt: 1,
      finishedAt: 2,
      status: "done",
      exercises: [
        { exId: supino.id, snap: snapOf(supino), unit: "kg", sets: [{ id: "s", kind: "work", weight: 30, reps: 10, done: true }] },
      ],
    };
    expect(historyOf([before], extra.id, undefined, extra.lib).map((h) => h.session.id)).toEqual(["a"]);
  });
});

describe("treinador sem chave (Claude / Gemini)", () => {
  it("o documento traz as instruções do treinador e os dados, mesmo sem treinos", () => {
    const data = { sessions: [], settings: DEFAULT_SETTINGS, today: "2026-11-09", bodyLog: [] };
    const doc = coachHandoffText(data);
    expect(doc).toContain(coachSystem(DEFAULT_SETTINGS.operator));
    expect(doc).toContain("## Plano atual");
    expect(doc).toContain("## Treinos dos últimos 28 dias");
    expect(doc).toContain("não tem as ferramentas do app");
    expect(doc).not.toContain("## Peso e medidas");
    const withBody = coachHandoffText({ ...data, bodyLog: [{ id: "b", date: "2026-11-08", weightKg: 80 }] });
    expect(withBody).toContain("## Peso e medidas");
  });
});
