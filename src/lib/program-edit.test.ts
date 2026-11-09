import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { exById, setActiveProgram } from "../data/program";
import { TEMPLATES } from "../data/templates";
import { pplProgram } from "../data/templates/ppl";
import type { Program } from "../data/types";
import { activateProgram, db, deleteProgram, isProgram, loadActiveProgram, loadSettings, saveProgram } from "./db";
import { setsFor, weekFor, WEEK_RULES } from "./mesocycle";
import {
  addDay,
  addExercise,
  blankProgram,
  customExercise,
  dayCode,
  duplicateProgram,
  exerciseFromLibrary,
  fromTemplate,
  moveDay,
  moveExercise,
  programIssues,
  removeDay,
  removeExercise,
  toggleSupersetWithNext,
  updateDay,
  updateExercise,
} from "./program-edit";
import { historyOf } from "./progression";
import { plannedVolume } from "./sessions";

afterEach(() => setActiveProgram(pplProgram(0)));

const withTwo = (): Program => {
  let p = blankProgram("Teste", 1);
  const d = p.days[0].id;
  p = addExercise(p, d, (t) => exerciseFromLibrary("supino-reto-maquina", d, t));
  p = addExercise(p, d, (t) => exerciseFromLibrary("triceps-corda", d, t));
  return p;
};

describe("montador: dias", () => {
  it("adiciona, renomeia (com sigla), reordena e remove dias", () => {
    let p = blankProgram("Teste", 1);
    p = addDay(p, "Upper B");
    expect(p.days.map((d) => d.code)).toEqual(["TA", "UB"]);
    p = updateDay(p, p.days[1].id, { name: "Peito e tríceps" });
    expect(p.days[1].code).toBe("PT");
    p = moveDay(p, p.days[1].id, -1);
    expect(p.days[0].name).toBe("Peito e tríceps");
    expect(dayCode("lower")).toBe("LO");
  });

  it("remover um dia manda os exercícios para retired e não remove o último dia", () => {
    let p = withTwo();
    p = addDay(p, "B");
    const first = p.days[0];
    p = removeDay(p, first.id);
    expect(p.days.length).toBe(1);
    expect(p.retired?.map((e) => e.id).sort()).toEqual(first.exercises.map((e) => e.id).sort());
    expect(removeDay(p, p.days[0].id)).toBe(p);
  });
});

describe("montador: exercícios", () => {
  it("exercício da biblioteca vem com músculos, composto/isolado e ids únicos", () => {
    let p = withTwo();
    const d = p.days[0].id;
    const [supino, triceps] = p.days[0].exercises;
    expect(supino.muscles).toEqual(["peito"]);
    expect(supino.compound).toBe(true);
    expect(supino.stop).toBe("T");
    expect(triceps.compound).toBe(false);
    expect(triceps.iso).toBe(true);
    p = addExercise(p, d, (t) => exerciseFromLibrary("supino-reto-maquina", d, t));
    expect(p.days[0].exercises[2].id).toBe(`${supino.id}-2`);
  });

  it("exercício personalizado usa os músculos escolhidos e sinergistas no volume", () => {
    let p = blankProgram("Teste", 1);
    const d = p.days[0].id;
    p = addExercise(p, d, (t) => customExercise("Remada cavalinho", ["costas"], d, t, { compound: true, synergists: ["biceps"] }));
    const e = p.days[0].exercises[0];
    expect(e.lib).toBe("custom-remada-cavalinho");
    expect(e.muscleLabel).toBe("Costas");
    const vol = plannedVolume(2, true, undefined, p.days);
    expect(vol.costas).toBe(3);
    expect(vol.biceps).toBe(1.5);
  });

  it("updateExercise respeita limites e refaz os rótulos", () => {
    let p = withTwo();
    const id = p.days[0].exercises[0].id;
    p = updateExercise(p, id, { sets: 99, reps: [12, 8], rest: [90, 30], muscles: ["peito", "deltAnterior"], intensifier: "  " });
    const e = p.days[0].exercises[0];
    expect(e.sets).toBe(10);
    expect(e.reps).toEqual([12, 12]);
    expect(e.rest).toEqual([90, 90]);
    expect(e.restLabel).toBe("90 s");
    expect(e.muscleLabel).toBe("Peito e Deltoide anterior");
    expect(e.intensifier).toBeUndefined();
  });

  it("superset liga com o próximo, desfaz ao mover ou remover", () => {
    let p = withTwo();
    const [a, b] = p.days[0].exercises;
    p = toggleSupersetWithNext(p, a.id);
    expect(p.days[0].exercises[0].superset).toEqual({ with: b.id, order: 1 });
    expect(p.days[0].exercises[1].superset).toEqual({ with: a.id, order: 2 });
    const moved = moveExercise(p, a.id, 1);
    expect(moved.days[0].exercises.every((e) => !e.superset)).toBe(true);
    const removed = removeExercise(p, b.id);
    expect(removed.days[0].exercises[0].superset).toBeUndefined();
    expect(removed.retired?.[0].id).toBe(b.id);
    expect(removed.retired?.[0].superset).toBeUndefined();
  });

  it("aponta dia vazio e exercício sem músculo", () => {
    expect(programIssues(blankProgram("x", 1)).length).toBe(1);
    expect(programIssues(withTwo())).toEqual([]);
  });
});

