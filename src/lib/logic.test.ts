import { describe, expect, it } from "vitest";
import { EXERCISE_BY_ID, PROGRAM } from "../data/program";
import type { Session, SessionExercise } from "../data/types";
import { reentryFor, rirRange, setsFor, stopFor, weekFor } from "./mesocycle";
import { backoffWeight, e1rm, historyOf, predictReps, prsInSession, recordsOf, suggest } from "./progression";
import { planAhead } from "./schedule";
import { plannedVolume } from "./sessions";

const hack = EXERCISE_BY_ID["lower-a.hack"];
const extensora = EXERCISE_BY_ID["lower-a.extensora"];
const martelo = EXERCISE_BY_ID["pull-a.martelo-corda"];

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

describe("retomada", () => {
  const days = [1, 2, 3, 4, 5];
  // Seus treinos reais: 14/10, 19/10 e 21/10, mesociclo desde 12/10.
  const done = ["2026-10-14", "2026-10-19", "2026-10-21"];

  it("10+ dias parado → recomeçar na semana 1", () => {
    expect(reentryFor(done, "2026-10-12", "2026-11-02", days)).toEqual({ kind: "restart", gapDays: 12, week: 4 });
  });

  it("semana passada fraca → repetir a semana", () => {
    expect(reentryFor(["2026-10-21", "2026-10-27"], "2026-10-12", "2026-11-02", days)).toEqual({
      kind: "repeat",
      week: 4,
      done: 1,
      planned: 5,
    });
  });

  it("não pergunta de novo na mesma semana, nem na semana 1, nem com a semana passada cumprida", () => {
    expect(reentryFor(done, "2026-10-12", "2026-11-04", days, "2026-11-02")).toBeNull();
    expect(reentryFor(done, "2026-11-02", "2026-11-02", days)).toBeNull();
    const full = ["2026-10-26", "2026-10-27", "2026-10-28"];
    expect(reentryFor(full, "2026-10-12", "2026-11-02", days)).toBeNull();
  });

  it("faixa de RIR segue a semana", () => {
    expect(rirRange("T", 1)).toEqual([2, 3]);
    expect(rirRange("F", 4)).toEqual([0, 1]);
    expect(rirRange("R", 5)).toEqual([2, 3]);
  });
});

describe("dupla progressão", () => {
  it("sem histórico pede para escolher carga", () => {
    expect(suggest(hack, undefined, 4, 3, 5).kind).toBe("first");
  });

  it("todas no topo → sobe", () => {
    const s = suggest(
      hack,
      entry(hack.id, [
        [120, 10],
        [120, 10],
        [120, 10],
        [120, 10],
      ]),
      4,
      3,
      5,
    );
    expect(s.kind).toBe("up");
    expect(s.weight).toBe(125);
  });

  it("dentro da faixa → mantém e busca +1 rep", () => {
    const s = suggest(
      hack,
      entry(hack.id, [
        [120, 8],
        [120, 7],
        [120, 7],
        [120, 6],
      ]),
      4,
      3,
      5,
    );
    expect(s.kind).toBe("same");
    expect(s.weight).toBe(120);
    expect(s.targets).toEqual([9, 8, 8, 7]);
  });

  it("1ª série abaixo do piso → baixa ~10%", () => {
    const s = suggest(
      hack,
      entry(hack.id, [
        [140, 4],
        [140, 3],
      ]),
      4,
      3,
      5,
    );
    expect(s.kind).toBe("down");
    expect(s.weight).toBe(125);
  });

  it("usou −15% → não sobe ainda", () => {
    const s = suggest(
      hack,
      entry(
        hack.id,
        [
          [120, 10],
          [120, 10],
          [120, 10],
          [102.5, 10],
        ],
        ["work", "work", "work", "drop"],
      ),
      4,
      3,
      5,
    );
    expect(s.kind).toBe("same");
  });

  it("salto grande demais para a faixa → acumula reps antes de subir", () => {
    // Cabo: 17,5 → 20 kg é +14%; com 15 reps a previsão em 20 kg fica abaixo de 10.
    const s = suggest(
      martelo,
      entry(martelo.id, [
        [17.5, 15],
        [17.5, 15],
        [17.5, 15],
      ]),
      3,
      3,
      2.5,
    );
    expect(s.kind).toBe("same");
    expect(s.weight).toBe(17.5);
    expect(s.targets).toEqual([16, 16, 16]);
    expect(predictReps(e1rm(17.5, 17), 20)).toBeGreaterThanOrEqual(10);
  });

  it("reps que sobraram contam na previsão do salto", () => {
    const top = entry(martelo.id, [
      [17.5, 15],
      [17.5, 15],
      [17.5, 15],
    ]);
    top.sets.forEach((x) => (x.rir = 2));
    const s = suggest(martelo, top, 3, 3, 2.5);
    expect(s.kind).toBe("up");
    expect(s.weight).toBe(20);
  });

  it("cargas misturadas (rampa como trabalho) → referência é a mais pesada", () => {
    // Registro real de 19/10: 60×8, 20×10, 40×8, 40×6.
    const s = suggest(
      hack,
      entry(hack.id, [
        [60, 8],
        [20, 10],
        [40, 8],
        [40, 6],
      ]),
      4,
      3,
      2.5,
    );
    expect(s.weight).toBe(60);
    expect(s.notes.some((n) => n.includes("variaram"))).toBe(true);
  });

  it("compara o RIR marcado com a meta da semana", () => {
    const e = entry(hack.id, [
      [100, 8],
      [100, 8],
    ]);
    e.sets.forEach((x) => (x.rir = 0));
    expect(suggest(hack, e, 4, 2, 2.5, 1).notes.join(" ")).toContain("falha");
    e.sets.forEach((x) => (x.rir = 4));
    expect(suggest(hack, e, 4, 4, 2.5, 3).notes.join(" ")).toContain("4+");
    e.sets.forEach((x) => (x.rir = 1));
    expect(suggest(hack, e, 4, 4, 2.5, 3).notes).toEqual([]);
  });

  it("back-off de 15%", () => {
    expect(backoffWeight(80, 2.5)).toBe(67.5);
  });
});

describe("recordes", () => {
  const a = session("a", "2026-09-24", "lower-a", [
    entry(hack.id, [
      [120, 6],
      [110, 8],
    ]),
  ]);
  const b = session("b", "2026-10-01", "lower-a", [
    entry(hack.id, [
      [120, 8],
      [125, 5],
    ]),
  ]);

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
