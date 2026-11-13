import { describe, expect, it } from "vitest";
import type { BodyEntry, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { dataAnswer, detectExercise, latestWeight, matchData, type AnswerData } from "./data-answers";
import { isUrgent, localReply } from "./localchat";
import { matchIntent } from "./intents";
import { simulateOperator } from "./operator";

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-09-07", trainingDays: [1, 2, 3, 4, 5] };
const TODAY = "2026-10-21";
const NOW = Date.parse(`${TODAY}T08:00:00`);

const sessions = simulateOperator({
  seed: 7,
  weeks: 6,
  startDate: "2026-09-07",
  trainingDays: [1, 2, 3, 4, 5],
  preferredHour: 18,
  trueRestRatio: 1,
  trueMuscleRecovery: {},
}).filter((s) => s.date < TODAY);

const bodyLog: BodyEntry[] = Array.from({ length: 21 }, (_, i) => {
  const d = new Date(Date.parse("2026-10-01T12:00:00") + i * 86400000);
  return { date: d.toISOString().slice(0, 10), weightKg: 80 - i * 0.05 } as BodyEntry;
});

const FULL: AnswerData = { sessions, settings: SETTINGS, today: TODAY, bodyLog, now: NOW };
const EMPTY: AnswerData = { sessions: [], settings: SETTINGS, today: TODAY, bodyLog: [], now: NOW };

describe("AUG.CORE — respostas com os dados da pessoa", () => {
  it("reconhece exercício do programa e da biblioteca, em pt e en", () => {
    expect(detectExercise("qual meu recorde no supino inclinado")?.exId).toBeTruthy();
    expect(detectExercise("como faz rosca martelo")?.libId).toBeTruthy();
    expect(detectExercise("hammer curl")?.libId).toMatch(/hammer|martelo/i);
    expect(detectExercise("quanto tempo descansar")).toBeUndefined();
  });

  it("separa pergunta de dados de pergunta geral", () => {
    expect(matchData("qual meu recorde no supino?")?.kind).toBe("recorde");
    expect(matchData("o que troco pelo leg press")?.kind).toBe("trocar");
    expect(matchData("posso treinar peito hoje?")?.kind).toBe("pronto");
    expect(matchData("quantas series de costas eu fiz essa semana")?.kind).toBe("volume");
    expect(matchData("quantas series por musculo na semana")).toBeNull();
    expect(matchData("quanta proteina devo comer")).toBeNull();
    expect(matchData("como fazer backup")).toBeNull();
  });

  it("recorde usa a régua do projeto e cita a série de origem", () => {
    const r = dataAnswer("recorde no supino inclinado", FULL)!;
    expect(r.kind).toBe("recorde");
    expect(r.text).toMatch(/máximo estimado.*\*\*\d+(,\d)? kg\*\*/);
    expect(r.route).toMatch(/^\/exercicios\//);
  });

  it("continuação curta herda o tipo anterior com outra entidade", () => {
    const first = localReply("qual meu recorde no supino inclinado?", FULL);
    expect(first.meta.kind).toBe("data");
    const next = localReply("e no hack?", FULL, first.ctx);
    expect(next.meta.kind).toBe("data");
    expect(next.text).toMatch(/Hack/i);
  });

  it("cada tipo responde com dados e sem dados, sem número inventado", () => {
    const qs = [
      "qual meu recorde no supino inclinado",
      "ultima vez no hack",
      "o que troco pela cadeira extensora",
      "como faz rosca martelo",
      "o que o terra romeno trabalha",
      "qual meu proximo treino",
      "quando treino peito",
      "em que semana estou",
      "posso treinar peito hoje",
      "quantas series de peito eu fiz essa semana",
      "meu peso ta caindo?",
      "como foi minha semana",
      "qual minha sequencia",
    ];
    for (const q of qs) {
      const full = dataAnswer(q, FULL);
      const empty = dataAnswer(q, EMPTY);
      expect(full, q).not.toBeNull();
      expect(empty, q).not.toBeNull();
      expect(full!.text.length, q).toBeGreaterThan(20);
      expect(empty!.text, q).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(full!.text, q).not.toMatch(/NaN|undefined|null|Infinity/);
    }
    expect(dataAnswer("qual meu recorde no supino inclinado", EMPTY)!.text).toMatch(/Ainda não/);
    expect(dataAnswer("meu peso ta caindo?", EMPTY)!.text).toMatch(/Ainda não há peso/);
    expect(dataAnswer("meu peso ta caindo?", FULL)!.text).toMatch(/caindo/);
  });

  it("proteína usa o peso da pessoa quando há registro, e pede o registro quando não há", () => {
    const w = latestWeight(bodyLog)!;
    const text = localReply("quanta proteina eu devo comer por dia?", FULL).text;
    expect(text).toContain(`${Math.round(w * 1.6)} a ${Math.round(w * 2.2)} g de proteína por dia`);
    expect(localReply("quanta proteina eu devo comer por dia?", EMPTY).text).toMatch(/Registre o seu peso/);
  });

  it("assunto proibido ganha de tudo, inclusive de pergunta com exercício", () => {
    const r = localReply("tenho hernia, como faz o terra romeno?", FULL);
    expect(r.meta.kind).toBe("guard");
  });

  it("urgência passa na frente das intenções: dor no peito não vira proposta de proteger o peitoral", () => {
    for (const q of ["senti dor no peito no supino", "dor no peito e falta de ar", "desmaiei no agachamento"]) {
      expect(isUrgent(q), q).toBe(true);
      expect(localReply(q, FULL).meta.kind, q).toBe("guard");
    }
    // A intenção ainda casaria sozinha: é por isso que a tela checa `isUrgent` antes de `handleIntent`.
    expect(matchIntent("dor no peito e falta de ar")?.kind).toBe("dor_articular");
    // Dor articular comum continua indo para a intenção.
    expect(isUrgent("dor no ombro no desenvolvimento")).toBe(false);
  });

  it("não sabe: diz que não sabe e oferece levar a pergunta para outro chat", () => {
    const r = localReply("qual a capital da franca", FULL);
    expect(r.meta.kind).toBe("none");
    expect(r.meta.handoff).toBe(true);
    expect(r.meta.chips?.length).toBeGreaterThan(0);
  });
});
