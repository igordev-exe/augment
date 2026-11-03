import { describe, expect, it } from "vitest";
import type { Session, SessionExercise, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { coachSystem, parseProposal, proposalPatch, runCoachTool, ToolInputError, turnContext, type CoachData } from "./context";
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
  exercises: [
    ex("pull-a.martelo-corda", [
      [17.5, 10],
      [17.5, 10],
      [17.5, 10],
    ]),
  ],
};
const settings: Settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-11-02" };
const data: CoachData = { sessions: [pull], settings, today: "2026-11-03" };

describe("treinador: contexto", () => {
  it("prompt de sistema é fixo e traz os ids das ferramentas", () => {
    const a = coachSystem("Igor");
    expect(a).toBe(coachSystem("Igor"));
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

  it("plano, histórico e treinos vêm dos registros", () => {
    const plan = runCoachTool("plano_atual", {}, data) as { semana_meso: number; ultimo_treino: { dias_atras: number } };
    expect(plan.semana_meso).toBe(1);
    expect(plan.ultimo_treino.dias_atras).toBe(13);
    const h = runCoachTool("historico_exercicio", { exercicio: "pull-a.martelo-corda" }, data) as { sessoes: { series: string }[] };
    expect(h.sessoes[0].series).toBe("17,5×10, 17,5×10, 17,5×10");
    const t = runCoachTool("treinos", { de: "2026-10-01", ate: "2026-10-31" }, data) as { anotacoes: string; checkin: object }[];
    expect(t[0].anotacoes).toBe("Academia cheia");
    expect(t[0].checkin).toMatchObject({ sleep: "ruim" });
  });

  it("entrada inválida vira erro da ferramenta, não exceção genérica", () => {
    expect(() => runCoachTool("historico_exercicio", { exercicio: "nada" }, data)).toThrow(ToolInputError);
    expect(() => runCoachTool("treinos", { de: "ontem" }, data)).toThrow(ToolInputError);
    expect(() =>
      runCoachTool("propor_ajuste", { tipo: "incremento", exercicio: "pull-a.martelo-corda", valor: 50, motivo: "x" }, data),
    ).toThrow(ToolInputError);
    expect(() => runCoachTool("apagar_tudo", {}, data)).toThrow(ToolInputError);
  });

  it("propostas viram mudanças nos ajustes", () => {
    const inc = parseProposal({ tipo: "incremento", exercicio: "pull-a.martelo-corda", valor: 1.25, motivo: "cabo" });
    expect(proposalPatch(inc, settings, data.today)).toEqual({ increments: { "pull-a.martelo-corda": 1.25 } });
    const restart = parseProposal({ tipo: "recomecar_mesociclo", motivo: "parado" });
    expect(proposalPatch(restart, { ...settings, mesoStart: "2026-10-12" }, data.today)).toMatchObject({ mesoStart: "2026-11-02" });
    // Semana 1: não há semana anterior para repetir.
    expect(proposalPatch(parseProposal({ tipo: "repetir_semana", motivo: "x" }), settings, data.today)).toEqual({});
  });

  it("contexto do turno traz a data (fora do sistema)", () => {
    expect(turnContext(data)).toBe("[Hoje: 2026-11-03, terça. Semana 1 do mesociclo.]");
  });
});
