import { describe, expect, it } from "vitest";
import { exById, synergistsOf } from "../data/program";
import type { BodyEntry, Session, SessionExercise } from "../data/types";
import { DEFAULT_SETTINGS } from "./db";
import { addDays } from "./dates";
import { EMPTY_OPERATOR_MEMORY, operatorState, sanitizeOperatorMemory } from "./core/operator";
import { handleIntent } from "./core/intents";
import { weekStreaks, weightLine, weightTrend } from "./visual";

// Onda 3 do plano (docs/melhorias-fable-argon.md): corpo e recuperação.

describe("M10: linha do peso pelo tempo", () => {
  it("pesagens espaçadas não misturam semanas: a média é só dos últimos 7 dias", () => {
    const pts = [
      { date: "2026-10-01", kg: 95 },
      { date: "2026-10-20", kg: 90 },
      { date: "2026-10-22", kg: 90 },
    ];
    // Pela contagem (7 últimos registros) daria 91,7; pelo tempo, o 95 de 3 semanas antes fica de fora.
    expect(weightLine(pts)[2].kg).toBeCloseTo(90, 5);
  });
  it("três pesagens no mesmo dia não pesam mais que a pesagem de outro dia", () => {
    const pts = [
      { date: "2026-10-01", kg: 90 },
      { date: "2026-10-02", kg: 92 },
      { date: "2026-10-02", kg: 92 },
      { date: "2026-10-02", kg: 92 },
    ];
    // 90 cobre 1 dia, 92 (média do dia) vale 1 dia: 91.
    expect(weightLine(pts)[3].kg).toBeCloseTo(91, 5);
  });
  it("ritmo semanal: um pico de 2 kg saindo da janela move menos de 0,15 kg/semana (por isso a conta ficou)", () => {
    const base = "2026-09-01";
    const mk = (n: number, spikeAt: number | null): BodyEntry[] =>
      Array.from({ length: n + 1 }, (_, i) => ({ id: `${i}`, date: addDays(base, i), weightKg: i === spikeAt ? 92 : 90 - i * 0.02 }));
    const inside = weightTrend(mk(58, 30))!.kgPerWeek;
    const outside = weightTrend(mk(59, 30))!.kgPerWeek;
    expect(Math.abs(inside - outside)).toBeLessThan(0.15);
  });
});

describe("M11: recuperação conta o trabalho indireto", () => {
  const testa = exById("push-a.testa-halt");
  const supino = exById("push-a.supino-incl-halt");

  function sess(id: string, date: string, entries: SessionExercise[]): Session {
    const t = Date.parse(`${date}T19:00:00`);
    return {
      id,
      dayId: "push-a",
      date,
      week: 2,
      startedAt: t,
      finishedAt: t + 3600_000,
      status: "done",
      checkin: { sleep: "ok" },
      exercises: entries,
    };
  }
  const sets = (w: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${i}`, kind: "work" as const, weight: w, reps: 10, done: true }));
  // Tríceps a cada 3 dias, sempre com "volume pesado" (o sinal de recuperação lenta).
  const triceps = (date: string) =>
    sess(`t${date}`, date, [{ exId: testa.id, unit: "kg", sets: sets(14, 3), feedback: { volume: "pesado" } }]);
  const press = (date: string) => sess(`p${date}`, date, [{ exId: supino.id, unit: "kg", sets: sets(30, 5) }]);
  const days = [0, 3, 6, 9, 12, 15].map((d) => addDays("2026-09-07", d));
  const today = "2026-09-25";

  it("o supino conta como trabalho indireto do tríceps", () => {
    expect(synergistsOf(supino)).toContain("triceps");
  });
  it("supino pesado entre dois treinos de tríceps não ensina mais 'tríceps recupera devagar'", () => {
    const alone = operatorState(days.map(triceps), [], DEFAULT_SETTINGS, EMPTY_OPERATOR_MEMORY, today);
    const withPress = operatorState(
      [...days.map(triceps), ...days.slice(0, -1).map((d) => press(addDays(d, 1)))],
      [],
      DEFAULT_SETTINGS,
      EMPTY_OPERATOR_MEMORY,
      today,
    );
    expect(alone.muscles.triceps.recoveryMultiplier).toBeGreaterThan(1);
    expect(withPress.muscles.triceps.recoveryMultiplier).toBe(1);
  });
});

describe("M12: semana justificada não quebra a sequência", () => {
  const done = (date: string): Session => ({
    id: date,
    dayId: "push-a",
    date,
    week: 2,
    startedAt: 0,
    status: "done",
    exercises: [],
  });
  // 3 treinos por semana em 4 semanas, menos a 3ª (doente).
  const weeks = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
  const sessions = weeks.filter((w) => w !== "2026-10-19").flatMap((m) => [0, 2, 4].map((d) => done(addDays(m, d))));
  const today = "2026-10-30";

  it("sem ausência declarada, a semana vazia zera a sequência", () => {
    expect(weekStreaks(sessions, today, 3).streak).toBe(1);
  });
  it("com ausência declarada, a semana fica congelada: não zera nem conta", () => {
    const away = [{ from: "2026-10-19", until: "2026-10-23" }];
    expect(weekStreaks(sessions, today, 3, away).streak).toBe(3);
  });
});

describe("M12: o chat propõe guardar a ausência", () => {
  it("'fiquei doente' propõe a ausência do dia seguinte ao último treino até hoje, sem gravar sozinho", () => {
    const last: Session = { id: "x", dayId: "push-a", date: "2026-10-16", week: 2, startedAt: 0, status: "done", exercises: [] };
    const res = handleIntent("fiquei doente a semana toda", { sessions: [last], settings: DEFAULT_SETTINGS, today: "2026-10-23" });
    expect(res.intent?.kind).toBe("faltei_treino");
    expect(res.proposal?.absence).toEqual({ from: "2026-10-17", until: "2026-10-23" });
    expect(res.proposal?.constraint).toBeUndefined();
  });
  it("treinou ontem: não propõe ausência", () => {
    const last: Session = { id: "x", dayId: "push-a", date: "2026-10-22", week: 2, startedAt: 0, status: "done", exercises: [] };
    const res = handleIntent("faltei hoje", { sessions: [last], settings: DEFAULT_SETTINGS, today: "2026-10-23" });
    expect(res.proposal).toBeUndefined();
  });
  it("a memória guarda ausências válidas e descarta lixo", () => {
    const m = sanitizeOperatorMemory({
      constraints: [],
      mesoHistory: [],
      absences: [
        { from: "2026-10-17", until: "2026-10-23" },
        { from: "x", until: "y" },
        { from: "2026-10-30", until: "2026-10-01" },
      ],
    });
    expect(m.absences).toEqual([{ from: "2026-10-17", until: "2026-10-23" }]);
  });
});
