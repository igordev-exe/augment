import { describe, expect, it } from "vitest";
import type { Session, SessionExercise, SetEntry } from "../data/types";
import { weeklyReport } from "./report";

// Os três primeiros treinos reais (backup de 02/11/2026), só séries de trabalho e −15%.
type S = [number, number, ("work" | "drop")?];

function ex(exId: string, sets: S[]): SessionExercise {
  return {
    exId,
    unit: "kg",
    sets: sets.map(([weight, reps, kind], i): SetEntry => ({ id: `${exId}${i}`, kind: kind ?? "work", weight, reps, done: true })),
  };
}

function session(id: string, date: string, dayId: string, week: number, exercises: SessionExercise[]): Session {
  const t = Date.parse(date);
  return { id, date, dayId, week, startedAt: t, finishedAt: t + 1, status: "done", exercises };
}

const pull14 = session("p14", "2026-10-14", "pull-a", 1, [
  ex("pull-a.puxada-aberta", [
    [60, 6],
    [50, 8],
    [50, 8],
    [40, 7, "drop"],
  ]),
  ex("pull-a.remada-apoio", [
    [55, 8],
    [50, 9],
    [50, 8],
    [40, 7],
  ]),
  ex("pull-a.pullover", []),
  ex("pull-a.crucifixo-inv", [
    [20, 13],
    [15, 15, "drop"],
  ]),
  ex("pull-a.encolhimento", [
    [20, 10],
    [40, 9],
  ]),
  ex("pull-a.rosca-incl", [
    [12, 8],
    [14, 7],
  ]),
  ex("pull-a.martelo-corda", [
    [20, 7],
    [17.5, 8, "drop"],
  ]),
]);

const lower19 = session("l19", "2026-10-19", "lower-a", 2, [
  ex("lower-a.hack", [
    [60, 8],
    [20, 10],
    [40, 8],
    [40, 6],
  ]),
  ex("lower-a.leg-press", [
    [45, 10],
    [80, 10],
    [60, 10],
  ]),
  ex("lower-a.extensora", [
    [70, 12],
    [70, 11],
    [60, 12, "drop"],
  ]),
  ex("lower-a.flexora", [
    [50, 10],
    [50, 8],
    [40, 8, "drop"],
  ]),
  ex("lower-a.panturrilha-pe", [
    [35, 8],
    [25, 13],
    [25, 10],
  ]),
  ex("lower-a.abd-polia", [
    [20, 10],
    [20, 10],
    [20, 10],
  ]),
]);

const pull21 = session("p21", "2026-10-21", "pull-a", 2, [
  ex("pull-a.puxada-aberta", [
    [50, 9],
    [50, 9],
    [50, 10],
    [50, 9],
  ]),
  ex("pull-a.remada-apoio", [
    [50, 9],
    [50, 9],
    [50, 9],
  ]),
  ex("pull-a.pullover", [
    [30, 12],
    [40, 12],
    [40, 12],
  ]),
  ex("pull-a.crucifixo-inv", [
    [17.5, 15],
    [17.5, 15],
    [17.5, 15],
  ]),
  ex("pull-a.encolhimento", [
    [36, 10],
    [36, 10],
    [36, 10],
  ]),
  ex("pull-a.rosca-incl", [
    [12, 9],
    [12, 8],
    [12, 9],
  ]),
  ex("pull-a.martelo-corda", [
    [17.5, 10],
    [17.5, 10],
    [17.5, 10],
  ]),
]);

const all = [pull14, lower19, pull21];
const days = [1, 2, 3, 4, 5];

