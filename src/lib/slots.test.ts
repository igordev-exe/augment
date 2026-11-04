import { describe, expect, it } from "vitest";
import type { BodyEntry, Session, SessionExercise } from "../data/types";
import { attributes } from "./attributes";
import { DEFAULT_SETTINGS } from "./db";
import { slotCells, volumeSlots } from "./slots";

function ex(exId: string, n: number, reps = 10): SessionExercise {
  return {
    exId,
    unit: "kg",
    sets: Array.from({ length: n }, (_, i) => ({ id: `${exId}${i}`, kind: "work" as const, weight: 50, reps, done: true })),
  };
}
function session(date: string, dayId: string, exercises: SessionExercise[], extra: Partial<Session> = {}): Session {
  const t = Date.parse(date);
  return { id: `${dayId}-${date}`, date, dayId, week: 3, startedAt: t, finishedAt: t + 1, status: "done", exercises, ...extra };
}

describe("slots de volume", () => {
  it("conta direto 1,0 e sinergista 0,5, com as fontes de cada músculo", () => {
    const s = session("2026-11-02", "push-a", [ex("push-a.supino-incl-halt", 4), ex("push-a.triceps-corda", 3)]);
    const slots = volumeSlots([s], "2026-11-04", 3);
    const tri = slots.find((x) => x.muscle === "triceps")!;
    expect(tri.done).toBe(3 + 4 * 0.5);
    expect(tri.direct).toBe(3);
    expect(tri.sources.map((x) => [x.exId, x.weight])).toEqual([
      ["push-a.triceps-corda", 1],
      ["push-a.supino-incl-halt", 0.5],
    ]);
    const peito = slots.find((x) => x.muscle === "peito")!;
    expect(peito.status).toBe("abaixo-meta");
    expect(peito.missing).toBe(Math.ceil(peito.planned - 4));
  });

  it("status: abaixo da dose mínima, meta e acima; semana passada não conta", () => {
    const old = session("2026-10-26", "pull-a", [ex("pull-a.puxada-aberta", 20)]);
    const slots = volumeSlots([old], "2026-11-04", 3);
    expect(slots.find((x) => x.muscle === "costas")!.status).toBe("abaixo-minimo");
    const big = session("2026-11-03", "pull-a", [ex("pull-a.puxada-aberta", 30)]);
    expect(volumeSlots([big], "2026-11-04", 3).find((x) => x.muscle === "costas")!.status).toBe("acima");
  });

  it("casas: cheias até o feito, meia casa no 0,5, extra acima do plano", () => {
    expect(slotCells({ done: 2.5, planned: 4 })).toEqual(["full", "full", "half", "empty"]);
    expect(slotCells({ done: 5, planned: 4 })).toEqual(["full", "full", "full", "full", "extra"]);
    expect(slotCells({ done: 0, planned: 0 })).toEqual(["empty"]);
  });
});

describe("atributos do operador", () => {
  const settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-10-05", bodyGoal: { mode: "perder" as const } };

  it("sem treinos: tudo sem nível", () => {
    const r = attributes({ sessions: [], bodyLog: [], settings, today: "2026-11-04" });
    expect(r.list.every((a) => a.value == null && a.level == null)).toBe(true);
    expect(r.index).toBeNull();
  });

  it("força, consistência e recuperação saem dos registros; nível = valor ÷ 5", () => {
    const ss = [
      session("2026-10-13", "push-a", [ex("push-a.supino-maq", 3, 9)], { checkin: { sleep: "bom", energy: "ok", pain: "nenhuma" } }),
      session("2026-10-22", "push-a", [ex("push-a.supino-maq", 3, 11)], { checkin: { sleep: "ruim", energy: "ok", pain: "nenhuma" } }),
      session("2026-10-27", "push-a", [ex("push-a.supino-maq", 3, 12)], { checkin: { sleep: "bom", energy: "alta", pain: "nenhuma" } }),
    ];
    const r = attributes({ sessions: ss, bodyLog: [], settings, today: "2026-11-04" });
    const by = Object.fromEntries(r.list.map((a) => [a.id, a]));
    expect(by.forca.value).toBe(100);
    expect(by.forca.level).toBe(20);
    expect(by.consistencia.value).toBe(Math.round((100 * 3) / 20));
    expect(by.recuperacao.value).toBe(50);
    expect(by.composicao.value).toBeNull();
    expect(r.index).not.toBeNull();
  });

  it("composição: no ritmo da meta pontua alto", () => {
    const log: BodyEntry[] = Array.from({ length: 22 }, (_, i) => ({
      id: String(i),
      date: new Date(Date.parse("2026-10-14") + i * 86400000).toISOString().slice(0, 10),
      weightKg: Number((94 - i * 0.075).toFixed(2)),
    }));
    const r = attributes({ sessions: [], bodyLog: log, settings, today: "2026-11-04" });
    expect(r.list.find((a) => a.id === "composicao")!.value).toBe(90);
  });
});
