import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { exById } from "../data/program";
import type { Session, SessionExercise } from "../data/types";
import {
  db,
  DEFAULT_SETTINGS,
  deleteBodyEntry,
  exportBackup,
  importBackup,
  isBackup,
  loadBodyLog,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  upsertBodyEntry,
} from "./db";
import { revertBackoff } from "./progression";
import { planAhead } from "./schedule";
import { buildSession, effectiveEndAt } from "./sessions";

const set = (kind: "warmup" | "work" | "drop", weight: number | null, reps: number | null, done = true, doneAt?: number) => ({
  id: Math.random().toString(36).slice(2),
  kind,
  weight,
  reps,
  done,
  doneAt,
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

describe("montar treino e encerrar", () => {
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

  it("aplica rotação de acessórios do mesociclo (swaps) ao montar sessão nova", () => {
    const s = buildSession("lower-a", "2026-10-12", 3, { ...DEFAULT_SETTINGS, swaps: { "lower-a.hack": "Pendulum squat" } }, [prev]);
    const hack = s.exercises.find((e) => e.exId === "lower-a.hack")!;
    expect(hack.alt).toBe("Pendulum squat");
    // Como não havia histórico de Pendulum squat, peso sugerido é null (não mistura com o hack de 100 kg)
    expect(hack.sets.filter((x) => x.kind === "work")[0].weight).toBeNull();
  });

  it("semana 1 tira uma série dos isolados e o deload corta pela metade", () => {
    const w1 = buildSession("lower-a", "2026-09-21", 1, DEFAULT_SETTINGS, []);
    const ext = w1.exercises.find((e) => e.exId === "lower-a.extensora")!;
    expect(ext.sets.filter((x) => x.kind === "work")).toHaveLength(exById("lower-a.extensora").sets - 1);
    const d = buildSession("lower-a", "2026-11-02", 7, DEFAULT_SETTINGS, []);
    expect(d.exercises[0].sets.filter((x) => x.kind === "work")).toHaveLength(2);
  });

  it("ajusta a duração quando esquecido aberto, mas preserva treino longo (>2h30) com série recente", () => {
    const t0 = 1_000_000_000_000;
    const lastSet = t0 + 55 * 60_000;
    const s: Session = {
      id: "open1",
      dayId: "push-a",
      date: "2026-10-12",
      week: 3,
      startedAt: t0,
      status: "active",
      exercises: [{ exId: "push-a.supino-maq", unit: "kg", sets: [set("work", 80, 10, true, lastSet)] }],
    };
    const normal = effectiveEndAt(s, t0 + 60 * 60_000);
    expect(normal).toEqual({ finishedAt: t0 + 60 * 60_000, capped: false });

    const forgotten = effectiveEndAt(s, t0 + 10 * 3600_000);
    expect(forgotten).toEqual({ finishedAt: lastSet + 3 * 60_000, capped: true });

    // Treino longo real de 2h40m onde a última série foi há 5 minutos: NÃO deve cortar para 90 min!
    const longSetAt = t0 + 155 * 60_000;
    const longSession: Session = {
      ...s,
      exercises: [{ exId: "push-a.supino-maq", unit: "kg", sets: [set("work", 80, 10, true, longSetAt)] }],
    };
    const activeLong = effectiveEndAt(longSession, t0 + 160 * 60_000);
    expect(activeLong).toEqual({ finishedAt: t0 + 160 * 60_000, capped: false });
  });
});

describe("agenda com dias personalizados", () => {
  it("distribui só nos dias marcados", () => {
    const plan = planAhead([], "2026-10-12", 7, [1, 3, 5]); // seg, qua, sex
    expect(plan.map((p) => p.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-16"]);
    expect(plan.map((p) => p.dayId)).toEqual(["push-a", "pull-a", "lower-a"]);
  });
});

describe("backup, sanitização e biometria", () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.kv.clear();
  });

  it("sanitiza ajustes inválidos sem quebrar o estado", () => {
    const clean = sanitizeSettings({
      operator: "   ",
      mesoStart: "data-invalida",
      trainingDays: [99, -1, "seg"],
      increments: { "lower-a.hack": -5, "push-a.supino-maq": 2.5 },
      machineWeights: { "pull-a.martelo-corda": [22.5, 12.5, 17.5, -10] },
    });
    expect(clean.operator).toBe(DEFAULT_SETTINGS.operator);
    expect(clean.mesoStart).toBe(DEFAULT_SETTINGS.mesoStart);
    expect(clean.trainingDays).toEqual([1, 2, 3, 4, 5]);
    expect(clean.increments).toEqual({ "push-a.supino-maq": 2.5 });
    expect(clean.machineWeights["pull-a.martelo-corda"]).toEqual([12.5, 17.5, 22.5]);
  });

  it("salva e exclui entradas de biometria (peso e medidas)", async () => {
    await upsertBodyEntry({ id: "b1", date: "2026-10-01", weightKg: 81.2, waistCm: 82 });
    await upsertBodyEntry({ id: "b2", date: "2026-10-08", weightKg: 81.8, armCm: 40.5 });
    const list = await loadBodyLog();
    expect(list.map((x) => x.id)).toEqual(["b2", "b1"]);
    await deleteBodyEntry("b1");
    expect((await loadBodyLog()).map((x) => x.id)).toEqual(["b2"]);
  });

  it("exporta e importa sem perder nada (replace e merge, incluindo bodyLog)", async () => {
    await saveSettings({
      operator: "Teste",
      mesoStart: "2026-10-05",
      increments: { "lower-a.hack": 5 },
      swaps: { "lower-a.extensora": "Sissy squat apoiado" },
      videos: { "hack-squat": "https://youtu.be/abc12345" },
      exerciseNotes: { "lower-a.hack": "Pés baixos" },
    });
    await upsertBodyEntry({ id: "b1", date: "2026-10-06", weightKg: 82 });
    await db.sessions.put(doneSession("a", "2026-10-06", "push-a", []));
    const b = await exportBackup();
    expect(isBackup(b)).toBe(true);
    expect(b.bodyLog).toHaveLength(1);

    await db.sessions.clear();
    await db.kv.clear();
    expect(await importBackup(b, "merge")).toBe(1);
    const merged = await loadSettings();
    expect(merged.operator).toBe("Teste");
    expect(merged.increments["lower-a.hack"]).toBe(5);
    expect(merged.swaps["lower-a.extensora"]).toBe("Sissy squat apoiado");
    expect(merged.videos["hack-squat"]).toBe("https://youtu.be/abc12345");
    expect(merged.exerciseNotes["lower-a.hack"]).toBe("Pés baixos");
    expect(await loadBodyLog()).toHaveLength(1);

    await db.sessions.clear();
    await db.kv.clear();
    expect(await importBackup(b, "replace")).toBe(1);
    expect((await loadSettings()).operator).toBe("Teste");
    expect(await db.sessions.count()).toBe(1);
  });

  it("recusa arquivo de outro app ou versão desconhecida e ignora treinos malformados", () => {
    expect(isBackup({ app: "outro", version: 1, sessions: [], settings: {} })).toBe(false);
    expect(isBackup({ app: "augment", version: 99, sessions: [], settings: {} })).toBe(false);
  });
});
