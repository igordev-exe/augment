import { describe, expect, it } from "vitest";
import { FULL_DATA, NOW_MS } from "./chat.fixture";
import { coreReply, type ChatContext } from "./localchat";
import { applyTaste, detectNote } from "./notes";
import { CONTINUE, FLOW_TTL } from "./flows";
import type { OperatorNote } from "./operator";
import { EMPTY_OPERATOR_MEMORY } from "./operator";
import { detectExercise } from "./data-answers";

// Bloco D do chat potente: memória do que a pessoa contou e conversas guiadas.
// Partida (14/11/2026): não existia: 0 de 40 lembranças reconhecidas, nenhum roteiro.

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Frase → tipo e alvo esperados ("lib:" confere pelo nome do exercício detectado). */
const GOLDEN_NOTES: { q: string; kind: OperatorNote["kind"]; target?: string }[] = [
  { q: "nao gosto de agachamento", kind: "dislike", target: "ex:agachamento" },
  { q: "odeio leg press", kind: "dislike", target: "ex:leg press" },
  { q: "detesto stiff", kind: "dislike", target: "ex:stiff" },
  { q: "eu nao curto supino reto", kind: "dislike", target: "ex:supino reto" },
  { q: "nao gosto do hack", kind: "dislike", target: "ex:hack" },
  { q: "nao gosto de maquina", kind: "dislike", target: "equip:maquina" },
  { q: "odeio barra", kind: "dislike", target: "equip:barra" },
  { q: "nao curto polia", kind: "dislike", target: "equip:cabo" },
  { q: "nao gosto de treinar perna", kind: "dislike", target: "muscle:quadriceps" },
  { q: "detesto abdominal", kind: "dislike", target: "ex:abdominal" },
  { q: "nao suporto panturrilha", kind: "dislike", target: "ex:panturrilha" },
  { q: "odeio afundo", kind: "dislike", target: "ex:afundo" },
  { q: "nao gosto da cadeira extensora", kind: "dislike", target: "ex:cadeira extensora" },
  { q: "nao gosto de crucifixo", kind: "dislike", target: "ex:crucifixo" },
  { q: "prefiro halter", kind: "prefer", target: "equip:halter" },
  { q: "prefiro halteres", kind: "prefer", target: "equip:halter" },
  { q: "gosto mais de maquina", kind: "prefer", target: "equip:maquina" },
  { q: "prefiro cabo", kind: "prefer", target: "equip:cabo" },
  { q: "prefiro peso do corpo", kind: "prefer", target: "equip:corpo" },
  { q: "eu prefiro barra", kind: "prefer", target: "equip:barra" },
  { q: "adoro supino inclinado", kind: "prefer", target: "ex:supino inclinado" },
  { q: "amo leg press", kind: "prefer", target: "ex:leg press" },
  { q: "gosto mais do hack", kind: "prefer", target: "ex:hack" },
  { q: "curto mais remada", kind: "prefer", target: "ex:remada" },
  { q: "gosto muito de puxada", kind: "prefer", target: "ex:puxada" },
  { q: "prefiro elevacao lateral com halter", kind: "prefer", target: "equip:halter" },
  { q: "treino de manha", kind: "fact" },
  { q: "eu treino a noite", kind: "fact" },
  { q: "treino em casa", kind: "fact" },
  { q: "treino na academia", kind: "fact" },
  { q: "quero focar em gluteo", kind: "fact", target: "muscle:gluteo" },
  { q: "quero focar no peito", kind: "fact", target: "muscle:peito" },
  { q: "meu objetivo e hipertrofia", kind: "fact" },
  { q: "meu foco e ganhar massa", kind: "fact" },
  { q: "treino cedo", kind: "fact" },
  { q: "treino sozinho", kind: "fact" },
  { q: "so tenho a noite pra treinar", kind: "fact" },
  { q: "treino de noite", kind: "fact" },
  { q: "quero focar nas costas", kind: "fact", target: "muscle:costas" },
  { q: "eu treino a tarde", kind: "fact" },
];

const HEALTH = [
  "nao gosto de agachamento porque doi o joelho",
  "odeio supino, machuquei o ombro",
  "prefiro maquina por causa da hernia",
  "nao gosto de leg press, tenho lesao no joelho",
  "treino em casa porque to com tendinite",
];

function targetOk(n: OperatorNote | undefined, want?: string): boolean {
  if (!want) return true;
  if (!n?.target) return false;
  if (want.startsWith("ex:")) return n.target.startsWith("lib:") && n.target.slice(4) === detectExercise(want.slice(3))?.libId;
  return n.target === want;
}

