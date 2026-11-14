import { describe, expect, it } from "vitest";
import { FULL_DATA, NOW_MS } from "./chat.fixture";
import {
  forgetAlias,
  learnAlias,
  lookupAlias,
  MISS_MAX,
  mergeMisses,
  missReport,
  recordMiss,
  sanitizeAliases,
  sanitizeMisses,
} from "./learned";
import { coreReply } from "./localchat";

describe("chat potente, bloco A: o que o chat aprende", () => {
  it("registro de não entendidas soma, ordena e respeita o teto", () => {
    let list = recordMiss([], "Qual a cor do céu?", "none", "2026-11-01");
    list = recordMiss(list, "qual a cor do ceu?", "none", "2026-11-02");
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(2);
    expect(list[0].last).toBe("2026-11-02");
    for (let i = 0; i < MISS_MAX + 20; i++) list = recordMiss(list, `pergunta ${i}`, "maybe", "2026-11-03");
    expect(list).toHaveLength(MISS_MAX);
    expect(missReport(mergeMisses(list, list))[0].count).toBeGreaterThanOrEqual(2);
    expect(sanitizeMisses([{ text: 1 }, null, ...list.slice(0, 2)])).toHaveLength(2);
  });

  it("apelido leva a frase ensinada para a pergunta escolhida, e esquecer tira", () => {
    const list = learnAlias([], "qnto eu levantei no supino mesmo", "Qual meu recorde no supino?", "2026-11-14");
    expect(lookupAlias(list, "Qnto eu levantei no supino mesmo?")?.to).toBe("Qual meu recorde no supino?");
    expect(learnAlias([], "oi", "oi", "2026-11-14")).toHaveLength(0);
    expect(forgetAlias(list)).toHaveLength(0);
    expect(sanitizeAliases([{ key: 1 }, ...list])).toHaveLength(1);
  });

  it("no chat: apelido responde direto; 'esquece esse apelido' pede para a tela apagar", () => {
    const aliases = learnAlias([], "quanto eu levantei no supino mesmo", "qual meu recorde no supino", "2026-11-14");
    const without = coreReply("quanto eu levantei no supino mesmo", FULL_DATA, {}, { now: NOW_MS });
    const withAlias = coreReply("quanto eu levantei no supino mesmo", { ...FULL_DATA, aliases }, {}, { now: NOW_MS });
    const direct = coreReply("qual meu recorde no supino", FULL_DATA, {}, { now: NOW_MS });
    expect(withAlias.text).toBe(direct.text);
    expect(withAlias.meta.alias).toBeTruthy();
    expect(without.meta.alias).toBeUndefined();
    expect(coreReply("esquece esse apelido", FULL_DATA, {}, { now: NOW_MS }).forgetAlias).toBe(true);
  });

  it("apelido nunca passa por cima da trava de saúde", () => {
    const aliases = learnAlias([], "to com dor no peito", "qual meu recorde no supino", "2026-11-14");
    expect(coreReply("to com dor no peito", { ...FULL_DATA, aliases }, {}, { now: NOW_MS }).layer).toBe("guard");
  });

  it("frase livre que não grava diz como entendeu; dúvida vira pergunta com botões", () => {
    const r = coreReply("me da 2 min de descanso ai", FULL_DATA, {}, { now: NOW_MS });
    expect(r.action).toEqual({ kind: "timer-start", seconds: 120 });
    // Leitura de nota alta não repete o pedido; a de nota média ("90s" sozinho) diz como entendeu.
    expect(r.meta.understood).toBeUndefined();
    expect(coreReply("90s", FULL_DATA, {}, { now: NOW_MS }).meta.understood).toBe("Entendi: descanso de 1 min 30 s.");
    const doubt = coreReply("10 com 20", FULL_DATA, {}, { now: NOW_MS });
    expect(doubt.layer === "maybe" || doubt.layer === "command").toBe(true);
    expect(coreReply("nao anota 8 com 80", FULL_DATA, {}, { now: NOW_MS }).proposal).toBeUndefined();
  });
});

describe("chat potente, bloco A: esquecer atalho não pega resposta comum", () => {
  it("'não, isso' e 'desfaz isso' não apagam atalho", () => {
    for (const q of ["nao isso", "desfaz isso", "apaga isso", "esquece isso"])
      expect(coreReply(q, FULL_DATA, {}, { now: NOW_MS }).forgetAlias).toBeUndefined();
  });
});
