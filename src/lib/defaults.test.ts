import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setActiveProgram } from "../data/program";
import { pplProgram } from "../data/templates/ppl";
import { TEMPLATES } from "../data/templates";
import type { Session } from "../data/types";
import { coachSystem } from "./coach/context";
import { mondayOf, todayISO } from "./dates";
import { db, DEFAULT_SETTINGS, loadActiveProgram, loadSettings } from "./db";
import { setPeriodization } from "./program-edit";

// App de uso geral: nada de nome, data ou programa de uma pessoa no código.

function done(date: string, week: number): Session {
  return { id: date, dayId: "push-a", date, week, startedAt: 1, finishedAt: 2, status: "done", exercises: [] };
}

describe("padrões sem dados pessoais", () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.programs.clear();
    await db.kv.clear();
  });
  afterEach(() => setActiveProgram(pplProgram(0)));

  it("sem nome e com o mesociclo começando nesta semana", () => {
    expect(DEFAULT_SETTINGS.operator).toBe("");
    expect(DEFAULT_SETTINGS.mesoStart).toBe(mondayOf(todayISO()));
  });

  it("instalação nova grava a data de início no primeiro acesso", async () => {
    await loadActiveProgram();
    const row = await db.kv.get("settings");
    expect((row?.value as { mesoStart: string }).mesoStart).toBe(mondayOf(todayISO()));
  });

  it("instalação antiga sem ajustes salvos tira a data do treino mais antigo", async () => {
    // Semana 2 do meso em 2026-10-07 (quarta) → mesociclo começou na segunda 2026-09-28.
    await db.sessions.bulkPut([done("2026-10-14", 3), done("2026-10-07", 2)]);
    await loadActiveProgram();
    expect((await loadSettings()).mesoStart).toBe("2026-09-28");
  });

  it("ajustes já salvos não mudam", async () => {
    await db.kv.put({ key: "settings", value: { ...DEFAULT_SETTINGS, operator: "Ana", mesoStart: "2026-01-05" } });
    await loadActiveProgram();
    const s = await loadSettings();
    expect(s.operator).toBe("Ana");
    expect(s.mesoStart).toBe("2026-01-05");
  });
});

describe("prompt do treinador sai do programa em uso", () => {
  afterEach(() => setActiveProgram(pplProgram(0)));

  it("sem nome fixo e com a sequência do programa", () => {
    const ppl = coachSystem();
    expect(ppl).not.toMatch(/Igor|\bdele\b/);
    expect(ppl).toContain("Push A → Pull A → Lower A → Upper B → Lower B");
    expect(ppl).toContain("5 treinos por semana");
    expect(coachSystem("Ana")).toContain("(Ana)");

    const fb = TEMPLATES.find((t) => t.id === "fb-3")!.make(1);
    setActiveProgram(fb);
    const sys = coachSystem();
    expect(sys).toContain(`"${fb.name}"`);
    expect(sys).toContain(`${fb.days.length} treinos por semana`);
    expect(sys).toContain(fb.days.map((d) => d.name).join(" → "));
    expect(sys).not.toContain("Push A");
    expect(sys).toContain("Deload (semana 7)");

    setActiveProgram(setPeriodization(fb, "fixed"));
    const fixed = coachSystem();
    expect(fixed).toContain("fixo, sem mesociclo");
    expect(fixed).not.toContain("Deload (semana 7)");
    expect(fixed).toBe(coachSystem());
  });
});