describe("chat potente, bloco D: lembranças", () => {
  it("tipo e alvo certos ≥ 85%; assunto de saúde guardado 0", () => {
    let ok = 0;
    const misses: string[] = [];
    for (const g of GOLDEN_NOTES) {
      const r = detectNote(g.q, "2026-10-21", () => "x");
      if (r?.note?.kind === g.kind && targetOk(r.note, g.target)) ok++;
      else misses.push(`"${g.q}" → esperado ${g.kind}/${g.target ?? "-"}, veio ${r?.note?.kind ?? "nada"}/${r?.note?.target ?? "-"}`);
    }
    console.info(
      [`Lembranças: ${GOLDEN_NOTES.length} | tipo e alvo certos ${pct(ok / GOLDEN_NOTES.length)}`, ...misses.map((x) => `  ✗ ${x}`)].join(
        "\n",
      ),
    );
    expect(ok / GOLDEN_NOTES.length).toBeGreaterThanOrEqual(0.85);
    for (const q of HEALTH) {
      const r = coreReply(q, FULL_DATA, {}, { now: NOW_MS });
      expect(r.proposal?.source, q).not.toBe("note");
    }
  });

  it("no chat: propõe (não grava), lista e esquece com confirmação", () => {
    const r = coreReply("nao gosto de agachamento", FULL_DATA, {}, { now: NOW_MS });
    expect(r.proposal?.source).toBe("note");
    expect(r.ctx.proposalOpen).toBe(true);
    const note: OperatorNote = (r.proposal as { note: OperatorNote }).note;
    const mem = { ...EMPTY_OPERATOR_MEMORY, constraints: [], mesoHistory: [], notes: [note] };
    const data = { ...FULL_DATA, memory: mem };
    expect(coreReply("o que voce sabe sobre mim", data, {}, { now: NOW_MS }).text).toMatch(/Não gosta de/);
    const f = coreReply("esquece que eu nao gosto de agachamento", data, {}, { now: NOW_MS });
    expect(f.proposal).toMatchObject({ source: "note", forgetNoteId: note.id });
    expect(coreReply("o que voce sabe sobre mim", FULL_DATA, {}, { now: NOW_MS }).text).toMatch(/Ainda não guardei/);
  });

  it("gosto muda as sugestões (trocas e listas), não o planejador", () => {
    const notes: OperatorNote[] = [
      { id: "a", kind: "dislike", target: "equip:maquina", label: "máquina", text: "", at: "2026-10-21" },
      { id: "b", kind: "prefer", target: "equip:halter", label: "halter", text: "", at: "2026-10-21" },
    ];
    const r = applyTaste(["Supino na máquina", "Supino com barra", "Supino com halteres"], notes);
    expect(r.names).toEqual(["Supino com halteres", "Supino com barra"]);
    expect(r.changed).toBe(true);
    const data = { ...FULL_DATA, memory: { ...EMPTY_OPERATOR_MEMORY, constraints: [], mesoHistory: [], notes } };
    const list = coreReply("exercicios para peito", data, {}, { now: NOW_MS });
    expect(list.text).not.toMatch(/máquina/i);
  });
});

describe("chat potente, bloco D: conversas guiadas", () => {
  const ROTEIROS: { start: string; answers: string[]; ends: RegExp; proposal: boolean }[] = [
    { start: "quero trocar de programa", answers: ["4 dias", "6 meses a 2 anos", "equilibrado"], ends: /Para 4 dias/, proposal: false },
    { start: "me ajuda a montar o treino de hoje", answers: ["45 min", "so halteres", "nenhum"], ends: /Montei o treino/, proposal: true },
    { start: "voltei a treinar depois de uma pausa", answers: ["um mes"], ends: /semana 1/, proposal: true },
    { start: "quero definir uma meta de peso", answers: ["perder", "75 kg"], ends: /Perder peso até 75 kg/, proposal: true },
    { start: "tenho um incomodo", answers: ["ombro", "desenvolvimento", "esta semana"], ends: /./, proposal: true },
  ];

  for (const r of ROTEIROS) {
    it(`termina, cancela, retoma e expira: ${r.start}`, () => {
      let t = NOW_MS;
      let a = coreReply(r.start, FULL_DATA, {}, { now: t });
      expect(a.layer).toBe("flow");
      expect(a.meta.chips?.length).toBeGreaterThan(0);
      let ctx: ChatContext = a.ctx;
      for (const ans of r.answers) {
        t += 10_000;
        a = coreReply(ans, FULL_DATA, ctx, { now: t });
        ctx = a.ctx;
      }
      expect(a.text).toMatch(r.ends);
      expect(!!a.proposal).toBe(r.proposal);
      expect(a.ctx.flow).toBeUndefined();
      // Cancela.
      const s = coreReply(r.start, FULL_DATA, {}, { now: NOW_MS });
      const c = coreReply("cancela", FULL_DATA, s.ctx, { now: NOW_MS + 1000 });
      expect(c.text).toMatch(/parei/);
      expect(c.ctx.flow).toBeUndefined();
      // Pergunta fora do roteiro: responde e oferece voltar; o botão retoma a mesma pergunta.
      const off = coreReply("o que e rir", FULL_DATA, s.ctx, { now: NOW_MS + 1000 });
      expect(off.meta.chips?.[0]).toBe(CONTINUE);
      const back = coreReply(CONTINUE, FULL_DATA, off.ctx, { now: NOW_MS + 2000 });
      expect(back.layer).toBe("flow");
      // Duas fora do roteiro seguidas encerram.
      const off2 = coreReply("que dia e hoje", FULL_DATA, off.ctx, { now: NOW_MS + 2000 });
      expect(off2.ctx.flow).toBeUndefined();
      // Expira em 10 minutos.
      const late = coreReply(r.answers[0], FULL_DATA, s.ctx, { now: NOW_MS + FLOW_TTL + 1000 });
      expect(late.layer).not.toBe("flow");
    });
  }
});
