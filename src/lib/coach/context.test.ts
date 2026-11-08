import { describe, expect, it } from "vitest";
import type { Session, SessionExercise, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { weekFor } from "../mesocycle";
import { CACHE_TTL_MS, EMPTY_CHAT, pruneExpiredToolResults, type CoachChat } from "./chat";
import {
  coachSystem,
  describeProposal,
  parseProposal,
  proposalPatch,
  runCoachTool,
  ToolInputError,
  turnContext,
  type CoachData,
} from "./context";
import { COACH_TOOLS } from "./tools";

function ex(exId: string, sets: [number, number][]): SessionExercise {
  return { exId, unit: "kg", sets: sets.map(([weight, reps], i) => ({ id: `${exId}${i}`, kind: "work", weight, reps, done: true })) };
}

const pull: Session = {
  id: "p21",
  date: "2026-10-21",
  dayId: "pull-a",
  week: 2,
  startedAt: Date.parse("2026-10-21"),
  finishedAt: Date.parse("2026-10-21") + 80 * 60000,
  status: "done",
  notes: "Academia cheia",
  checkin: { sleep: "ruim", energy: "ok", pain: "nenhuma" },
  cardio: { minutes: 20, steps: 8000 },
  exercises: [
    ex("pull-a.martelo-corda", [
      [17.5, 10],
      [17.5, 10],
      [17.5, 10],
    ]),
  ],
};
const settings: Settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-11-02" };
const data: CoachData = {
  sessions: [pull],
  settings,
  today: "2026-11-03",
  bodyLog: [{ id: "b1", date: "2026-11-01", weightKg: 82.5, waistCm: 81 }],
};

describe("treinador: contexto", () => {
  it("prompt de sistema é fixo e traz os ids das ferramentas", () => {
    const a = coachSystem("Ana");
    expect(a).toBe(coachSystem("Ana"));
    expect(a).toContain("pull-a.martelo-corda");
    expect(a).not.toContain("2026-11-03");
  });

  it("toda ferramenta definida tem implementação", () => {
    for (const t of COACH_TOOLS) {
      const input =
        t.name === "historico_exercicio"
          ? { exercicio: "pull-a.martelo-corda" }
          : t.name === "propor_ajuste"
            ? { tipo: "repetir_semana", motivo: "x" }
            : {};
      expect(() => runCoachTool(t.name, input, data)).not.toThrow();
    }
  });

  it("plano, histórico, mesociclo, biometria e treinos vêm dos registros", () => {
    const plan = runCoachTool("plano_atual", {}, data) as { semana_meso: number; ultimo_treino: { dias_atras: number } };
    expect(plan.semana_meso).toBe(1);
    expect(plan.ultimo_treino.dias_atras).toBe(13);
    const h = runCoachTool("historico_exercicio", { exercicio: "pull-a.martelo-corda" }, data) as { sessoes: { series: string }[] };
    expect(h.sessoes[0].series).toBe("17,5×10, 17,5×10, 17,5×10");
    const t = runCoachTool("treinos", { de: "2026-10-01", ate: "2026-10-31" }, data) as {
      anotacoes: string;
      checkin: object;
      cardio: { minutes: number };
    }[];
    expect(t[0].anotacoes).toBe("Academia cheia");
    expect(t[0].checkin).toMatchObject({ sleep: "ruim" });
    expect(t[0].cardio.minutes).toBe(20);

    const body = runCoachTool("corpo", {}, data) as { total_registros: number; registros: { peso_kg: number }[] };
    expect(body.total_registros).toBe(1);
    expect(body.registros[0].peso_kg).toBe(82.5);

    const meso = runCoachTool("relatorio_mesociclo", {}, data) as { semana_atual: number };
    expect(meso.semana_atual).toBe(1);
  });

  it("entrada inválida vira erro da ferramenta, não exceção genérica", () => {
    expect(() => runCoachTool("historico_exercicio", { exercicio: "nada" }, data)).toThrow(ToolInputError);
    expect(() => runCoachTool("treinos", { de: "ontem" }, data)).toThrow(ToolInputError);
    expect(() =>
      runCoachTool("propor_ajuste", { tipo: "incremento", exercicio: "pull-a.martelo-corda", valor: 50, motivo: "x" }, data),
    ).toThrow(ToolInputError);
    expect(() => runCoachTool("propor_ajuste", { tipo: "dias_treino", dias: [], motivo: "x" }, data)).toThrow(ToolInputError);
    expect(() =>
      runCoachTool("propor_ajuste", { tipo: "lembrete_exercicio", exercicio: "pull-a.martelo-corda", nota: "", motivo: "x" }, data),
    ).toThrow(ToolInputError);
    expect(() => runCoachTool("apagar_tudo", {}, data)).toThrow(ToolInputError);
  });

  it("propostas viram mudanças nos ajustes (incremento, mesociclo, deload, dias, lembrete e trocar acessório)", () => {
    const inc = parseProposal({ tipo: "incremento", exercicio: "pull-a.martelo-corda", valor: 1.25, motivo: "cabo" });
    expect(proposalPatch(inc, settings, data.today)).toEqual({ increments: { "pull-a.martelo-corda": 1.25 } });
    const restart = parseProposal({ tipo: "recomecar_mesociclo", motivo: "parado" });
    expect(proposalPatch(restart, { ...settings, mesoStart: "2026-10-12" }, data.today)).toMatchObject({ mesoStart: "2026-11-02" });
    // Semana 1: não há semana anterior para repetir.
    expect(proposalPatch(parseProposal({ tipo: "repetir_semana", motivo: "x" }), settings, data.today)).toEqual({});

    const deloadProp = parseProposal({ tipo: "antecipar_deload", motivo: "fadiga" });
    const deloadPatch = proposalPatch(deloadProp, { ...settings, mesoStart: "2026-10-05" }, data.today);
    expect(weekFor(deloadPatch.mesoStart!, data.today)).toBe(7);

    const daysProp = parseProposal({ tipo: "dias_treino", dias: [5, 1, 3, 1], motivo: "agenda" });
    expect(proposalPatch(daysProp, settings, data.today)).toEqual({ trainingDays: [1, 3, 5] });
    expect(describeProposal(daysProp, settings, data.today)).toContain("seg, qua, sex");

    const noteProp = parseProposal({
      tipo: "lembrete_exercicio",
      exercicio: "pull-a.martelo-corda",
      nota: "Cotovelo colado ao tronco",
      motivo: "técnica",
    });
    expect(proposalPatch(noteProp, settings, data.today)).toEqual({
      exerciseNotes: { "pull-a.martelo-corda": "Cotovelo colado ao tronco" },
    });

    const swapProp = parseProposal({
      tipo: "trocar_acessorio",
      exercicio: "pull-a.martelo-corda",
      alternativa: "Rosca martelo com halteres",
      motivo: "variar no próximo mesociclo",
    });
    expect(proposalPatch(swapProp, settings, data.today)).toEqual({
      swaps: { "pull-a.martelo-corda": "Rosca martelo com halteres" },
    });
  });

  it("poda tool_result antigos somente após o cache de 5 minutos expirar (sem clonar mensagens intactas)", () => {
    const bigJson = JSON.stringify({ dados: "x".repeat(300) });
    const untouchedUserMsg = { role: "user" as const, content: [{ type: "text" as const, text: "Segunda pergunta" }] };
    const chat: CoachChat = {
      ...EMPTY_CHAT,
      lastTurnAt: 1_000_000,
      messages: [
        { role: "user", content: [{ type: "text", text: "Oi" }] },
        { role: "assistant", content: [{ type: "tool_use", id: "u1", name: "plano_atual", input: {} }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "u1", content: bigJson }] },
        { role: "assistant", content: [{ type: "text", text: "Resposta 1" }] },
        untouchedUserMsg,
        { role: "assistant", content: [{ type: "text", text: "Resposta 2" }] },
        { role: "user", content: [{ type: "text", text: "Nova pergunta" }] },
      ],
    };
    // Dentro de 5 min: mantém igual para preservar o cache
    expect(pruneExpiredToolResults(chat, 1_000_000 + CACHE_TTL_MS - 1000)).toBe(chat);
    // Após 5 min: compacta o tool_result antigo e preserva a referência das mensagens que não mudaram
    const pruned = pruneExpiredToolResults(chat, 1_000_000 + CACHE_TTL_MS + 1000);
    const block = (pruned.messages[2].content as { content: string }[])[0];
    expect(block.content.length).toBeLessThan(bigJson.length);
    expect(block.content).toContain("resumido");
    expect(pruned.messages[4]).toBe(untouchedUserMsg);
  });

  it("contexto do turno traz a data (fora do sistema)", () => {
    expect(turnContext(data)).toBe("[Hoje: 2026-11-03, terça. Semana 1 do mesociclo.]");
  });
});
