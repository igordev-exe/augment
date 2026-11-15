import { describe, expect, it } from "vitest";
import { GOLDEN_COMPOUND, GOLDEN_CONVERSATIONS, GOLDEN_NOT_COMPOUND } from "./converse.golden";
import { FULL_DATA, NOW_MS, withOpenSession } from "./chat.fixture";
import { coreReply, type ChatContext, type CoreReply } from "./localchat";
import { norm } from "./intents";
import { applyPure, latestUndo, pushUndo, revertPure, undoFor, type ChatState, type CoreProposal } from "./undo";
import { EMPTY_OPERATOR_MEMORY } from "./operator";

// Bloco B do chat potente (docs/prompt-chat-potente.md): pedido composto, contexto longo e desfazer.
// Partida (14/11/2026, medida no código de antes do bloco B): compostos 0 de 45 | controles 0 de 60 quebrados |
// conversas 20 de 28 trocas (71,4%). Depois: compostos 100% | controles 0% quebrados | conversas 100%.

const { data: OPEN } = withOpenSession();
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function partKey(r: CoreReply): string {
  if (r.layer === "command" || r.layer === "pending") return r.ctx.lastCommand?.id ?? r.layer;
  return r.layer;
}

describe("chat potente, bloco B: pedido composto", () => {
  it("todas as partes certas ≥ 85%; controle quebrado por engano ≤ 2%", () => {
    const misses: string[] = [];
    let ok = 0;
    for (const g of GOLDEN_COMPOUND) {
      const r = coreReply(g.q, OPEN, {}, { now: NOW_MS, timerActive: true });
      const got = r.parts?.map(partKey) ?? [partKey(r)];
      if (JSON.stringify(got) === JSON.stringify(g.parts)) ok++;
      else misses.push(`"${g.q}" → esperado ${g.parts.join(" + ")}, veio ${got.join(" + ")}`);
    }
    let split = 0;
    for (const q of GOLDEN_NOT_COMPOUND) {
      const r = coreReply(q, OPEN, {}, { now: NOW_MS });
      if (r.parts) {
        split++;
        misses.push(`[controle] "${q}" quebrou em ${r.parts.length}`);
      }
    }
    console.info(
      [
        `Compostos: ${GOLDEN_COMPOUND.length} | todas as partes certas ${pct(ok / GOLDEN_COMPOUND.length)}`,
        `Controles: ${GOLDEN_NOT_COMPOUND.length} | quebrados por engano ${pct(split / GOLDEN_NOT_COMPOUND.length)}`,
        ...misses.map((x) => `  ✗ ${x}`),
      ].join("\n"),
    );
    expect(ok / GOLDEN_COMPOUND.length).toBeGreaterThanOrEqual(0.85);
    expect(split / GOLDEN_NOT_COMPOUND.length).toBeLessThanOrEqual(0.02);
  });

  it("duas séries no mesmo pedido vão para séries diferentes, num cartão só, e o descanso espera o Aplicar", () => {
    const r = coreReply("anota 8 com 80 e 7 com 75 e descanso de 90 segundos", OPEN, {}, { now: NOW_MS });
    expect(r.proposal?.source).toBe("batch");
    if (r.proposal?.source !== "batch") return;
    const sets = r.proposal.items.map((p) => (p.source === "command" && p.kind === "log-set" ? p.setId : ""));
    expect(new Set(sets).size).toBe(2);
    expect(r.proposal.then).toEqual([{ kind: "timer-start", seconds: 90 }]);
    expect(r.action).toBeUndefined();
  });

  it("descanso antes da gravação roda na hora; trava em qualquer parte trava tudo", () => {
    const r = coreReply("descanso de 90 segundos e anota 8 com 80", OPEN, {}, { now: NOW_MS });
    expect(r.actions).toEqual([{ kind: "timer-start", seconds: 90 }]);
    expect(r.proposal?.source).toBe("command");
    const g = coreReply("anota 8 com 80 e to com dor no peito", OPEN, {}, { now: NOW_MS });
    expect(g.layer).toBe("guard");
    expect(g.proposal).toBeUndefined();
  });

  it("'anota 8 com 80 e depois 7' herda a carga", () => {
    const r = coreReply("anota 8 com 80 e depois 7", OPEN, {}, { now: NOW_MS });
    expect(r.proposal?.source).toBe("batch");
    if (r.proposal?.source !== "batch") return;
    const loads = r.proposal.items.map((p) => (p.source === "command" && p.kind === "log-set" ? `${p.reps}x${p.weight}` : ""));
    expect(loads).toEqual(["8x80", "7x80"]);
  });
});