describe("modelos e cópias", () => {
  it("todos os modelos são programas válidos, com ids únicos e todo exercício com músculo", () => {
    for (const t of TEMPLATES) {
      const p = t.make(1);
      expect(isProgram(p)).toBe(true);
      const ids = p.days.flatMap((d) => d.exercises.map((e) => e.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(programIssues(p)).toEqual([]);
    }
  });

  it("usar modelo e duplicar dão id novo e mantêm os ids dos exercícios", () => {
    const t = TEMPLATES.find((x) => x.id === "ul-4")!.make(1);
    const p = fromTemplate(t, { now: 5 });
    expect(p.id).not.toBe(t.id);
    expect(p.days.map((d) => d.id)).toEqual(t.days.map((d) => d.id));
    const c = duplicateProgram(p, 6);
    expect(c.name).toBe("Upper / Lower 4 dias (cópia)");
    expect(c.id).not.toBe(p.id);
  });
});

describe("programa fixo (sem mesociclo)", () => {
  it("semana 0: séries da ficha, sem deload e com a regra 'Programa fixo'", () => {
    setActiveProgram({ ...pplProgram(1), periodization: "fixed" });
    expect(weekFor("2026-09-21", "2026-11-02")).toBe(0);
    expect(WEEK_RULES[0].label).toBe("Programa fixo");
    const iso = { sets: 3, iso: true, up: true };
    expect(setsFor(iso, 0)).toBe(3);
    setActiveProgram(pplProgram(1));
    expect(weekFor("2026-09-21", "2026-11-02")).toBe(7);
  });
});

describe("salvar, ativar e apagar programas", () => {
  it("ativar troca o registro; salvar o ativo atualiza na hora; o ativo não pode ser apagado", async () => {
    await db.programs.clear();
    await db.kv.clear();
    await loadActiveProgram();
    const ul = fromTemplate(TEMPLATES.find((x) => x.id === "ul-4")!.make(1), { id: "meu-ul" });
    await saveProgram(ul);
    await activateProgram("meu-ul");
    expect((await loadSettings()).activeProgramId).toBe("meu-ul");
    expect(exById("ul-ub.supino-inclinado-halteres")?.sets).toBe(3);

    await saveProgram(updateExercise(ul, "ul-ub.supino-inclinado-halteres", { sets: 4 }));
    expect(exById("ul-ub.supino-inclinado-halteres").sets).toBe(4);

    await expect(deleteProgram("meu-ul")).rejects.toThrow();
    await deleteProgram("ppl-v2");
    expect(await db.programs.get("ppl-v2")).toBeUndefined();
  });
});

describe("histórico ao trocar de programa", () => {
  it("exercício novo continua do mesmo exercício da biblioteca; quem tem histórico próprio fica separado", () => {
    const old = pplProgram(1).days[0].exercises[0]; // push-a.supino-incl-halt
    const done = (id: string, date: string, exId: string, snapLib: string) => ({
      id,
      dayId: "x",
      date,
      week: 2,
      startedAt: Date.parse(date),
      finishedAt: Date.parse(date) + 1,
      status: "done" as const,
      exercises: [
        {
          exId,
          unit: "kg" as const,
          snap: { ...old, id: exId, lib: snapLib },
          sets: [{ id: id + "s", kind: "work" as const, weight: 30, reps: 10, done: true }],
        },
      ],
    });
    const ul = fromTemplate(TEMPLATES.find((x) => x.id === "ul-4")!.make(1));
    setActiveProgram(ul);
    const sessions = [done("a", "2026-10-01", old.id, old.lib)];
    // O supino do Upper B nunca foi feito: herda o histórico do supino do PPL (mesma biblioteca).
    expect(historyOf(sessions, "ul-ub.supino-inclinado-halteres").map((h) => h.session.id)).toEqual(["a"]);
    // Depois do primeiro treino com o id novo, o histórico próprio vale sozinho.
    const own = [...sessions, done("b", "2026-11-02", "ul-ub.supino-inclinado-halteres", old.lib)];
    expect(historyOf(own, "ul-ub.supino-inclinado-halteres").map((h) => h.session.id)).toEqual(["b"]);
    // Outro exercício da biblioteca não herda nada.
    expect(historyOf(sessions, "ul-ub.remada-baixa-neutra")).toEqual([]);
  });
});
