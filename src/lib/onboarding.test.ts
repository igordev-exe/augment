import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { activeProgram } from "../data/program";
import { PPL_PROGRAM_ID } from "../data/templates/ppl";
import { db, loadActiveProgram, loadSettings } from "./db";
import { applyOnboarding, recommendTemplate, skipOnboarding } from "./onboarding";

const pick = (days: number, level: "iniciante" | "intermediario" | "avancado", focus: "geral" | "gluteo" = "geral") =>
  recommendTemplate({ days, level, focus }).template.id;

describe("primeiro uso: qual programa sugerir", () => {
  it("segue os dias por semana e o nível", () => {
    expect(pick(3, "iniciante")).toBe("fb-3");
    expect(pick(4, "intermediario")).toBe("ul-4");
    expect(pick(4, "avancado")).toBe("ul-forca");
    expect(pick(5, "intermediario")).toBe("ppl-v2");
    expect(pick(6, "avancado")).toBe("ppl-6");
  });

  it("iniciante não passa de 4 dias, e a tela explica por quê", () => {
    const r = recommendTemplate({ days: 6, level: "iniciante", focus: "geral" });
    expect(r.template.id).toBe("ul-4");
    expect(r.note).toMatch(/4 treinos/);
    expect(recommendTemplate({ days: 4, level: "iniciante", focus: "geral" }).note).toBe("");
  });

  it("foco em glúteos usa a variante de cada divisão", () => {
    expect(pick(3, "iniciante", "gluteo")).toBe("fb-3-gluteo");
    expect(pick(5, "intermediario", "gluteo")).toBe("ul-4-gluteo");
    expect(pick(6, "avancado", "gluteo")).toBe("ppl-6-gluteo");
  });
});

describe("primeiro uso: aplicar a escolha", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await loadActiveProgram();
  });

  it("troca o PPL padrão pelo programa escolhido, com os dias e o nome", async () => {
    expect(activeProgram().id).toBe(PPL_PROGRAM_ID);
    const p = await applyOnboarding("fb-3", "  Ana ");
    const s = await loadSettings();
    expect(s).toMatchObject({ operator: "Ana", trainingDays: [1, 3, 5], onboarded: true, activeProgramId: p.id });
    expect(activeProgram().id).toBe(p.id);
    expect((await db.programs.toArray()).map((x) => x.id)).toEqual([p.id]);
  });

  it("escolher o PPL 5 dias mantém o programa que já existe", async () => {
    const p = await applyOnboarding("ppl-v2", "");
    expect(p.id).toBe(PPL_PROGRAM_ID);
    expect(await db.programs.count()).toBe(1);
  });

  it("pular não mexe no programa e não pergunta de novo", async () => {
    await skipOnboarding();
    expect((await loadSettings()).onboarded).toBe(true);
    expect(activeProgram().id).toBe(PPL_PROGRAM_ID);
  });
});
