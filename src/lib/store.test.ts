import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "../data/types";
import {
  db,
  importBackup,
  loadActiveProgram,
  memoryCell,
  saveOperatorMemory,
  saveSettings,
  sessionsCell,
  settingsCell,
  startLocalData,
  exportBackup,
} from "./db";
import { createRestorePoint, restoreFrom } from "./restore";
import { cell, sameData, shareById } from "./store";

// Regras F1 e F2 (docs/prompt-fluidez.md): uma assinatura por dado; a tela lê da memória; o mesmo dado devolve o
// mesmo objeto; gravação chega a todos.

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
/** Espera a célula mudar de referência (a liveQuery responde de forma assíncrona). */
async function changed<T>(read: () => T, from: T, ms = 2000): Promise<T> {
  const t = Date.now();
  while (read() === from && Date.now() - t < ms) await wait(10);
  return read();
}

function session(id: string, date: string, reps = 8): Session {
  return {
    id,
    dayId: "push-a",
    date,
    week: 2,
    status: "done",
    startedAt: Date.parse(date),
    finishedAt: Date.parse(date) + 3600e3,
    exercises: [{ exId: "x", unit: "kg", sets: [{ id: id + "-1", kind: "work", weight: 50, reps, done: true }] }],
  } as Session;
}

describe("célula do estoque", () => {
  it("mesmo dado devolve a mesma referência e não avisa ninguém", () => {
    const c = cell<{ a: number[] }>();
    let calls = 0;
    c.subscribe(() => calls++);
    const first = c.set({ a: [1, 2] });
    expect(c.set({ a: [1, 2] })).toBe(first);
    expect(calls).toBe(1);
    const next = c.set({ a: [1, 3] });
    expect(next).not.toBe(first);
    expect(calls).toBe(2);
  });

  it("lista por id reaproveita os itens que não mudaram", () => {
    const a = [
      { id: "1", v: 1 },
      { id: "2", v: 2 },
    ];
    const same = shareById(a, [
      { id: "1", v: 1 },
      { id: "2", v: 2 },
    ]);
    expect(same).toBe(a);
    const one = shareById(a, [
      { id: "1", v: 1 },
      { id: "2", v: 9 },
    ]);
    expect(one).not.toBe(a);
    expect(one[0]).toBe(a[0]);
    expect(one[1]).not.toBe(a[1]);
    expect(sameData({ x: 1 }, { x: 1 })).toBe(true);
  });
});

describe("estoque ligado ao banco", () => {
  beforeAll(async () => {
    await loadActiveProgram();
    await db.sessions.bulkPut([session("s1", "2026-11-02"), session("s2", "2026-11-04")]);
    await startLocalData();
  });

  it("ler de novo (outra tela montando) não consulta o banco e devolve o mesmo objeto", async () => {
    const before = sessionsCell.queries;
    const a = sessionsCell.get();
    await startLocalData(); // uma 2ª tela "ligando" de novo não cria outra assinatura
    await wait();
    expect(sessionsCell.get()).toBe(a);
    expect(sessionsCell.queries).toBe(before);
    expect(a?.length).toBe(2);
  });

  it("gravação chega a quem assina, e só o treino mexido muda de referência", async () => {
    const before = sessionsCell.get()!;
    let calls = 0;
    const off = sessionsCell.subscribe(() => calls++);
    await db.sessions.put(session("s2", "2026-11-04", 10));
    const after = await changed(() => sessionsCell.get(), before);
    off();
    expect(calls).toBeGreaterThan(0);
    expect(after).not.toBe(before);
    expect(after!.find((s) => s.id === "s1")).toBe(before.find((s) => s.id === "s1"));
    expect(after!.find((s) => s.id === "s2")!.exercises[0].sets[0].reps).toBe(10);
  });

  it("gravar o mesmo conteúdo não troca a referência", async () => {
    const before = sessionsCell.get()!;
    const s1 = before.find((s) => s.id === "s1")!;
    await db.sessions.put(JSON.parse(JSON.stringify(s1)));
    await wait(80);
    expect(sessionsCell.get()).toBe(before);
  });

  it("ajuste e memória entram no estoque na hora, antes do banco responder", async () => {
    const p = saveSettings({ operator: "Ana" });
    expect(settingsCell.get()?.operator).toBe("Ana");
    await p;
    const m = saveOperatorMemory({ lastMesoStart: "2026-11-02" });
    expect(memoryCell.get()?.lastMesoStart).toBe("2026-11-02");
    await m;
  });

  it("importar backup e restaurar ponto atualizam o estoque", async () => {
    const backup = await exportBackup();
    await importBackup({ ...backup, sessions: [...backup.sessions, session("s3", "2026-11-06")] }, "merge", { snapshot: false });
    expect(sessionsCell.get()!.some((s) => s.id === "s3")).toBe(true);
    const point = await createRestorePoint("manual");
    await db.sessions.delete("s3");
    await changed(() => sessionsCell.get()!.some((s) => s.id === "s3"), true);
    expect(sessionsCell.get()!.some((s) => s.id === "s3")).toBe(false);
    await restoreFrom(point!.id);
    expect(sessionsCell.get()!.some((s) => s.id === "s3")).toBe(true);
  });
});
