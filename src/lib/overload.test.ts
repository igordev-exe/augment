import { describe, expect, it } from "vitest";
import { exById } from "../data/program";
import type { Session, SessionExercise } from "../data/types";
import { loadBasis, overloadOptions } from "./progression";
import { fatigueColor, fatiguePct, feedbackFactor, muscleStatus, noteFactor, setEffort } from "./visual";

const hack = exById("lower-a.hack"); // 8–12 (composto)

function entry(sets: [number, number, number?][], extra: Partial<SessionExercise> = {}): SessionExercise {
  return {
    exId: "lower-a.hack",
    unit: "kg",
    sets: sets.map(([w, r, rir], i) => ({ id: `${i}`, kind: "work", weight: w, reps: r, rir, done: true })),
    ...extra,
  };
}

describe("sobrecarga progressiva sugerida", () => {
  it("oferece +1 rep na mesma carga e a próxima carga com reps previstas", () => {
    const opts = overloadOptions(
      hack,
      entry([
        [100, 10],
        [100, 10],
        [100, 9],
      ]),
      3,
      2.5,
    );
    expect(opts[0]).toEqual({ weight: 100, reps: 11, via: "reps" });
    expect(opts[1].via).toBe("carga");
    expect(opts[1].weight).toBe(102.5);
    expect(opts[1].reps).toBeGreaterThanOrEqual(8);
    expect(opts[1].reps).toBeLessThanOrEqual(10);
  });
  it("nada na 1ª vez, no deload ou abaixo da faixa", () => {
    expect(overloadOptions(hack, undefined, 3, 2.5)).toEqual([]);
    expect(overloadOptions(hack, entry([[100, 10]]), 7, 2.5)).toEqual([]);
    expect(overloadOptions(hack, entry([[100, 5]]), 3, 2.5)).toEqual([]);
  });
  it("diz o que o peso significa", () => {
    expect(loadBasis("Rosca alternada com halter", undefined)).toBe("cada halter");
    expect(loadBasis("Supino reto", "Barra")).toBe("total, com a barra");
    expect(loadBasis("Remada unilateral com halter", undefined, true)).toBe("um halter, por lado");
    expect(loadBasis("Tríceps na polia", "Polia")).toBe("na pilha do cabo");
  });
});

describe("fadiga pela intensidade real", () => {
  const at = (e: SessionExercise, notes?: string): Session => ({
    id: "s",
    date: "2026-11-02",
    dayId: "lower-a",
    week: 3,
    startedAt: Date.parse("2026-11-02T18:00:00"),
    finishedAt: Date.parse("2026-11-02T19:00:00"),
    status: "done",
    notes,
    exercises: [e],
  });
  const now = Date.parse("2026-11-02T23:00:00");
  const base = entry([
    [100, 8],
    [100, 8],
    [100, 8],
    [100, 8],
  ]);
  const easy = entry(
    [
      [100, 8, 4],
      [100, 8, 4],
      [100, 8, 4],
      [100, 8, 4],
    ],
    { feedback: { pump: "fraco", volume: "leve" } },
  );
  const hard = entry(
    [
      [100, 8, 0],
      [100, 8, 0],
      [100, 8, 0],
      [100, 8, 0],
    ],
    { feedback: { pump: "forte", volume: "pesado" } },
  );

  it("treino leve começa com menos fadiga e recupera antes; treino duro demora mais", () => {
    const n = muscleStatus([at(base)], 3, "2026-11-02", now).quadriceps;
    const e = muscleStatus([at(easy)], 3, "2026-11-02", now).quadriceps;
    const h = muscleStatus([at(hard)], 3, "2026-11-02", now).quadriceps;
    expect(fatiguePct(e)).toBeLessThan(fatiguePct(n));
    expect(e.neededHours).toBeLessThan(n.neededHours);
    expect(h.neededHours).toBeGreaterThan(n.neededHours);
    expect(fatiguePct(h)).toBeGreaterThanOrEqual(fatiguePct(n));
  });
  it("nota de treino ruim baixa a intensidade", () => {
    const n = muscleStatus([at(base)], 3, "2026-11-02", now).quadriceps;
    const bad = muscleStatus([at(base, "Treino ruim, dormi mal")], 3, "2026-11-02", now).quadriceps;
    expect(bad.intensity).toBeLessThan(n.intensity);
  });
  it("fatores e cor", () => {
    expect(setEffort({ id: "a", kind: "work", weight: 1, reps: 1, done: true })).toBe(1);
    expect(setEffort({ id: "a", kind: "work", weight: 1, reps: 1, done: true, failure: true })).toBeGreaterThan(1);
    expect(feedbackFactor({ pump: "fraco" })).toBeLessThan(1);
    expect(noteFactor("treino pesado hoje")).toBeGreaterThan(1);
    expect(noteFactor("nada demais")).toBe(1);
    expect(fatigueColor(0)).toContain("var(--cyan)");
    expect(fatigueColor(100)).toContain("var(--red) 100%");
  });
});
