import { describe, expect, it } from "vitest";
import { GOLDEN_WHATIF, GOLDEN_WHY } from "./reason.golden";
import { FULL_DATA, NOW_MS } from "./chat.fixture";
import { coreReply } from "./localchat";
import { whyAnswer } from "./why";
import { whatIfAnswer } from "./whatif";
import { detectExercise, historyFor, type AnswerData } from "./data-answers";
import { personalEpley, predictFromPrevious } from "./live";
import { workSets } from "../progression";
import { weightTrend } from "../visual";
import { mondayOf } from "../dates";

// Bloco C do chat potente: "por quê", "e se", resumo, de onde saiu o número.
// Partida (14/11/2026): não existia: 0 de 50 "por quê" e 0 de 40 "e se" com o tipo certo (o chat caía nas respostas
// prontas ou no "não sei").

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const EMPTY: AnswerData = { ...FULL_DATA, sessions: [], bodyLog: [] };

describe("chat potente, bloco C: por quê", () => {
  it("tipo certo ≥ 85%", () => {
    const misses: string[] = [];
    let ok = 0;
    for (const g of GOLDEN_WHY) {
      const r = whyAnswer(g.q, FULL_DATA);
      if (r?.topic === g.topic) ok++;
      else misses.push(`"${g.q}" → esperado ${g.topic}, veio ${r?.topic ?? "nada"}`);
    }
    console.info(
      [`Por quê: ${GOLDEN_WHY.length} | tipo certo ${pct(ok / GOLDEN_WHY.length)}`, ...misses.map((x) => `  ✗ ${x}`)].join("\n"),
    );
    expect(ok / GOLDEN_WHY.length).toBeGreaterThanOrEqual(0.85);
  });

  it("causa sem dado: 0 (sem treino, nenhuma explicação lista fator)", () => {
    for (const g of GOLDEN_WHY) {
      const r = whyAnswer(g.q, EMPTY);
      if (!r || ["descanso", "exercicio", "series", "sequencia", "posto"].includes(r.topic)) continue;
      expect(r.text, g.q).not.toMatch(/^1\. /m);
    }
  });

  it("'por quê?' logo depois de uma resposta usa o assunto anterior", () => {
    const a = coreReply("qual meu recorde no supino inclinado", FULL_DATA, {}, { now: NOW_MS });
    const b = coreReply("por que?", FULL_DATA, a.ctx, { now: NOW_MS + 1000 });
    expect(b.layer).toBe("why");
    expect(b.text.toLowerCase()).toContain("supino inclinado");
  });
});

describe("chat potente, bloco C: e se", () => {
  it("tipo certo ≥ 85%", () => {
    const misses: string[] = [];
    let ok = 0;
    for (const g of GOLDEN_WHATIF) {
      const r = whatIfAnswer(g.q, FULL_DATA);
      if (r?.topic === g.topic) ok++;
      else misses.push(`"${g.q}" → esperado ${g.topic}, veio ${r?.topic ?? "nada"}`);
    }
    console.info(
      [`E se: ${GOLDEN_WHATIF.length} | tipo certo ${pct(ok / GOLDEN_WHATIF.length)}`, ...misses.map((x) => `  ✗ ${x}`)].join("\n"),
    );
    expect(ok / GOLDEN_WHATIF.length).toBeGreaterThanOrEqual(0.85);
  });

  it("número igual ao da conta independente (carga a mais e peso futuro)", () => {
    const ex = detectExercise("supino inclinado")!;
    const hist = historyFor(FULL_DATA, ex);
    const sets = workSets(hist[hist.length - 1].entry, false);
    const top = sets.reduce((b, s) => (s.weight! > b.weight! ? s : b));
    const reps = predictFromPrevious(top, top.weight! + 5, 0, personalEpley(hist).k)!;
    const r = whatIfAnswer("e se eu colocar 5 kg a mais no supino inclinado", FULL_DATA)!;
    expect(r.text).toContain(`${Math.max(1, reps - 1)} a ${reps + 1} reps`);
    const t = weightTrend(FULL_DATA.bodyLog)!;
    const w = whatIfAnswer("quanto vou pesar em 4 semanas", FULL_DATA)!;
    const mid = t.current + t.kgPerWeek * 4;
    expect(w.text).toContain(String(Math.round((mid - Math.max(0.5, Math.abs(t.kgPerWeek * 4) * 0.5)) * 2) / 2).replace(".", ","));
  });

  it("'e se eu treinar 3 dias' propõe a mudança, não grava", () => {
    const r = coreReply("e se eu treinar so 3 dias", FULL_DATA, {}, { now: NOW_MS });
    expect(r.layer).toBe("whatif");
    expect(r.proposal?.source).toBe("command");
    expect(r.ctx.proposalOpen).toBe(true);
  });

  it("'monta um treino de 40 minutos' vira o plano do dia (intenção de tempo curto)", () => {
    const r = coreReply("monta um treino de 40 minutos hoje", FULL_DATA, {}, { now: NOW_MS });
    expect(r.layer).toBe("intent");
  });
});

