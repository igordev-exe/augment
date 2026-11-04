import { describe, expect, it } from "vitest";
import { LIB_BY_ID } from "../data/library";
import { MUSCLE_ORDER, PROGRAM } from "../data/program";
import { PRINCIPLES, SCIENCE, scienceText, SYNERGISTS } from "../data/science";
import type { Session, SessionExercise } from "../data/types";
import { coachSystem } from "./coach/context";
import { weeklyReport } from "./report";
import { plannedVolume, weeklyVolume } from "./sessions";

function ex(exId: string, n: number, weight = 50, reps = 10): SessionExercise {
  return {
    exId,
    unit: "kg",
    sets: Array.from({ length: n }, (_, i) => ({ id: `${exId}${i}`, kind: "work" as const, weight, reps, done: true })),
  };
}

function session(date: string, dayId: string, exercises: SessionExercise[], week = 3): Session {
  const t = Date.parse(date);
  return { id: `${dayId}-${date}`, date, dayId, week, startedAt: t, finishedAt: t + 1, status: "done", exercises };
}

describe("base científica", () => {
  it("sinergistas apontam para exercícios da biblioteca e para músculos válidos", () => {
    for (const [lib, muscles] of Object.entries(SYNERGISTS)) {
      expect(LIB_BY_ID[lib], lib).toBeDefined();
      for (const m of muscles) expect(MUSCLE_ORDER).toContain(m);
    }
  });

  it("princípios têm id único, texto e fonte", () => {
    const ids = PRINCIPLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PRINCIPLES) {
      expect(p.texto.length).toBeGreaterThan(20);
      expect(p.fontes.length).toBeGreaterThan(0);
    }
  });

  it("volume fracionado: série indireta vale 0,5 e o direto não dobra", () => {
    const s = session("2026-10-21", "push-a", [ex("push-a.supino-incl-halt", 4)]);
    const direct = weeklyVolume([s], "2026-10-21");
    const frac = weeklyVolume([s], "2026-10-21", true);
    expect(direct.peito).toBe(4);
    expect(direct.triceps).toBe(0);
    expect(frac.peito).toBe(4);
    expect(frac.triceps).toBe(4 * SCIENCE.indirectSetWeight);
  });

  it("a ficha deixa cada músculo treinado entre a dose mínima e o teto dos dados (fracionado)", () => {
    const frac = plannedVolume(3, true);
    const direct = plannedVolume(3);
    for (const m of MUSCLE_ORDER) {
      if (!direct[m]) continue;
      expect(frac[m], m).toBeGreaterThanOrEqual(direct[m]);
      expect(frac[m], m).toBeLessThanOrEqual(SCIENCE.volume.upperData);
    }
    // Os grupos grandes ficam pelo menos na dose mínima efetiva.
    for (const m of ["costas", "peito", "quadriceps", "posterior", "biceps", "triceps", "deltLateral"] as const) {
      expect(frac[m], m).toBeGreaterThanOrEqual(SCIENCE.volume.minEffective);
    }
    expect(PROGRAM.length).toBe(5);
  });

  it("semana fechada com pouco volume → aviso de dose mínima; semana em andamento não avisa", () => {
    const s = session("2026-10-19", "push-a", [ex("push-a.supino-incl-halt", 2)]);
    const over = weeklyReport([s], "2026-10-19", "2026-10-05", [1, 2, 3, 4, 5], "2026-10-26");
    expect(over.belowMinimum).toContain("peito");
    expect(over.signals.some((x) => x.includes("dose mínima"))).toBe(true);
    const open = weeklyReport([s], "2026-10-19", "2026-10-05", [1, 2, 3, 4, 5], "2026-10-21");
    expect(open.belowMinimum).toEqual([]);
    const v = over.volume.find((x) => x.muscle === "triceps")!;
    expect(v.fractional).toBe(1);
  });

  it("deload não dispara o aviso de dose mínima", () => {
    const s = session("2026-10-19", "push-a", [ex("push-a.supino-incl-halt", 1)], 7);
    const r = weeklyReport([s], "2026-10-19", "2026-09-07", [1, 2, 3, 4, 5], "2026-10-26");
    expect(r.belowMinimum).toEqual([]);
  });

  it("o prompt do treinador traz a base científica, fixa", () => {
    const sys = coachSystem("Igor");
    expect(sys).toContain(scienceText());
    expect(sys).toContain("Alegações auditadas");
    expect(sys).toContain("Pelland");
    expect(scienceText()).toBe(scienceText());
  });
});
