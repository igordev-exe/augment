import { describe, expect, it } from "vitest";
import { EXERCISE_BY_ID, PROGRAM } from "../data/program";
import type { Session, SessionExercise } from "../data/types";
import { setsFor, stopFor, weekFor } from "./mesocycle";
import { backoffWeight, e1rm, historyOf, prsInSession, recordsOf, suggest } from "./progression";
import { planAhead } from "./schedule";
import { plannedVolume } from "./sessions";

const hack = EXERCISE_BY_ID["lower-a.hack"];
const extensora = EXERCISE_BY_ID["lower-a.extensora"];

function entry(exId: string, sets: [number, number][], kinds?: ("work" | "drop")[]): SessionExercise {
  return {
    exId,
    unit: "kg",
    sets: sets.map(([w, r], i) => ({ id: `${i}`, kind: kinds?.[i] ?? "work", weight: w, reps: r, done: true })),
  };
}

function session(id: string, date: string, dayId: string, exercises: SessionExercise[]): Session {
  return { id, date, dayId, week: 3, startedAt: Date.parse(date), finishedAt: Date.parse(date) + 1, status: "done", exercises };
}

describe("mesociclo", () => {
  it("calcula a semana e repete depois do deload", () => {
    expect(weekFor("2026-09-21", "2026-09-21")).toBe(1);
    expect(weekFor("2026-09-21", "2026-10-09")).toBe(3);
    expect(weekFor("2026-09-21", "2026-11-02")).toBe(7);
    expect(weekFor("2026-09-21", "2026-11-09")).toBe(1);
  });

  it("ajusta séries por semana", () => {
    expect(setsFor(extensora, 1)).toBe(2); // isolado −1
    expect(setsFor(extensora, 3)).toBe(3);
    const crucifixo = EXERCISE_BY_ID["push-a.crucifixo-cabo"];
    expect(setsFor(crucifixo, 4)).toBe(4); // ▲
    expect(setsFor(hack, 7)).toBe(2); // deload: metade
  });

  it("até onde ir muda com a semana", () => {
    expect(stopFor("F", 1).label).toBe("Sobra 1–2");
    expect(stopFor("F", 4).label).toBe("Falha");
    expect(stopFor("T", 5).label).toBe("Falha técnica");
    expect(stopFor("R", 5).label).toBe("Sobra 2");
    expect(stopFor("F", 7).label).toBe("Sobra 4");
  });

  it("volume planejado bate com a tabela da ficha", () => {
    const v = plannedVolume(3);
    expect(v.costas).toBe(17);
    expect(v.peito).toBe(13);
    expect(v.quadriceps).toBe(13);
    expect(v.deltLateral).toBe(11);
    expect(v.posterior).toBe(11);
    expect(v.biceps).toBe(9);
    expect(v.triceps).toBe(9);
    expect(v.panturrilha).toBe(8);
    expect(v.trapezio).toBe(3);
  });
});

describe("dupla progressão", () => {
  it("sem histórico pede para escolher carga", () => {
    expect(suggest(hack, undefined, 4, 3, 5).kind).toBe("first");
  });

  it("todas no topo → sobe", () => {
    const s = suggest(hack, entry(hack.id, [[120, 10], [120, 10], [120, 10], [120, 10]]), 4, 3, 5);
    expect(s.kind).toBe("up");
    expect(s.weight).toBe(125);
  });

  it("dentro da faixa → mantém e busca +1 rep", () => {
    const s = suggest(hack, entry(hack.id, [[120, 8], [120, 7], [120, 7], [120, 6]]), 4, 3, 5);
    expect(s.kind).toBe("same");
    expect(s.weight).toBe(120);
    expect(s.targets).toEqual([9, 8, 8, 7]);
  });

  it("1ª série abaixo do piso → baixa ~10%", () => {
    const s = suggest(hack, entry(hack.id, [[140, 4], [140, 3]]), 4, 3, 5);
    expect(s.kind).toBe("down");
    expect(s.weight).toBe(125);
  });

  it("usou −15% → não sobe ainda", () => {
    const s = suggest(hack, entry(hack.id, [[120, 10], [120, 10], [120, 10], [102.5, 10]], ["work", "work", "work", "drop"]), 4, 3, 5);
    expect(s.kind).toBe("same");
  });

  it("back-off de 15%", () => {
    expect(backoffWeight(80, 2.5)).toBe(67.5);
  });
});

describe("recordes", () => {
  const a = session("a", "2026-09-24", "lower-a", [entry(hack.id, [[120, 6], [110, 8]])]);
  const b = session("b", "2026-10-01", "lower-a", [entry(hack.id, [[120, 8], [125, 5]])]);

  it("calcula recordes", () => {
    const r = recordsOf(historyOf([a, b], hack.id));
    expect(r.heaviest?.weight).toBe(125);
    expect(r.repRecords.find((x) => x.weight === 120)?.reps).toBe(8);
    expect(Math.round(r.bestE1rm!.value)).toBe(Math.round(e1rm(120, 8)));
  });

  it("detecta recordes batidos na sessão", () => {
    const prs = prsInSession(b, [a, b]);
    expect(prs.map((p) => p.kind).sort()).toEqual(["1rm", "carga", "reps"]);
    expect(prsInSession(a, [a, b])).toEqual([]); // primeira vez = linha de base
  });
});

describe("agenda", () => {
  it("sem histórico segue a semana padrão", () => {
    const plan = planAhead([], "2026-10-12", 7, [1, 2, 3, 4, 5]); // segunda
    expect(plan.map((p) => p.dayId)).toEqual(PROGRAM.map((p) => p.id));
  });

  it("dia perdido empurra a sequência", () => {
    // Fez Push A na segunda e faltou na terça: quarta vira Pull A.
    const s = session("x", "2026-10-12", "push-a", []);
    const plan = planAhead([s], "2026-10-14", 3, [1, 2, 3, 4, 5]);
    expect(plan[0]).toEqual({ date: "2026-10-14", dayId: "pull-a" });
    expect(plan[1].dayId).toBe("lower-a");
  });
});
