import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { plannedVolume, sessionPeaks } from "../../lib/sessions";
import { coachSystem } from "../../lib/coach/context";
import { PRINCIPLES, SCIENCE, scienceText } from "../science";
import type { MuscleId } from "../types";
import { TEMPLATES } from "./index";

// Modelos do banco de fontes: o volume e o teto por sessão que o documento promete, conferidos no programa montado.

const MAIN: MuscleId[] = ["peito", "costas", "quadriceps", "posterior", "gluteo", "biceps", "triceps"];

describe("modelos prontos", () => {
  it("todo músculo principal passa da dose mínima efetiva por semana", () => {
    for (const t of TEMPLATES) {
      const vol = plannedVolume(2, true, undefined, t.make(1).days);
      for (const m of MAIN) expect(vol[m], `${t.id} / ${m}`).toBeGreaterThanOrEqual(SCIENCE.volume.minEffective);
    }
  });

  it("nenhum modelo novo passa do teto de ~11 séries fracionadas de um músculo num treino, nem nas semanas de pico", () => {
    for (const t of TEMPLATES.filter((x) => x.id !== "ppl-v2")) {
      expect(sessionPeaks(5, undefined, t.make(1).days), t.id).toEqual([]);
    }
  });

  it("o teto aparece quando um dia concentra demais", () => {
    const ul = TEMPLATES.find((t) => t.id === "ul-4")!.make(1);
    const lb = ul.days.find((d) => d.id === "ul-lb")!;
    const heavy = { ...lb, exercises: lb.exercises.map((e) => (e.lib === "elevacao-pelvica" ? { ...e, sets: 10 } : e)) };
    expect(sessionPeaks(2, undefined, [heavy]).map((p) => p.muscle)).toContain("gluteo");
  });

  it("modelos da biblioteca completa têm nome em português e sinergistas de puxar corrigidos", () => {
    for (const t of TEMPLATES) {
      for (const ex of t.make(1).days.flatMap((d) => d.exercises)) {
        if (!ex.lib.startsWith("db-")) continue;
        expect(ex.name, ex.id).not.toMatch(/^[A-Z][a-z]+ [A-Z]/); // não ficou o nome original em inglês
        if (/Row|Pull/.test(ex.lib)) expect(ex.synergists, ex.id).toEqual(["biceps", "deltPosterior"]);
      }
    }
  });

  it("agrupados: base e ênfase em pernas e glúteos, cada um com nível", () => {
    expect(new Set(TEMPLATES.map((t) => t.group))).toEqual(new Set(["base", "gluteo"]));
    expect(TEMPLATES.every((t) => t.level.length > 0)).toBe(true);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});

describe("base científica do banco de fontes", () => {
  it("princípios novos com fonte, ids únicos e dentro do prompt do treinador", () => {
    const ids = PRINCIPLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["acsm-2026", "teto-sessao", "divisao", "sexos-hipertrofia", "ciclo-menstrual", "equipamento", "bfr"]) {
      const p = PRINCIPLES.find((x) => x.id === id);
      expect(p, id).toBeTruthy();
      expect(p!.fontes.length, id).toBeGreaterThan(0);
    }
    const sys = coachSystem();
    expect(sys).toContain(scienceText());
    expect(sys).toContain("ACSM");
    expect(sys).toContain("Ramos-Campo");
    expect(sys).toContain("Colenso-Semple");
  });
});
