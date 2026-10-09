import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { EXERCISE_BY_ID } from "../data/program";
import type { Session, SessionExercise } from "../data/types";
import { db, DEFAULT_SETTINGS, exportBackup, importBackup, isBackup, loadSettings, saveSettings } from "./db";
import { revertBackoff } from "./progression";
import { planAhead } from "./schedule";
import { buildSession } from "./sessions";

const set = (kind: "warmup" | "work" | "drop", weight: number | null, reps: number | null, done = true) => ({
  id: Math.random().toString(36).slice(2),
  kind,
  weight,
  reps,
  done,
});

function doneSession(id: string, date: string, dayId: string, exercises: SessionExercise[]): Session {
  return { id, date, dayId, week: 3, startedAt: Date.parse(date), finishedAt: Date.parse(date) + 1, status: "done", exercises };
}

describe("−15% desfeito", () => {
  it("volta ao normal quando nenhuma série feita ficou abaixo do piso", () => {
    const e: SessionExercise = {
      exId: "lower-a.hack",
      unit: "kg",
      sets: [set("work", 100, 8), set("work", 100, 7), set("drop", 85, null, false)],
    };
    expect(revertBackoff(e, 6)).toBe(true);
    expect(e.sets[2]).toMatchObject({ kind: "work", weight: 100 });
  });

  it("mantém o −15% enquanto existir série abaixo do piso", () => {
    const e: SessionExercise = {
      exId: "lower-a.hack",
      unit: "kg",
      sets: [set("work", 100, 8), set("work", 100, 5), set("drop", 85, null, false)],
    };
    expect(revertBackoff(e, 6)).toBe(false);
    expect(e.sets[2].kind).toBe("drop");
  });
});

describe("montar treino", () => {
  const prev = doneSession("p", "2026-10-05", "lower-a", [
    { exId: "lower-a.hack", unit: "kg", sets: [set("work", 100, 8), set("work", 100, 6), set("work", 100, 5), set("drop", 85, 8)] },
  ]);

  it("repetir usa a carga principal em todas as séries (ignora o −15%)", () => {
    const s = buildSession("lower-a", "2026-10-12", 3, DEFAULT_SETTINGS, [prev], prev);
    const hack = s.exercises.find((e) => e.exId === "lower-a.hack")!;
    const work = hack.sets.filter((x) => x.kind === "work");
    expect(work).toHaveLength(4);
    expect(work.every((x) => x.weight === 100)).toBe(true);
    expect(hack.sets.filter((x) => x.kind === "warmup")).toHaveLength(2);
  });

  it("semana 1 tira uma série dos isolados e o deload corta pela metade", () => {
    const w1 = buildSession("lower-a", "2026-09-21", 1, DEFAULT_SETTINGS, []);
    const ext = w1.exercises.find((e) => e.exId === "lower-a.extensora")!;
    expect(ext.sets.filter((x) => x.kind === "work")).toHaveLength(EXERCISE_BY_ID["lower-a.extensora"].sets - 1);
    const d = buildSession("lower-a", "2026-11-02", 7, DEFAULT_SETTINGS, []);
    expect(d.exercises[0].sets.filter((x) => x.kind === "work")).toHaveLength(2);
  });
});

describe("agenda com dias personalizados", () => {
  it("distribui só nos dias marcados", () => {
    const plan = planAhead([], "2026-10-12", 7, [1, 3, 5]); // seg, qua, sex
    expect(plan.map((p) => p.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-16"]);
    expect(plan.map((p) => p.dayId)).toEqual(["push-a", "pull-a", "lower-a"]);
  });
});

describe("backup", () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.kv.clear();
  });

  it("exporta e importa sem perder nada", async () => {
    await saveSettings({ operator: "Teste", mesoStart: "2026-10-05" });
    await db.sessions.put(doneSession("a", "2026-10-06", "push-a", []));
    const b = await exportBackup();
    expect(isBackup(b)).toBe(true);

    await db.sessions.clear();
    await saveSettings(DEFAULT_SETTINGS);
    expect(await importBackup(b, "replace")).toBe(1);
    expect((await loadSettings()).operator).toBe("Teste");
    expect(await db.sessions.count()).toBe(1);
  });

  it("recusa arquivo de outro app e ignora treinos malformados", async () => {
    expect(isBackup({ app: "outro", sessions: [], settings: {} })).toBe(false);
    const n = await importBackup(
      {
        app: "augment",
        version: 1,
        exportedAt: "",
        settings: DEFAULT_SETTINGS,
        sessions: [doneSession("ok", "2026-10-06", "push-a", []), { id: 3 } as unknown as Session],
      },
      "merge",
    );
    expect(n).toBe(1);
    expect(await db.sessions.count()).toBe(1);
  });
});
