import { describe, expect, it } from "vitest";
import type { Session } from "../data/types";
import { operatorSerial, profileTelemetry, rankOf, sessionTopKg, tonnes } from "./profile";

function session(date: string, weight: number, sets = 3): Session {
  return {
    id: `s${date}`,
    dayId: "lower-a",
    date,
    week: 2,
    startedAt: Date.parse(`${date}T18:00:00`),
    finishedAt: Date.parse(`${date}T19:00:00`),
    status: "done",
    exercises: [
      {
        exId: "lower-a.hack",
        unit: "kg",
        sets: Array.from({ length: sets }, (_, i) => ({ id: `${i}`, kind: "work" as const, weight, reps: 10, done: true })),
      },
    ],
  };
}

describe("perfil do operador", () => {
  it("telemetria de 8 semanas com variação, consistência e volume", () => {
    const today = "2026-11-11"; // quarta
    const sessions = [session("2026-09-22", 100), session("2026-10-01", 100), session("2026-11-03", 120), session("2026-11-10", 120)];
    const t = profileTelemetry(sessions, today);
    expect(t.weeks).toHaveLength(8);
    expect(t.weeks[7].monday).toBe("2026-11-09");
    expect(t.weeks[7].volumeKg).toBe(3600);
    expect(t.consistencyPct).toBe(50); // 4 de 8 semanas
    expect(t.volumeChangePct).toBe(20); // 7200 × 6000
    expect(t.volume90Kg).toBe(13200);
    expect(t.prsCycle).toBeGreaterThan(0);
  });
  it("sem treinos não inventa variação", () => {
    const t = profileTelemetry([], "2026-11-11");
    expect(t.volumeChangePct).toBeNull();
    expect(t.consistencyPct).toBe(0);
  });
  it("utilidades", () => {
    expect(sessionTopKg(session("2026-11-10", 87.5))).toBe(87.5);
    expect(operatorSerial("abc")).toMatch(/^AX-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(operatorSerial("abc")).toBe(operatorSerial("abc"));
    expect(tonnes(16800)).toBe("16,8 t");
    expect(rankOf(0)).toBe("RECRUTA");
    expect(rankOf(120)).toBe("VETERANO");
  });
});

describe("rankProgress", () => {
  it("bate com rankOf e conta quanto falta para o próximo posto", async () => {
    const { rankProgress, rankOf, RANKS } = await import("./profile");
    for (const n of [0, 9, 10, 39, 40, 99, 100, 199, 200, 350]) expect(rankProgress(n).rank).toBe(rankOf(n));
    expect(rankProgress(0)).toMatchObject({ index: 0, next: "EM CALIBRAGEM", need: 10, into: 0, span: 10 });
    expect(rankProgress(31)).toMatchObject({ rank: "EM CALIBRAGEM", next: "AUMENTADO", need: 9, into: 21, span: 30 });
    expect(rankProgress(250)).toMatchObject({ index: RANKS.length - 1, next: null, need: 0 });
  });
});
