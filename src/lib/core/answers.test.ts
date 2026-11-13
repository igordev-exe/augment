import { describe, expect, it } from "vitest";
import { ANSWERS } from "../../data/answers";
import { PRINCIPLES } from "../../data/science";
import { findAnswer, guardTopic, levelOf, rank, stem, terms } from "./answers";
import { GOLDEN_IN, GOLDEN_OUT } from "./answers.golden";
import { norm } from "./intents";

/** Mede o buscador no conjunto de teste. Exportado para o relatório do console. */
function measure() {
  const misses: string[] = [];
  let top1 = 0;
  let top3 = 0;
  for (const g of GOLDEN_IN) {
    const r = findAnswer(g.q);
    const ranked = rank(g.q).map((h) => h.answer.id);
    const shown = r.kind === "answer" ? [r.answer.id] : r.kind === "maybe" ? r.options.map((a) => a.id) : [];
    if (r.kind === "answer" && r.answer.id === g.id) top1++;
    else
      misses.push(`[${r.kind}] "${g.q}" → esperado ${g.id}, veio ${shown.join(", ") || "nada"} (rank: ${ranked.slice(0, 3).join(", ")})`);
    if (shown.includes(g.id) || (r.kind !== "guard" && ranked.slice(0, 3).includes(g.id) && r.kind !== "none")) top3++;
  }
  let outWrong = 0;
  let guardMissed = 0;
  for (const g of GOLDEN_OUT) {
    const r = findAnswer(g.q);
    if (r.kind === "answer") {
      outWrong++;
      misses.push(`[fora] "${g.q}" respondeu ${r.answer.id}`);
    }
    if (g.guard && r.kind !== "guard") {
      guardMissed++;
      misses.push(`[trava] "${g.q}" não caiu na trava (${r.kind})`);
    }
  }
  return {
    top1: top1 / GOLDEN_IN.length,
    top3: top3 / GOLDEN_IN.length,
    outWrong: outWrong / GOLDEN_OUT.length,
    guardMissed,
    misses,
  };
}

describe("AUG.CORE — buscador de respostas prontas", () => {
  it("radical leve junta plural, gênero e conjugação comuns", () => {
    expect(stem("treinos")).toBe(stem("treino"));
    expect(stem("treinar")).toBe(stem("treino"));
    expect(stem("repeticoes")).toBe(stem("repeticao"));
    expect(stem("semanais")).toBe(stem("semana"));
    expect(terms("Perder peso rápido")).toEqual(terms("emagrecer rapido"));
  });

  it("base: ids únicos, ligações válidas e nível de evidência onde é obrigatório", () => {
    const ids = new Set(ANSWERS.map((a) => a.id));
    expect(ids.size).toBe(ANSWERS.length);
    for (const a of ANSWERS) {
      expect(a.asks.length, a.id).toBeGreaterThanOrEqual(4);
      for (const r of a.related ?? []) expect(ids.has(r), `${a.id} → ${r}`).toBe(true);
      if (a.principle)
        expect(
          PRINCIPLES.some((p) => p.id === a.principle),
          a.principle,
        ).toBe(true);
      if (a.topic !== "app") expect(levelOf(a), a.id).toBeDefined();
      expect(a.answer).not.toMatch(/\b(IA|intelig[eê]ncia artificial|modelo de linguagem|base de conhecimento)\b/i);
    }
  });

  it("o conjunto de teste não copia as perguntas da base e cita ids que existem", () => {
    const asks = new Set(ANSWERS.flatMap((a) => a.asks.map((q) => norm(q).replace(/[^a-z0-9 ]/g, ""))));
    const ids = new Set(ANSWERS.map((a) => a.id));
    for (const g of GOLDEN_IN) {
      expect(asks.has(norm(g.q).replace(/[^a-z0-9 ]/g, "")), g.q).toBe(false);
      expect(ids.has(g.id), g.id).toBe(true);
    }
  });

  it("a trava pega assuntos de saúde e deixa passar dúvidas comuns", () => {
    expect(guardTopic("senti dor no peito")).toBe("urgente");
    expect(guardTopic("tenho 15 anos posso treinar")).toBe("menor");
    expect(guardTopic("treino ha 9 anos")).toBeUndefined();
    expect(guardTopic("dieta de 2500 calorias")).toBeUndefined();
    expect(guardTopic("creatina faz mal pro rim")).toBeUndefined();
    expect(guardTopic("estou dolorido do treino")).toBeUndefined();
  });

  it("medição: top-1 ≥ 85%, top-3 ≥ 95%, fora do escopo respondido ≤ 5%, assunto proibido respondido = 0", () => {
    const m = measure();
    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    console.info(
      [
        `Buscador: ${GOLDEN_IN.length} dentro, ${GOLDEN_OUT.length} fora, ${ANSWERS.length} respostas`,
        `  top-1 ${pct(m.top1)} | top-3 ${pct(m.top3)} | fora respondido ${pct(m.outWrong)} | trava falhou ${m.guardMissed}`,
        ...m.misses.map((x) => `  ✗ ${x}`),
      ].join("\n"),
    );
    expect(m.guardMissed).toBe(0);
    expect(m.outWrong).toBeLessThanOrEqual(0.05);
    expect(m.top1).toBeGreaterThanOrEqual(0.85);
    expect(m.top3).toBeGreaterThanOrEqual(0.95);
  });
});
