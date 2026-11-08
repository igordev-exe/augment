import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { PPL_DAYS, PPL_PROGRAM_ID } from "../data/templates/ppl";
import type { Session } from "../data/types";

// Migração do banco v1 (programa fixo no código) para v2 (programa salvo + retrato nas sessões).
// O banco v1 é criado aqui, antes de importar db.ts, como estaria no celular de quem já usa o app.

const SUPINO = "push-a.supino-incl-halt";

describe("migração v1 → v2", () => {
  it("cria o PPL com os mesmos ids, preenche os retratos e mantém os ajustes", async () => {
    const old = new Dexie("augment");
    old.version(1).stores({ sessions: "id, date, dayId, status", kv: "key" });
    await old.open();
    const s1: Session = {
      id: "s1",
      dayId: "push-a",
      date: "2026-10-01",
      week: 2,
      startedAt: 1,
      finishedAt: 2,
      status: "done",
      exercises: [
        { exId: SUPINO, unit: "kg", sets: [{ id: "a", kind: "work", weight: 30, reps: 8, done: true }] },
        // Id que não existe no modelo (ex.: exercício de uma versão antiga da ficha): fica sem retrato.
        { exId: "push-a.nao-existe", unit: "kg", sets: [] },
      ],
    };
    await old.table("sessions").put(s1);
    await old.table("kv").put({
      key: "settings",
      value: {
        operator: "Ana",
        mesoStart: "2026-09-21",
        trainingDays: [1, 2, 3, 4, 5],
        units: { [SUPINO]: "lb" },
        setAdjust: { [SUPINO]: 1 },
      },
    });
    old.close();

    const { db, loadActiveProgram, loadSettings } = await import("./db");
    const { dayById, exById } = await import("../data/program");
    const p = await loadActiveProgram();

    expect(p.id).toBe(PPL_PROGRAM_ID);
    expect(p.days.map((d) => d.id)).toEqual(PPL_DAYS.map((d) => d.id));
    expect(p.days.flatMap((d) => d.exercises.map((e) => e.id))).toEqual(PPL_DAYS.flatMap((d) => d.exercises.map((e) => e.id)));
    expect(await db.programs.count()).toBe(1);

    const s = await db.sessions.get("s1");
    expect(s!.exercises[0].snap?.lib).toBe("supino-inclinado-halteres");
    expect(s!.exercises[0].snap?.muscles).toEqual(["peito"]);
    expect(s!.exercises[1].snap).toBeUndefined();
    // v3: retrato do dia.
    expect(s!.day).toEqual({ name: "Push A", code: "PA", focus: "Ênfase peito" });
    expect(db.verno).toBe(3);
    // As séries continuam iguais.
    expect(s!.exercises[0].sets).toEqual(s1.exercises[0].sets);

    const settings = await loadSettings();
    expect(settings.activeProgramId).toBe(PPL_PROGRAM_ID);
    expect(settings.units[SUPINO]).toBe("lb");
    expect(settings.setAdjust?.[SUPINO]).toBe(1);
    expect(settings.operator).toBe("Ana");

    // O registro já responde pelo programa carregado.
    expect(dayById("push-a").name).toBe("Push A");
    expect(exById(SUPINO).lib).toBe("supino-inclinado-halteres");
    db.close();
  });
});