describe("relatório semanal (dados reais)", () => {
  it("semana 1 (12–18/10): 1 de 5 treinos, pullover pulado → foco em frequência", () => {
    const r = weeklyReport(all, "2026-10-12", "2026-10-12", days);
    expect(r.done).toBe(1);
    expect(r.mesoWeek).toBe(1);
    expect(r.missingDays).toEqual(["push-a", "lower-a", "upper-b", "lower-b"]);
    expect(r.shortfalls.find((s) => s.exId === "pull-a.pullover")).toMatchObject({ done: 0 });
    expect(r.focus.title).toBe("Frequência");
    expect(r.focus.detail).toContain("1 de 5");
  });

  it("semana 2 (19–25/10): recordes do Pull A e panturrilha com série a menos", () => {
    const r = weeklyReport(all, "2026-10-19", "2026-10-12", days);
    expect(r.done).toBe(2);
    expect(r.prs.some((p) => p.exId === "pull-a.martelo-corda" || p.exId === "pull-a.puxada-aberta")).toBe(true);
    expect(r.shortfalls.map((s) => s.exId)).toContain("lower-a.panturrilha-pe");
    expect(r.volume.find((v) => v.muscle === "costas")!.done).toBeGreaterThan(0);
    expect(r.focus.title).toBe("Frequência");
  });

  it("semana vazia antes do recomeço", () => {
    const r = weeklyReport(all, "2026-10-26", "2026-11-02", days);
    expect(r.done).toBe(0);
    expect(r.mesoWeek).toBeNull();
    expect(r.focus.title).toBe("Frequência");
  });
});

describe("relatório semanal (regras)", () => {
  const full = (date: string, dayId: string, week: number, exercises: SessionExercise[]) =>
    session(date + dayId, date, dayId, week, exercises);

  it("RIR abaixo da meta nas semanas 1–2 → segurar a intensidade", () => {
    const hack = ex("lower-a.hack", [
      [60, 8],
      [60, 8],
      [60, 8],
    ]);
    hack.sets.forEach((s) => (s.rir = 0));
    const leg = ex("lower-a.leg-press", [
      [80, 12],
      [80, 12],
      [80, 12],
    ]);
    leg.sets.forEach((s) => (s.rir = 0));
    const ss = ["2026-11-02", "2026-11-03", "2026-11-04"].map((d, i) =>
      full(d, ["lower-a", "upper-b", "lower-b"][i], 1, i === 0 ? [hack, leg] : []),
    );
    const r = weeklyReport(ss, "2026-11-02", "2026-11-02", days);
    expect(r.rir.logged).toBe(6);
    expect(r.rir.harder.map((m) => m.exId).sort()).toEqual(["lower-a.hack", "lower-a.leg-press"]);
    expect(r.focus.title).toBe("Segurar a intensidade");
  });

  it("articulação incomodou 2 vezes → trocar, com alternativas da biblioteca", () => {
    const mk = (date: string) => {
      const e = ex("pull-a.martelo-corda", [
        [17.5, 12],
        [17.5, 12],
        [17.5, 12],
      ]);
      e.feedback = { joint: "incomodou" };
      return full(date, "pull-a", 3, [e]);
    };
    const r = weeklyReport([mk("2026-11-04"), mk("2026-11-11")], "2026-11-09", "2026-10-26", days);
    expect(r.joints[0]).toMatchObject({ exId: "pull-a.martelo-corda", times: 2 });
    expect(r.focus.title).toBe("Trocar Rosca martelo na corda");
  });

  it("três sessões sem 1RM novo → estagnado", () => {
    const s = (date: string) =>
      full(date, "pull-a", 3, [
        ex("pull-a.remada-apoio", [
          [50, 9],
          [50, 9],
          [50, 9],
        ]),
      ]);
    const extra = ["2026-11-17", "2026-11-18", "2026-11-19"].map((d) => full(d, "lower-a", 3, []));
    const r = weeklyReport([s("2026-11-02"), s("2026-11-09"), s("2026-11-16"), ...extra], "2026-11-16", "2026-10-26", days);
    expect(r.stalls.map((x) => x.exId)).toEqual(["pull-a.remada-apoio"]);
    expect(r.focus.title).toBe("Destravar Remada com apoio de peito");
  });
});
