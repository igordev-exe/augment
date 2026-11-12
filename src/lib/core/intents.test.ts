import { describe, expect, it } from "vitest";
import type { Session, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { detectMuscle, handleIntent, matchIntent } from "./intents";

const BASE_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  mesoStart: "2026-09-07",
  trainingDays: [1, 2, 3, 4, 5],
};

describe("AUG.CORE — Intenções Guiadas do Chat (intents.ts)", () => {
  it("reconhece e trata 'tempo_curto' gerando proposta de time-cap sem gravar direto", () => {
    const m = matchIntent("Hoje só tenho 40 minutos para treinar");
    expect(m?.kind).toBe("tempo_curto");
    expect(m?.minutes).toBe(40);

    const res = handleIntent("Hoje só tenho 40 min", {
      sessions: [],
      settings: BASE_SETTINGS,
      today: "2026-09-14",
    });
    expect(res.matched).toBe(true);
    expect(res.proposal?.constraint?.kind).toBe("time-cap");
    expect(res.reply).toContain("Proposta: modo 40 min");
  });

  it("reconhece e trata 'equipamento_restrito' propondo trocas automáticas para halteres", () => {
    const res = handleIntent("Estou viajando e só tenho halteres hoje", {
      sessions: [],
      settings: BASE_SETTINGS,
      today: "2026-09-14",
    });
    expect(res.matched).toBe(true);
    expect(res.intent?.kind).toBe("equipamento_restrito");
    expect(res.proposal?.constraint?.kind).toBe("equipment");
    expect(res.reply).toContain("Proposta: treinar só com");
  });

  it("reconhece e trata 'dor_articular' com prioridade e distingue ombro lateral de ombro anterior", () => {
    expect(detectMuscle("Dor no ombro lateral ao levantar o braço")).toBe("deltLateral");
    expect(detectMuscle("Dor no ombro ao empurrar")).toBe("deltAnterior");
    expect(matchIntent("Estou com dor no joelho")?.muscle).toBe("quadriceps");

    // Se a mesma frase tem dor e tempo, dor articular vem primeiro por segurança
    expect(matchIntent("Só tenho 40 min e estou com dor no ombro")?.kind).toBe("dor_articular");

    const res = handleIntent("Estou com dor forte no ombro hoje", {
      sessions: [],
      settings: BASE_SETTINGS,
      today: "2026-09-14",
    });
    expect(res.matched).toBe(true);
    expect(res.intent?.kind).toBe("dor_articular");
    expect(res.intent?.severity).toBe("forte");
    expect(res.proposal?.constraint?.kind).toBe("pain");
    expect(res.reply).toContain("Proposta: proteger");
  });

  it("reconhece 'faltei_treino', 'travou_exercicio' e 'explicar_carga', e deixa perguntas abertas para o modelo", () => {
    const miss = handleIntent("Faltei ontem no treino, o que eu faço?", {
      sessions: [],
      settings: BASE_SETTINGS,
      today: "2026-09-15",
    });
    expect(miss.matched).toBe(true);
    expect(miss.intent?.kind).toBe("faltei_treino");
    expect(miss.reply).toContain("nunca pula treino");

    const stall = handleIntent("Travei no supino inclinado", {
      sessions: [],
      settings: BASE_SETTINGS,
      today: "2026-09-15",
    });
    expect(stall.matched).toBe(true);
    expect(stall.intent?.kind).toBe("travou_exercicio");
    expect(stall.reply).toContain("travou. O que pode estar pesando");

    const sessions: Session[] = [
      {
        id: "s1",
        dayId: "push-a",
        date: "2026-09-10",
        week: 2,
        startedAt: 1000,
        finishedAt: 2000,
        status: "done",
        exercises: [
          {
            exId: "push-a.supino-incl-halt",
            unit: "kg",
            sets: [
              { id: "1", kind: "work", weight: 28, reps: 10, done: true },
              { id: "2", kind: "work", weight: 28, reps: 10, done: true },
              { id: "3", kind: "work", weight: 28, reps: 10, done: true },
              { id: "4", kind: "work", weight: 28, reps: 10, done: true },
            ],
          },
        ],
      },
    ];
    const explain = handleIntent("Por que 30 kg no supino?", {
      sessions,
      settings: BASE_SETTINGS,
      today: "2026-09-15",
    });
    expect(explain.matched).toBe(true);
    expect(explain.intent?.kind).toBe("explicar_carga");
    expect(explain.reply).toContain("Subida");

    // Não deve capturar números soltos como explicar_carga ou tempo_curto
    expect(
      handleIntent("Por que treinar 5 dias por semana?", {
        sessions: [],
        settings: BASE_SETTINGS,
        today: "2026-09-15",
      }).matched,
    ).toBe(false);
    expect(
      handleIntent("Dormi 90 min à tarde hoje", {
        sessions: [],
        settings: BASE_SETTINGS,
        today: "2026-09-15",
      }).matched,
    ).toBe(false);

    const open = handleIntent("Qual a diferença entre creatina monohidratada e micronizada?", {
      sessions: [],
      settings: BASE_SETTINGS,
      today: "2026-09-15",
    });
    expect(open.matched).toBe(false);
  });
});
