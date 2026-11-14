import { describe, expect, it } from "vitest";
import { GOLDEN_COMMANDS, type GoldenCommand } from "./chat.golden";
import { GOLDEN_FREE } from "./free.golden";
import { matchCommand, runCommand, WRITE_COMMANDS, type CommandId, type CommandMatch } from "./commands";
import { readCommand } from "./understand";
import { coreReply } from "./localchat";
import { norm } from "./intents";
import type { ExerciseRef } from "./data-answers";
import { FULL_DATA, NOW_MS } from "./chat.fixture";

// Bloco A do chat potente (docs/prompt-chat-potente.md): frase livre.
//
// Partida (14/11/2026, antes do bloco A: só as frases-modelo de então), 109 frases livres:
//   pedido certo 53,2% | campos certos 42,6% | gravação indevida 0
// Depois do bloco A (`readCommand`, com os modelos novos): pedido 99,1% | campos 98,5% | gravação indevida 0.
// A "partida" que o teste imprime hoje já inclui os modelos novos de `commands.ts`; a original é a de cima.

function fieldValue(name: string, v: unknown): string | number | undefined {
  if (name === "tela") return (v as { route: string } | undefined)?.route;
  if (name === "exercicio") return v ? norm((v as ExerciseRef).name) : undefined;
  if (name === "carga") return (v as { value: number } | undefined)?.value;
  return v as string | number;
}

function measure(set: GoldenCommand[], read: (q: string) => CommandMatch | null) {
  const misses: string[] = [];
  let ok = 0;
  let fieldsTotal = 0;
  let fieldsOk = 0;
  let badWrites = 0;
  for (const g of set) {
    const m = read(g.q);
    const got = m && !m.ask ? m.id : null;
    if (got === g.id) ok++;
    else misses.push(`"${g.q}" → esperado ${g.id ?? "nenhum"}, veio ${got ?? (m?.ask ? `pergunta (${m.ask.join(" | ")})` : "nenhum")}`);
    if (g.fields) {
      fieldsTotal++;
      if (m && got === g.id) {
        const bad = Object.entries(g.fields).filter(([k, want]) => {
          const v = fieldValue(k, m.values[k]);
          return k === "exercicio" ? !String(v ?? "").includes(String(want)) : v !== want;
        });
        if (!bad.length) fieldsOk++;
        else misses.push(`[campo] "${g.q}" → ${bad.map(([k, w]) => `${k}: esperado ${w}, veio ${fieldValue(k, m.values[k])}`).join("; ")}`);
      }
    }
    if (m && !m.ask) {
      const r = runCommand(m, FULL_DATA, g.q, { now: NOW_MS, timerActive: true });
      if (r.proposal && (!WRITE_COMMANDS.includes(m.id as CommandId) || g.id === null)) {
        badWrites++;
        misses.push(`[gravação] "${g.q}" propôs ${r.proposal.kind}`);
      }
    }
  }
  return { n: set.length, ok: ok / set.length, fields: fieldsTotal ? fieldsOk / fieldsTotal : 1, badWrites, misses };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const report = (label: string, m: ReturnType<typeof measure>) =>
  `${label}: ${m.n} frases | pedido ${pct(m.ok)} | campos ${pct(m.fields)} | gravação indevida ${m.badWrites}`;

describe("chat potente, bloco A: frase livre", () => {
  it("partida × depois: pedido ≥ 90%, campos ≥ 85%, gravação indevida 0", () => {
    const before = measure(GOLDEN_FREE, (q) => matchCommand(q));
    const after = measure(GOLDEN_FREE, (q) => readCommand(q, FULL_DATA));
    console.info([report("Partida", before), report("Depois ", after), ...after.misses.map((x) => `  ✗ ${x}`)].join("\n"));
    expect(after.badWrites).toBe(0);
    expect(after.ok).toBeGreaterThanOrEqual(0.9);
    expect(after.fields).toBeGreaterThanOrEqual(0.85);
  });

  it("o conjunto antigo de comandos não piora", () => {
    const before = measure(GOLDEN_COMMANDS, (q) => matchCommand(q));
    const after = measure(GOLDEN_COMMANDS, (q) => readCommand(q, FULL_DATA));
    console.info([report("Antigo, partida", before), report("Antigo, depois ", after), ...after.misses.map((x) => `  ✗ ${x}`)].join("\n"));
    expect(after.ok).toBeGreaterThanOrEqual(before.ok);
    expect(after.fields).toBeGreaterThanOrEqual(before.fields);
    expect(after.badWrites).toBe(0);
  });
});

// ---------- I13: robustez ----------

/** Variações mecânicas de uma frase: enchimento, maiúsculas, sem acento, pontuação, um erro de digitação. */
function variants(q: string): string[] {
  const words = q.split(" ");
  const longest = words.reduce((a, w, i) => (w.length > words[a].length ? i : a), 0);
  const typo = words.map((w, i) =>
    i === longest && w.length >= 6 && /^[a-z]+$/.test(w) ? w.slice(0, -2) + w[w.length - 1] + w[w.length - 2] : w,
  );
  return [`tipo, ${q}`, `${q} ai`, q.toUpperCase(), `${q}!!`, `ei, ${q} por favor`, typo.join(" ")];
}

describe("chat potente, bloco A: robustez", () => {
  it("paráfrase mecânica não muda a leitura (≥ 95%)", () => {
    const base = [...GOLDEN_COMMANDS, ...GOLDEN_FREE].filter((g) => g.id && readCommand(g.q, FULL_DATA)?.id === g.id);
    let total = 0;
    let same = 0;
    const misses: string[] = [];
    for (const g of base) {
      for (const v of variants(g.q)) {
        total++;
        const m = readCommand(v, FULL_DATA);
        if (m && !m.ask && m.id === g.id) same++;
        else if (misses.length < 25) misses.push(`"${v}" → ${m?.id ?? "nenhum"}${m?.ask ? " (pergunta)" : ""}`);
      }
    }
    console.info([`Paráfrase: ${total} variações | mesma leitura ${pct(same / total)}`, ...misses.map((x) => `  ✗ ${x}`)].join("\n"));
    expect(same / total).toBeGreaterThanOrEqual(0.95);
  });

  it("5.000 mensagens aleatórias não quebram, não gravam e não passam pela trava", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const bag = [
      "anota",
      "8",
      "80",
      "kg",
      "com",
      "x",
      "supino",
      "descanso",
      "90s",
      "nao",
      "e",
      "depois",
      "peso",
      "dor",
      "peito",
      "libras",
      "troca",
      "abre",
      "historico",
      "?",
      "!!",
      "😀",
      "ombro",
      "remedio",
      "1:30",
      "%",
      "de",
      "por",
      "zzz",
      "",
    ];
    let writes = 0;
    let guardLeaks = 0;
    for (let i = 0; i < 5000; i++) {
      const n = 1 + Math.floor(rnd() * 8);
      const text = Array.from({ length: n }, () => bag[Math.floor(rnd() * bag.length)]).join(" ");
      const r = coreReply(text, FULL_DATA, {}, { now: NOW_MS, timerActive: true });
      // A gravação só pode vir como proposta; aqui conta se ela apareceu sem um pedido de gravação claro.
      if (r.proposal && r.proposal.source === "command" && /\bnao\b/.test(norm(text))) {
        writes++;
        console.info(`gravação com "não": "${text}" → ${r.proposal.kind}`);
      }
      if (/\bdor no peito\b/.test(norm(text)) && r.layer !== "guard") guardLeaks++;
    }
    expect(writes).toBe(0);
    expect(guardLeaks).toBe(0);
  });
});

