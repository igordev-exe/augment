import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { EXERCISE_BY_ID } from "../data/program";
import type { Session, SessionExercise } from "../data/types";
import { db, DEFAULT_SETTINGS, exportBackup, importBackup } from "./db";
import { historyOf, stallOf, suggestNext } from "./progression";
import {
  createRestorePoint,
  deleteRestorePoint,
  ensureWeeklyRestorePoint,
  listRestorePoints,
  loadRestorePoint,
  MAX_POINTS,
  restoreFrom,
} from "./restore";

const hack = EXERCISE_BY_ID["lower-a.hack"]; // 6–10 reps, incremento 5

function entry(sets: [number, number, number?][]): SessionExercise {
  return {
    exId: hack.id,
    unit: "kg",
    sets: sets.map(([w, r, rir], i) => ({ id: `${i}`, kind: "work", weight: w, reps: r, rir, done: true })),
  };
}

function session(id: string, date: string, e: SessionExercise, week = 3): Session {
  return {
    id,
    date,
    dayId: "lower-a",
    week,
    startedAt: Date.parse(date),
    finishedAt: Date.parse(date) + 1,
    status: "done",
    exercises: [e],
  };
}

const flat = (rir?: number): [number, number, number?][] => [
  [100, 8, rir],
  [100, 7, rir],
  [100, 7, rir],
];

describe("destravar estagnação", () => {
  it("3 treinos na mesma carga sem 1RM novo → baixa ~10%", () => {
    const sessions = ["2026-10-12", "2026-10-19", "2026-10-26"].map((d, i) => session(`s${i}`, d, entry(flat())));
    const hist = historyOf(sessions, hack.id);
    expect(stallOf(hist)?.trail).toEqual(["100×8,7,7", "100×8,7,7", "100×8,7,7"]);
    const s = suggestNext(hack, hist, 3, 4, 5);
    expect(s.kind).toBe("down");
    expect(s.weight).toBe(90);
    expect(s.title).toContain("Destravar");
    expect(s.targets).toEqual([8, 8, 8]);
  });

  it("reps subindo, carga mudando, poucas sessões ou deload: não destrava", () => {
    const rising = [
      session("a", "2026-10-12", entry(flat())),
      session(
        "b",
        "2026-10-19",
        entry([
          [100, 9],
          [100, 8],
          [100, 7],
        ]),
      ),
      session("c", "2026-10-26", entry(flat())),
    ];
    expect(stallOf(historyOf(rising, hack.id))).toBeNull();
    // Mesmo melhor set (100×8) com reps oscilando nas outras séries ainda conta como travado.
    const wobble = rising.map((s, i) =>
      i === 1
        ? session(
            "b",
            s.date,
            entry([
              [100, 8],
              [100, 8],
              [100, 7],
            ]),
          )
        : s,
    );
    expect(stallOf(historyOf(wobble, hack.id))).not.toBeNull();

    const changed = [
      session(
        "a",
        "2026-10-12",
        entry([
          [95, 9],
          [95, 8],
          [95, 8],
        ]),
      ),
      session("b", "2026-10-19", entry(flat())),
      session("c", "2026-10-26", entry(flat())),
    ];
    expect(stallOf(historyOf(changed, hack.id))).toBeNull();

    const two = [session("a", "2026-10-19", entry(flat())), session("b", "2026-10-26", entry(flat()))];
    expect(suggestNext(hack, historyOf(two, hack.id), 3, 4, 5).kind).toBe("same");

    // Semana de deload no meio não conta, e na semana 7 a sugestão continua sendo o deload.
    const withDeload = [
      session("a", "2026-10-05", entry(flat())),
      session("b", "2026-10-12", entry(flat()), 7),
      session("c", "2026-10-19", entry(flat())),
      session("d", "2026-10-26", entry(flat())),
    ];
    expect(stallOf(historyOf(withDeload, hack.id))).not.toBeNull();
    expect(suggestNext(hack, historyOf(withDeload, hack.id), 2, 7, 5).kind).toBe("deload");
  });

  it("travado mas sobrando 3+ reps: pede esforço em vez de baixar", () => {
    const sessions = ["2026-10-12", "2026-10-19", "2026-10-26"].map((d, i) => session(`s${i}`, d, entry(flat(3))));
    const s = suggestNext(hack, historyOf(sessions, hack.id), 3, 4, 5);
    expect(s.kind).toBe("same");
    expect(s.weight).toBe(100);
    expect(s.notes.join(" ")).toContain("falta esforço");
  });

  it("respeita os pinos da máquina ao baixar", () => {
    const sessions = ["2026-10-12", "2026-10-19", "2026-10-26"].map((d, i) => session(`s${i}`, d, entry(flat())));
    expect(suggestNext(hack, historyOf(sessions, hack.id), 3, 4, 5, [80, 87.5, 100]).weight).toBe(87.5);
  });
});

describe("pontos de restauração", () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.kv.clear();
  });

  const backup = (sessions: Session[]) => ({
    app: "augment" as const,
    version: 1 as const,
    exportedAt: "2026-11-03T00:00:00Z",
    settings: DEFAULT_SETTINGS,
    sessions,
  });

  it("sem dados não cria; com dados guarda tudo e poda os antigos", async () => {
    expect(await createRestorePoint("manual")).toBeNull();
    await db.sessions.put(session("a", "2026-10-26", entry(flat())));
    for (let i = 0; i < MAX_POINTS + 2; i++) await createRestorePoint("manual", new Date(Date.UTC(2026, 9, 1 + i)));
    const list = await listRestorePoints();
    expect(list).toHaveLength(MAX_POINTS);
    expect(list[0].at > list[list.length - 1].at).toBe(true);
    const keys = (await db.kv.toCollection().primaryKeys()).filter((k) => String(k).startsWith("restore:"));
    expect(keys).toHaveLength(MAX_POINTS);
    expect((await loadRestorePoint(list[0].id))?.sessions).toHaveLength(1);
    await deleteRestorePoint(list[0].id);
    expect(await listRestorePoints()).toHaveLength(MAX_POINTS - 1);
  });

  it("semanal só uma vez a cada 7 dias", async () => {
    await db.sessions.put(session("a", "2026-10-26", entry(flat())));
    expect(await ensureWeeklyRestorePoint("2026-11-03", new Date("2026-11-03T12:00:00Z"))).not.toBeNull();
    expect(await ensureWeeklyRestorePoint("2026-11-06", new Date("2026-11-06T12:00:00Z"))).toBeNull();
    expect(await ensureWeeklyRestorePoint("2026-11-10", new Date("2026-11-10T12:00:00Z"))).not.toBeNull();
  });

  it("importar guarda o estado anterior e dá para voltar", async () => {
    await db.sessions.bulkPut([session("a", "2026-10-19", entry(flat())), session("b", "2026-10-26", entry(flat()))]);
    await importBackup(backup([session("x", "2026-11-02", entry(flat()))]), "replace");
    expect(await db.sessions.count()).toBe(1);
    const [pre] = await listRestorePoints();
    expect(pre.reason).toBe("antes-importar");
    expect(pre.sessions).toBe(2);

    const n = await restoreFrom(pre.id);
    expect(n).toBe(2);
    expect((await exportBackup()).sessions.map((s) => s.id).sort()).toEqual(["a", "b"]);
    const reasons = (await listRestorePoints()).map((p) => p.reason);
    expect(reasons).toEqual(["antes-restaurar", "antes-importar"]);
  });
});