describe("chat potente, bloco C: resumo e de onde saiu o número", () => {
  it("resumo confere com a contagem independente da semana", () => {
    const r = coreReply("como estou?", FULL_DATA, {}, { now: NOW_MS });
    const n = FULL_DATA.sessions.filter(
      (s) => s.status === "done" && s.date >= mondayOf(FULL_DATA.today) && s.date <= FULL_DATA.today,
    ).length;
    expect(r.layer).toBe("assist");
    expect(r.text).toContain(`${n} de ${FULL_DATA.settings.trainingDays.length} treinos`);
  });

  it("'de onde saiu esse número' explica a conta da consulta anterior", () => {
    const a = coreReply("quantas series de peito fiz em outubro", FULL_DATA, {}, { now: NOW_MS });
    const b = coreReply("de onde saiu esse numero?", FULL_DATA, a.ctx, { now: NOW_MS + 1000 });
    expect(b.text).toMatch(/treinos? concluídos?/);
    expect(b.text).toMatch(/meia/);
  });

  it("'o que você sabe fazer' sai da lista real, com exercício da pessoa", () => {
    const r = coreReply("o que voce sabe fazer", FULL_DATA, {}, { now: NOW_MS });
    expect(r.layer).toBe("assist");
    expect(r.text).toMatch(/anota 8 com 80/);
  });
});

describe("chat potente, blocos C e E: botões do estado, aliás e profundidade", () => {
  it("resposta com dados traz botões que saem do estado e, no máximo, um 'Aliás' por assunto por dia", () => {
    const qs = [
      "qual meu recorde no supino inclinado",
      "qual meu recorde na puxada",
      "qual meu recorde no leg press",
      "qual meu recorde no hack",
    ];
    for (const q of qs) {
      const r = coreReply(q, FULL_DATA, {}, { now: NOW_MS });
      expect((r.meta.chips ?? []).length).toBeLessThanOrEqual(3);
      expect(r.text.match(/Aliás/g)?.length ?? 0).toBeLessThanOrEqual(1);
      if (/Aliás/.test(r.text)) {
        const again = coreReply(q, FULL_DATA, r.ctx, { now: NOW_MS + 1000 });
        expect(again.text).not.toMatch(/Aliás/);
      }
    }
  });

  it("'resumindo' e 'explica melhor' refazem a última resposta pronta noutro tamanho", () => {
    const a = coreReply("quanta proteina devo comer por dia", FULL_DATA, {}, { now: NOW_MS });
    expect(a.layer).toBe("answer");
    const short = coreReply("resumindo", FULL_DATA, a.ctx, { now: NOW_MS + 1000 });
    const long = coreReply("explica melhor", FULL_DATA, a.ctx, { now: NOW_MS + 1000 });
    expect(short.text.length).toBeLessThan(a.text.length);
    expect(long.text.length).toBeGreaterThan(a.text.length);
  });
});