// ---------- I2 e I3: o treino aberto ----------

function withOpenSession() {
  const last = [...FULL_DATA.sessions].filter((s) => s.status === "done").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const open = {
    ...last,
    id: "aberta",
    date: FULL_DATA.today,
    status: "active" as const,
    exercises: last.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: false, reps: null, suggested: true })) })),
  };
  return { data: { ...FULL_DATA, sessions: [...FULL_DATA.sessions, open] }, open };
}

describe("chat potente, bloco A: treino aberto", () => {
  it("'anota 8' usa a carga já posta na próxima série e propõe (não grava)", () => {
    const { data, open } = withOpenSession();
    const first = open.exercises.find((e) => e.sets.some((x) => x.kind === "work"))!;
    const w = first.sets.find((x) => x.kind === "work")!.weight!;
    const r = coreReply("anota 8 reps", data, {}, { now: NOW_MS });
    expect(r.proposal?.source).toBe("command");
    expect(r.proposal && "weight" in r.proposal ? r.proposal.weight : null).toBe(w);
    expect(r.text).toMatch(/carga que já estava/);
  });

  it("carga fora do normal sai com aviso de conferir", () => {
    const { data } = withOpenSession();
    const r = coreReply("anota 8 com 900", data, {}, { now: NOW_MS });
    expect(r.text).toMatch(/Confere/);
  });

  it("'qual a próxima série' responde do treino aberto", () => {
    const { data } = withOpenSession();
    const r = coreReply("qual a proxima serie?", data, {}, { now: NOW_MS });
    expect(r.layer).toBe("command");
    expect(r.text).toMatch(/Próxima: .+série 1/);
    expect(coreReply("qual a proxima serie?", FULL_DATA, {}, { now: NOW_MS }).text).toMatch(/Não há treino aberto/);
  });
});
