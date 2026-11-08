import { describe, expect, it } from "vitest";
import { exerciseFromLibrary } from "../lib/program-edit";
import { plannedVolume } from "../lib/sessions";
import { LIBRARY } from "./library";
import { EXTENDED, EXT_BY_ID, extendedImages, libraryMuscles, loadInstructions } from "./library-extended";
import { MUSCLE_ORDER } from "./program";
import IMAGES from "./exercise-images.json";

// Biblioteca ampliada (free-exercise-db): o que o import garante e o que o montador faz com ela.

describe("biblioteca ampliada", () => {
  it("ids únicos com prefixo db-, músculos do app e nada repetido da curada", () => {
    expect(EXTENDED.length).toBeGreaterThan(400);
    const ids = EXTENDED.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^db-[A-Za-z0-9_-]+$/.test(id))).toBe(true);
    const valid = new Set(MUSCLE_ORDER);
    for (const e of EXTENDED) {
      expect(e.muscles.length).toBeGreaterThan(0);
      expect([...e.muscles, ...e.synergists].every((m) => valid.has(m))).toBe(true);
      expect(e.synergists.some((m) => e.muscles.includes(m))).toBe(false);
      if (!e.compound) expect(e.synergists).toEqual([]);
    }
    const curatedSrc = new Set(Object.values(IMAGES as Record<string, string>));
    expect(EXTENDED.some((e) => curatedSrc.has(e.src))).toBe(false);
    expect(LIBRARY.some((l) => EXT_BY_ID[l.id])).toBe(false);
  });

  it("ombro vira deltoide pelo nome do exercício", () => {
    const by = (name: string) => EXTENDED.find((e) => e.name === name)!;
    expect(by("Cable Rear Delt Fly").muscles).toEqual(["deltPosterior"]);
    expect(by("Seated Side Lateral Raise").muscles).toEqual(["deltLateral"]);
    expect(by("Bent Over Low-Pulley Side Lateral").muscles).toEqual(["deltPosterior"]);
  });

  it("no montador, vira exercício com músculos, tipo e sinergistas do banco", () => {
    const e = EXTENDED.find((x) => x.compound && x.synergists.length)!;
    const ex = exerciseFromLibrary(e.id, "d1", new Set());
    expect(ex.lib).toBe(e.id);
    expect(ex.name).toBe(e.name);
    expect(ex.muscles).toEqual(e.muscles);
    expect(ex.compound).toBe(true);
    expect(ex.synergists).toEqual(e.synergists);
    expect(ex.id).toMatch(/^d1\.db-/);
    const vol = plannedVolume(2, true, undefined, [{ id: "d1", name: "D", code: "D", weekday: 1, focus: "", notes: [], exercises: [ex] }]);
    expect(vol[e.synergists[0]]).toBe(ex.sets * 0.5);
    expect(libraryMuscles(e.id)).toEqual(e.muscles);
  });

  it("imagens apontam para o repositório e o passo a passo carrega sob demanda", async () => {
    const e = EXTENDED.find((x) => x.images >= 2)!;
    expect(extendedImages(e.id)).toEqual(
      [0, 1].map((i) => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${e.src}/${i}.jpg`),
    );
    expect((await loadInstructions(e.id)).length).toBeGreaterThan(0);
    expect(await loadInstructions("db-nao-existe")).toEqual([]);
  });
});
