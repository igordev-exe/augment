import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { activeProgram, dayById, dayOf, exById, programDays, rememberSessions, setActiveProgram } from "../data/program";
import { pplProgram, PPL_PROGRAM_ID } from "../data/templates/ppl";
import type { Program, ProgramExercise, Session } from "../data/types";
import { backfillSnapshots, db, DEFAULT_SETTINGS, exportBackup, importBackup, isProgram, loadActiveProgram, loadSettings } from "./db";
import { dayOrder, planAhead } from "./schedule";
import { buildSession } from "./sessions";

// Programa como dado: registro do programa ativo, retrato nas sessões e backup com programas.

const supino = (): ProgramExercise => structuredClone(pplProgram().days[0].exercises[0]);

function fullBody(): Program {
  const ex: ProgramExercise = { ...supino(), id: "fb-a.supino", name: "Supino" };
  return {
    id: "fb",
    name: "Full body",
    days: [
      { id: "fb-a", name: "Full A", code: "FA", weekday: 1, focus: "Corpo todo", notes: [], exercises: [ex] },
      { id: "fb-b", name: "Full B", code: "FB", weekday: 3, focus: "Corpo todo", notes: [], exercises: [{ ...ex, id: "fb-b.supino" }] },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

function session(id: string, date: string, dayId: string, exId: string, snap?: ProgramExercise): Session {
  return {
    id,
    dayId,
    date,
    week: 2,
    startedAt: Date.parse(date),
    finishedAt: Date.parse(date) + 1,
    status: "done",
    exercises: [{ exId, unit: "kg", snap, sets: [{ id: id + "s", kind: "work", weight: 40, reps: 10, done: true }] }],
  };
}

afterEach(() => setActiveProgram(pplProgram(0)));

describe("registro do programa ativo", () => {
  it("começa com o PPL e troca por outro programa", () => {
    expect(activeProgram().id).toBe(PPL_PROGRAM_ID);
    expect(dayOrder()).toEqual(["push-a", "pull-a", "lower-a", "upper-b", "lower-b"]);
    setActiveProgram(fullBody());
    expect(programDays().map((d) => d.id)).toEqual(["fb-a", "fb-b"]);
    expect(dayById("fb-b").name).toBe("Full B");
    // Dia de outro programa não entra na rotação, mas continua com nome para o histórico.
    expect(programDays().some((d) => d.id === "push-a")).toBe(false);
    expect(dayById("push-a").name).toBe("Push A");
    expect(exById("fb-a.supino").name).toBe("Supino");
  });

  it("a agenda segue a rotação do programa ativo", () => {
    setActiveProgram(fullBody());
    // 2026-11-02 é segunda: dias de treino seg/qua/sex.
    const plan = planAhead([session("x", "2026-10-30", "fb-a", "fb-a.supino")], "2026-11-02", 7, [1, 3, 5]);
    expect(plan.map((p) => p.dayId)).toEqual(["fb-b", "fb-a", "fb-b"]);
  });

  it("exercício fora do programa resolve pelo retrato da sessão e pelos removidos", () => {
    setActiveProgram(fullBody());
    expect(exById("push-a.supino-incl-halt")).toBeUndefined();
    rememberSessions([session("old", "2026-10-01", "push-a", "push-a.supino-incl-halt", supino())]);
    expect(exById("push-a.supino-incl-halt").lib).toBe("supino-inclinado-halteres");

    const retired: ProgramExercise = { ...supino(), id: "fb-a.velho", name: "Exercício removido" };
    setActiveProgram({ ...fullBody(), retired: [retired] });
    expect(exById("fb-a.velho").name).toBe("Exercício removido");
  });
});

describe("retrato do dia na sessão", () => {
  it("buildSession grava nome e sigla; dayOf monta o dia de um treino antigo fora do programa", () => {
    const s = buildSession("push-a", "2026-11-02", 2, DEFAULT_SETTINGS, []);
    expect(s.day).toEqual({ name: "Push A", code: "PA", focus: "Ênfase peito" });
    setActiveProgram(fullBody());
    const old: Session = {
      ...session("x", "2026-10-01", "dia-apagado", "push-a.supino-incl-halt", supino()),
      day: { name: "Peito velho", code: "PV" },
    };
    const d = dayOf(old);
    expect(d.name).toBe("Peito velho");
    expect(d.code).toBe("PV");
    expect(d.exercises.map((e) => e.id)).toEqual(["push-a.supino-incl-halt"]);
  });

  it("backfillSnapshots também preenche o dia", () => {
    const list = [session("a", "2026-10-01", "push-a", "push-a.supino-incl-halt")];
    backfillSnapshots(list, [pplProgram()]);
    expect(list[0].day?.code).toBe("PA");
  });
});

describe("retrato do exercício na sessão", () => {
  it("buildSession grava o retrato de cada exercício como está no programa", () => {
    const s = buildSession("push-a", "2026-11-02", 2, DEFAULT_SETTINGS, []);
    expect(s.exercises.length).toBe(pplProgram().days[0].exercises.length);
    for (const e of s.exercises) {
      expect(e.snap?.id).toBe(e.exId);
      expect(e.snap).toEqual(exById(e.exId));
      // É uma cópia: mudar o programa depois não muda o histórico.
      expect(e.snap).not.toBe(exById(e.exId));
    }
  });

  it("backfillSnapshots preenche só o que falta e acha removidos", () => {
    const keep = { ...supino(), name: "Retrato antigo" };
    const sessions = [
      session("a", "2026-10-01", "push-a", "push-a.supino-incl-halt"),
      session("b", "2026-10-02", "push-a", "push-a.supino-incl-halt", keep),
      session("c", "2026-10-03", "fb-a", "fb-a.velho"),
    ];
    const retired: ProgramExercise = { ...supino(), id: "fb-a.velho" };
    const n = backfillSnapshots(sessions, [pplProgram(), { ...fullBody(), retired: [retired] }]);
    expect(n).toBe(2);
    expect(sessions[0].exercises[0].snap?.lib).toBe("supino-inclinado-halteres");
    expect(sessions[1].exercises[0].snap?.name).toBe("Retrato antigo");
    expect(sessions[2].exercises[0].snap?.id).toBe("fb-a.velho");
  });

  it("isProgram recusa programa quebrado", () => {
    expect(isProgram(pplProgram())).toBe(true);
    expect(isProgram({ ...pplProgram(), days: [] })).toBe(false);
    const bad = pplProgram();
    (bad.days[0].exercises[0] as unknown as { stop: string }).stop = "X";
    expect(isProgram(bad)).toBe(false);
    expect(isProgram(null)).toBe(false);
  });
});

describe("backup com programas", () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.programs.clear();
    await db.kv.clear();
  });

  it("exporta os programas e um backup antigo (sem programas) volta com o PPL e os retratos", async () => {
    await loadActiveProgram();
    const out = await exportBackup();
    expect(out.programs?.map((p) => p.id)).toEqual([PPL_PROGRAM_ID]);

    const old = {
      app: "augment" as const,
      version: 1 as const,
      exportedAt: "2026-10-01T00:00:00Z",
      settings: { ...DEFAULT_SETTINGS },
      sessions: [session("s1", "2026-10-01", "push-a", "push-a.supino-incl-halt")],
    };
    await importBackup(old, "replace", { snapshot: false });
    expect((await db.programs.toArray()).map((p) => p.id)).toEqual([PPL_PROGRAM_ID]);
    expect((await db.sessions.get("s1"))!.exercises[0].snap?.lib).toBe("supino-inclinado-halteres");
    expect((await loadSettings()).activeProgramId).toBe(PPL_PROGRAM_ID);
  });

  it("restaurar troca o programa ativo pelo do backup", async () => {
    const fb = fullBody();
    await importBackup(
      {
        app: "augment",
        version: 1,
        exportedAt: "2026-11-01T00:00:00Z",
        settings: { ...DEFAULT_SETTINGS, activeProgramId: "fb" },
        sessions: [session("f1", "2026-11-02", "fb-a", "fb-a.supino")],
        programs: [fb],
      },
      "replace",
      { snapshot: false },
    );
    expect(activeProgram().id).toBe("fb");
    expect(dayById("fb-a").name).toBe("Full A");
    expect((await db.sessions.get("f1"))!.exercises[0].snap?.name).toBe("Supino");
  });

  it("mesclar não sobrescreve um programa que já existe aqui", async () => {
    const mine = { ...pplProgram(), name: "Meu PPL editado" };
    await db.programs.put(mine);
    await importBackup(
      {
        app: "augment",
        version: 1,
        exportedAt: "2026-11-01T00:00:00Z",
        settings: { ...DEFAULT_SETTINGS },
        sessions: [],
        programs: [pplProgram(), fullBody()],
      },
      "merge",
      { snapshot: false },
    );
    expect((await db.programs.get(PPL_PROGRAM_ID))!.name).toBe("Meu PPL editado");
    expect(await db.programs.get("fb")).toBeTruthy();
  });
});
