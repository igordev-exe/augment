import { describe, expect, it } from "vitest";
import type { BodyEntry, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { matchCommand, runCommand, WRITE_COMMANDS, type CommandId } from "./commands";
import { GOLDEN_COMMANDS, GOLDEN_GUARD_WIDE, GOLDEN_OUT_WIDE, GOLDEN_QUERIES, GOLDEN_SMALLTALK } from "./chat.golden";
import { GOLDEN_IN, GOLDEN_OUT } from "./answers.golden";
import { coreReply, matchSmalltalk } from "./localchat";
import { PRINCIPLES } from "../../data/science";
import { ANSWERS } from "../../data/answers";
import { GLOSSARY } from "../../data/glossary";
import { glossaryAnswer, principleAnswer, principleQuestion } from "./generated";
import { parseQuery, runQuery, type Query } from "./query";
import { exOf } from "../../data/program";
import { SYNERGISTS } from "../../data/science";
import { workSets } from "../progression";
import type { AnswerData, ExerciseRef } from "./data-answers";
import { norm } from "./intents";
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
const bodyLog: BodyEntry[] = Array.from({ length: 21 }, (_, i) => ({
  id: `b${i}`,
  date: new Date(Date.parse("2026-10-01T12:00:00") + i * 86400000).toISOString().slice(0, 10),
  weightKg: 80 - i * 0.05,
}));
export const FULL: AnswerData = { sessions, settings: SETTINGS, today: TODAY, bodyLog, now: NOW };

/** Valor de um campo do jeito que o conjunto de teste escreve. */
function fieldValue(name: string, v: unknown): string | number | undefined {
  if (name === "tela") return (v as { route: string }).route;
  if (name === "exercicio") return norm((v as ExerciseRef).name);
  if (name === "carga") return (v as { value: number }).value;
  return v as string | number;
}

function measureCommands() {
  const misses: string[] = [];
  let intentOk = 0;
  let fieldsTotal = 0;
  let fieldsOk = 0;
  let badWrites = 0;
  for (const g of GOLDEN_COMMANDS) {
    const m = matchCommand(g.q);
    const got = m?.id ?? null;
    if (got === g.id) intentOk++;
    else misses.push(`[comando] "${g.q}" → esperado ${g.id ?? "nenhum"}, veio ${got ?? "nenhum"}`);
    if (g.fields && m && got === g.id) {
      fieldsTotal++;
      const bad = Object.entries(g.fields).filter(([k, want]) => {
        const v = fieldValue(k, m.values[k]);
        return typeof want === "string" && k === "exercicio" ? !String(v ?? "").includes(want) : v !== want;
      });
      if (!bad.length) fieldsOk++;
      else misses.push(`[campo] "${g.q}" → ${bad.map(([k, w]) => `${k}: esperado ${w}, veio ${fieldValue(k, m.values[k])}`).join("; ")}`);
    } else if (g.fields) fieldsTotal++;
    // Gravação indevida: proposta vinda de algo que não é comando de gravar, ou de uma frase que não é comando.
    if (m) {
      const r = runCommand(m, FULL, g.q, { now: NOW, timerActive: true });
      if (r.proposal && (!WRITE_COMMANDS.includes(m.id as CommandId) || g.id === null)) {
        badWrites++;
        misses.push(`[gravação] "${g.q}" propôs ${r.proposal.kind}`);
      }
    }
  }
  return {
    n: GOLDEN_COMMANDS.length,
    intent: intentOk / GOLDEN_COMMANDS.length,
    fields: fieldsTotal ? fieldsOk / fieldsTotal : 1,
    badWrites,
    misses,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

describe("AUG.CORE — chat amplo: comandos", () => {
  it("medição dos comandos: intenção ≥ 95%, campos ≥ 90%, gravação indevida 0", () => {
    const m = measureCommands();
    console.info(
      [
        `Comandos: ${m.n} frases | intenção ${pct(m.intent)} | campos ${pct(m.fields)} | gravação indevida ${m.badWrites}`,
        ...m.misses.map((x) => `  ✗ ${x}`),
      ].join("\n"),
    );
    expect(m.badWrites).toBe(0);
    expect(m.intent).toBeGreaterThanOrEqual(0.95);
    expect(m.fields).toBeGreaterThanOrEqual(0.9);
  });
});

function targetKey(q: Query): string {
  if (q.target.kind === "exercicio") return `ex:${norm(q.target.ex.name)}`;
  if (q.target.kind === "musculo") return `m:${q.target.muscle}`;
  if (q.target.kind === "dia") return `dia:${q.target.day.id}`;
  return "tudo";
}

/** Conta independente (sem a gramática) para conferir os números das séries e dos treinos. */
function oracle(q: Query): number | undefined {
  const inP = (date: string) => date >= q.period.from && date <= q.period.to && date <= TODAY;
  const list = FULL.sessions.filter((s) => s.status === "done" && inP(s.date));
  if (q.metric === "treinos" && q.agg === "total" && q.target.kind === "tudo") return list.length;
  if (q.metric === "series" && q.agg === "total" && q.target.kind === "tudo")
    return list.reduce((n, s) => n + s.exercises.reduce((m, e) => m + workSets(e).length, 0), 0);
  if (q.metric === "series" && q.agg === "total" && q.target.kind === "musculo") {
    const m = q.target.muscle;
    let n = 0;
    for (const s of list)
      for (const e of s.exercises) {
        const ex = exOf(e);
        const w = ex.muscles.includes(m) ? 1 : (ex.synergists ?? SYNERGISTS[ex.lib] ?? []).includes(m) ? 0.5 : 0;
        if (w === 1) n += workSets(e).length;
        else if (w) n += workSets(e).length * w;
      }
    return n;
  }
  return undefined;
}

function measureQueries() {
  const misses: string[] = [];
  let ok = 0;
  let wrongNumbers = 0;
  let checked = 0;
  for (const g of GOLDEN_QUERIES) {
    const q = parseQuery(g.q, FULL);
    if (!q) {
      misses.push(`[consulta] "${g.q}" → não reconheceu`);
      continue;
    }
    const got = { metric: q.metric, target: targetKey(q), period: q.period.key, agg: q.agg };
    const targetOk =
      g.target === "tudo" || g.target.startsWith("m:") || g.target.startsWith("dia:")
        ? got.target === g.target
        : got.target.startsWith("ex:") && got.target.includes(g.target.slice(3));
    const bad = [
      got.metric !== g.metric && `métrica ${got.metric}≠${g.metric}`,
      !targetOk && `alvo ${got.target}≠${g.target}`,
      got.period !== g.period && `período ${got.period}≠${g.period}`,
      got.agg !== g.agg && `conta ${got.agg}≠${g.agg}`,
    ].filter(Boolean);
    if (!bad.length) ok++;
    else misses.push(`[consulta] "${g.q}" → ${bad.join("; ")}`);
    const r = runQuery(q, FULL);
    const want = oracle(q);
    if (want != null && r.ok) {
      checked++;
      if (Math.abs((r.number ?? NaN) - want) > 1e-6) {
        wrongNumbers++;
        misses.push(`[número] "${g.q}" → respondeu ${r.number}, a conta dá ${want}`);
      }
    }
    // Eixo errado respondido com número também conta como número errado.
    if (bad.some((b) => String(b).startsWith("métrica") || String(b).startsWith("alvo")) && r.ok && /\d/.test(r.text)) {
      wrongNumbers++;
      misses.push(`[número] "${g.q}" → respondeu com número em eixo errado`);
    }
  }
  return { n: GOLDEN_QUERIES.length, axes: ok / GOLDEN_QUERIES.length, wrongNumbers, checked, misses };
}

describe("AUG.CORE — chat amplo: consultas aos dados", () => {
  it("medição das consultas: quatro eixos ≥ 85%, número errado 0", () => {
    const m = measureQueries();
    console.info(
      [
        `Consultas: ${m.n} frases | eixos certos ${pct(m.axes)} | número errado ${m.wrongNumbers} (${m.checked} conferidos por conta independente)`,
        ...m.misses.map((x) => `  ✗ ${x}`),
      ].join("\n"),
    );
    expect(m.wrongNumbers).toBe(0);
    expect(m.axes).toBeGreaterThanOrEqual(0.85);
  });
});

describe("AUG.CORE — chat amplo: papo, fora do escopo e travas", () => {
  it("medição: papo ≥ 85%, fora respondido ≤ 5%, trava 100% em qualquer camada, respostas prontas não sequestradas", () => {
    const misses: string[] = [];
    let small = 0;
    for (const g of GOLDEN_SMALLTALK) {
      const r = coreReply(g.q, FULL, {}, { now: NOW });
      const id = matchSmalltalk(g.q)?.id;
      // "O que você sabe fazer" passou a ser respondido pela lista real de capacidades (bloco C do chat potente).
      if ((r.layer === "smalltalk" || (g.id === "o-que-faz" && r.layer === "assist")) && id === g.id) small++;
      else misses.push(`[papo] "${g.q}" → esperado ${g.id}, veio ${r.layer}/${id ?? "-"}`);
    }
    let outWrong = 0;
    for (const q of GOLDEN_OUT_WIDE) {
      const r = coreReply(q, FULL, {}, { now: NOW });
      if (!["none", "maybe", "guard"].includes(r.layer)) {
        outWrong++;
        misses.push(`[fora] "${q}" respondido por ${r.layer}: ${r.text.slice(0, 60)}`);
      }
    }
    let guardMissed = 0;
    const guards = [...GOLDEN_GUARD_WIDE, ...GOLDEN_OUT.filter((g) => g.guard).map((g) => g.q)];
    for (const q of guards) {
      const r = coreReply(q, FULL, {}, { now: NOW });
      if (r.layer !== "guard" && r.layer !== "intent") {
        guardMissed++;
        misses.push(`[trava] "${q}" passou por ${r.layer}`);
      }
      if (r.meta.web || r.proposal || r.action) {
        guardMissed++;
        misses.push(`[trava] "${q}" ofereceu web, proposta ou ação`);
      }
    }
    let hijacked = 0;
    for (const g of GOLDEN_IN) {
      const r = coreReply(g.q, FULL, {}, { now: NOW });
      if (r.layer === "command" || r.layer === "smalltalk" || r.layer === "data") {
        hijacked++;
        misses.push(`[sequestro] "${g.q}" (resposta ${g.id}) virou ${r.layer}`);
      }
    }
    console.info(
      [
        `Papo: ${GOLDEN_SMALLTALK.length} | situação certa ${pct(small / GOLDEN_SMALLTALK.length)}`,
        `Fora do escopo: ${GOLDEN_OUT_WIDE.length} | respondido como se soubesse ${pct(outWrong / GOLDEN_OUT_WIDE.length)}`,
        `Travas: ${guards.length} | falhas ${guardMissed}`,
        `Respostas prontas sequestradas por comando, papo ou dados: ${hijacked} de ${GOLDEN_IN.length}`,
        ...misses.map((x) => `  ✗ ${x}`),
      ].join("\n"),
    );
    expect(guardMissed).toBe(0);
    expect(hijacked).toBe(0);
    expect(outWrong / GOLDEN_OUT_WIDE.length).toBeLessThanOrEqual(0.05);
    expect(small / GOLDEN_SMALLTALK.length).toBeGreaterThanOrEqual(0.85);
  });

  it("perguntas relatadas não viram resposta desconexa nem 'não sei'", () => {
    const cases: [string, string][] = [
      ["quais fontes cientificas você usa?", "ACSM"],
      ["quais são suas fontes?", "ACSM"],
      ["como eu posso melhorar meu treino", "10 a 20 séries"],
      ["como aumentar minha força", "1 a 6 repetições"],
      ["onde vejo meus recordes", "Progresso"],
      ["onde registro meu peso", "Biometria"],
      ["meu peso sobe e desce todo dia", "1 a 2 kg"],
    ];
    for (const [q, expected] of cases) {
      const r = coreReply(q, FULL, {}, { now: NOW });
      expect(r.layer, q).toBe("answer");
      expect(r.text, q).toContain(expected);
    }
  });

  it("motor composicional responde aspectos de exercícios, músculos, modelos e auditorias", () => {
    const cases: [string, string][] = [
      ["quais os erros comuns no supino inclinado", "Erros comuns a evitar"],
      ["quantas repetições na elevação lateral", "repetições"],
      ["quanto descanso no terra romeno", "descanso"],
      ["cadeira extensora é composto ou isolado", "isolado"],
      ["exercícios de peito com halteres", "halteres"],
      ["exercícios de costas na polia", "polia/cabo"],
      ["exercícios de perna em casa", "peso corporal"],
      ["exercícios isolados de ombro", "isolados"],
      ["quanto tempo o peito leva para recuperar", "48 a 72 horas"],
      ["quais os exercícios do treino upper lower", "Upper A"],
      ["o que a ciência diz sobre mais de 10 séries", "Pelland 2026"],
      ["é verdade que mulher precisa treinar diferente", "Refalo 2025"],
    ];
    for (const [q, expected] of cases) {
      const r = coreReply(q, FULL, {}, { now: NOW });
      expect(r.layer, q).toBe("answer");
      expect(r.text, q).toContain(expected);
    }
  });

  it("todo princípio do Guia tem resposta e todo termo do glossário responde", () => {
    const covered = new Set([...ANSWERS.map((a) => a.principle), ...GLOSSARY.map((g) => g.principle)].filter(Boolean));
    for (const p of PRINCIPLES) {
      if (covered.has(p.id)) continue;
      expect(principleAnswer(principleQuestion(p))?.principle, p.id).toBe(p.id);
    }
    const ids = new Set(PRINCIPLES.map((p) => p.id));
    for (const g of GLOSSARY) {
      if (g.principle) expect(ids.has(g.principle), g.principle).toBe(true);
      expect(glossaryAnswer(`o que é ${g.terms[0]}`, "def")?.id, g.terms[0]).toBe(g.id);
    }
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(80);
  });

  it("memória curta: pedido em aberto, continuação, correção, sim/não e expiração", () => {
    const a = coreReply("anota uma serie", FULL, {}, { now: NOW });
    expect(a.ctx.pending?.id).toBe("treino-anotar");
    const b = coreReply("8 com 80", FULL, a.ctx, { now: NOW + 1000 });
    expect(b.layer).toBe("pending");
    const late = coreReply("8 com 80", FULL, a.ctx, { now: NOW + 6 * 60_000 });
    expect(late.layer).not.toBe("pending");
    const q1 = coreReply("quantas series de peito fiz em outubro", FULL, {}, { now: NOW });
    expect(q1.layer).toBe("data");
    const q2 = coreReply("e de costas?", FULL, q1.ctx, { now: NOW + 1000 });
    expect(q2.layer).toBe("data");
    expect(q2.ctx.query?.target).toMatchObject({ kind: "musculo", muscle: "costas" });
    expect(q2.ctx.query?.period.key).toBe("mes-nome");
    const r1 = coreReply("qual meu recorde no supino reto", FULL, {}, { now: NOW });
    const r2 = coreReply("nao, o inclinado", FULL, r1.ctx, { now: NOW + 1000 });
    expect(r2.layer).toBe("data");
    expect(r2.text.toLowerCase()).toContain("inclinado");
    const p1 = coreReply("muda pra libras", FULL, {}, { now: NOW });
    expect(p1.proposal?.source).toBe("command");
    expect(coreReply("sim", FULL, p1.ctx, { now: NOW + 1000 }).answerProposal).toBe("yes");
    expect(coreReply("nao", FULL, p1.ctx, { now: NOW + 1000 }).answerProposal).toBe("no");
    expect(coreReply("sim", FULL, p1.ctx, { now: NOW + 10 * 60_000 }).answerProposal).toBeUndefined();
  });
});