describe("chat potente, bloco B: conversa mais longa", () => {
  it("referência e troca de eixo resolvidas ≥ 85%; gravação por referência errada 0", () => {
    let ok = 0;
    let total = 0;
    const misses: string[] = [];
    for (const conv of GOLDEN_CONVERSATIONS) {
      let ctx: ChatContext = {};
      let t = NOW_MS;
      conv.turns.forEach((turn, i) => {
        t += 20_000;
        const r = coreReply(turn.q, OPEN, ctx, { now: t, timerActive: true });
        ctx = r.ctx;
        if (i === 0) return;
        total++;
        const fails: string[] = [];
        if (turn.layer && r.layer !== turn.layer) fails.push(`camada ${r.layer}`);
        if (turn.has && !norm(r.text).includes(turn.has)) fails.push(`sem "${turn.has}"`);
        if (turn.proposal === true && !r.proposal) fails.push("sem proposta");
        if (turn.proposal === false && r.proposal) fails.push("propôs");
        if (!fails.length) ok++;
        else misses.push(`[${conv.name}] "${turn.q}" → ${fails.join(", ")} | ${r.text.slice(0, 80)}`);
      });
    }
    console.info([`Conversas: ${total} trocas | certas ${pct(ok / total)}`, ...misses.map((x) => `  ✗ ${x}`)].join("\n"));
    expect(ok / total).toBeGreaterThanOrEqual(0.85);
  });

  it("o assunto vale 10 trocas e 15 minutos; a proposta aberta continua expirando em 5", () => {
    const a = coreReply("qual meu recorde no supino inclinado", FULL_DATA, {}, { now: NOW_MS });
    const b = coreReply("e na puxada?", FULL_DATA, a.ctx, { now: NOW_MS + 12 * 60_000 });
    expect(b.layer).toBe("data");
    const late = coreReply("e na puxada?", FULL_DATA, a.ctx, { now: NOW_MS + 16 * 60_000 });
    expect(late.ctx.turns).toBe(0);
  });
});

describe("chat potente, bloco B: desfazer", () => {
  const { data, open } = withOpenSession();
  const state: ChatState = {
    sessions: [open],
    bodyLog: data.bodyLog,
    settings: data.settings,
    memory: { ...EMPTY_OPERATOR_MEMORY, constraints: [], mesoHistory: [] },
  };
  const ex = open.exercises.find((e) => e.sets.some((x) => x.kind === "work"))!;
  const set = ex.sets.find((x) => x.kind === "work")!;
  const proposals: CoreProposal[] = [
    { source: "command", kind: "log-set", sessionId: open.id, exId: ex.exId, setId: set.id, weight: 80, reps: 8, confirmLabel: "série" },
    { source: "command", kind: "swap", sessionId: open.id, exId: ex.exId, alt: "Outro", confirmLabel: "troca" },
    { source: "command", kind: "body-weight", date: data.today, weightKg: 81, confirmLabel: "peso hoje" },
    { source: "command", kind: "body-weight", date: "2026-10-05", weightKg: 79, confirmLabel: "peso de um dia com registro" },
    { source: "command", kind: "settings", patch: { units: { ...data.settings.units, default: "lb" } } as never, confirmLabel: "libras" },
    { source: "command", kind: "settings", patch: { sound: false } as never, confirmLabel: "som" },
    {
      source: "intent",
      constraint: { id: "c1", kind: "time-cap", minutes: 40, createdAt: data.today, expiresAt: data.today },
      confirmLabel: "40 min",
    },
    { source: "intent", absence: { from: data.today, until: data.today }, confirmLabel: "ausência" },
    {
      source: "note",
      note: { id: "n1", kind: "dislike", target: "lib:agachamento", label: "Agachamento", text: "não gosto", at: data.today },
      confirmLabel: "nota",
    },
  ];
  proposals.push({ source: "batch", items: proposals.slice(0, 3), confirmLabel: "três" });

  for (const p of proposals) {
    it(`aplicar + desfazer devolve o estado exato: ${p.confirmLabel}`, () => {
      const rec = undoFor(state, p, p.confirmLabel, NOW_MS)!;
      expect(rec).not.toBeNull();
      const after = applyPure(state, p, () => "novo");
      expect(JSON.stringify(after)).not.toBe(JSON.stringify(state));
      expect(JSON.stringify(revertPure(after, rec))).toBe(JSON.stringify(state));
    });
  }

  it("a pilha guarda 5, por 10 minutos; 'desfaz' pergunta o que vai desfazer", () => {
    let stack = proposals.reduce(
      (st, p, i) => pushUndo(st, undoFor(state, p, p.confirmLabel, NOW_MS + i), NOW_MS + i),
      [] as ReturnType<typeof pushUndo>,
    );
    expect(stack).toHaveLength(5);
    expect(latestUndo(stack, NOW_MS + 11 * 60_000)).toBeUndefined();
    stack = pushUndo(stack, null, NOW_MS + 11 * 60_000);
    expect(stack).toHaveLength(0);
    const r = coreReply("desfaz", FULL_DATA, {}, { now: NOW_MS, undoLabel: "Anotar 8 × 80 kg" });
    expect(r.proposal?.source).toBe("undo");
    expect(r.text).toMatch(/Anotar 8 × 80 kg/);
  });
});
