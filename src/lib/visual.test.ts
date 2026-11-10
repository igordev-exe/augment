import { describe, expect, it } from "vitest";
import type { BodyEntry, Session, SessionExercise } from "../data/types";
import {
  activityGrid,
  bodyweightAt,
  dailySets,
  fatigueLevel,
  fatiguePct,
  goalStatus,
  hoursToReady,
  muscleStatus,
  readiness,
  recoveryHours,
  relativeStrength,
  weekStreaks,
  weightTrend,
} from "./visual";

function entry(exId: string, sets: [number, number][]): SessionExercise {
  return { exId, unit: "kg", sets: sets.map(([w, r], i) => ({ id: `${i}`, kind: "work", weight: w, reps: r, done: true })) };
}

function session(id: string, date: string, exercises: SessionExercise[], hour = 18): Session {
  const startedAt = Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00`);
  return { id, date, dayId: "lower-a", week: 3, startedAt, finishedAt: startedAt + 3600_000, status: "done", exercises };
}

const hack = (date: string, sets = 4, w = 100) =>
  session(date, date, [
    entry(
      "lower-a.hack",
      Array.from({ length: sets }, () => [w, 8] as [number, number]),
    ),
  ]);

describe("mapa muscular", () => {
  it("recuperação depende do volume e do tempo desde o treino", () => {
    expect(recoveryHours(3)).toBe(36);
    expect(recoveryHours(4)).toBe(48);
    expect(recoveryHours(8)).toBe(72);

    const s = hack("2026-11-02"); // termina 19h do dia 2
    const now = Date.parse("2026-11-03T19:00:00"); // 24 h depois, 4 séries → 48 h
    const st = muscleStatus([s], 3, "2026-11-03", now);
    expect(st.quadriceps.sets).toBe(4);
    expect(st.quadriceps.state).toBe("recuperando");
    expect(st.quadriceps.recovery).toBeCloseTo(0.5, 2);
    expect(st.quadriceps.daysSince).toBe(1);
    expect(st.peito.state).toBe("sem-treino");
    expect(st.peito.lastDate).toBeUndefined();

    const later = muscleStatus([s], 3, "2026-11-08", Date.parse("2026-11-08T12:00:00"));
    expect(later.quadriceps.state).toBe("atrasado");
    const muchLater = muscleStatus([s], 3, "2026-11-12", Date.parse("2026-11-12T12:00:00"));
    expect(muchLater.quadriceps.state).toBe("sem-treino");
    const ready = muscleStatus([s], 3, "2026-11-05", Date.parse("2026-11-05T12:00:00"));
    expect(ready.quadriceps.state).toBe("pronto");
  });

  it("contabiliza sinergistas dos compostos na fadiga dos deltoides e braços", () => {
    const pushA: Session = {
      id: "pa",
      date: "2026-11-03",
      dayId: "push-a",
      week: 3,
      startedAt: Date.parse("2026-11-03T09:00:00"),
      finishedAt: Date.parse("2026-11-03T10:00:00"),
      status: "done",
      exercises: [
        entry("push-a.supino-incl-halt", [
          [30, 8],
          [30, 8],
          [30, 8],
          [30, 8],
        ]),
        entry("push-a.supino-maq", [
          [70, 10],
          [70, 10],
          [70, 10],
        ]),
        entry("push-a.desenv-maq", [
          [50, 10],
          [50, 10],
          [50, 10],
        ]),
        entry("push-a.lateral-cabo", [
          [10, 15],
          [10, 15],
          [10, 15],
          [10, 15],
        ]),
      ],
    };
    const st = muscleStatus([pushA], 3, "2026-11-03", Date.parse("2026-11-03T18:00:00"), { "push-a.supino-maq": 1 });
    expect(fatigueLevel(fatiguePct(st.deltAnterior))).toBe("critico");
    expect(fatigueLevel(fatiguePct(st.deltLateral))).toBe("critico");
    expect(fatigueLevel(fatiguePct(st.triceps))).toBe("critico");
    expect(st.peito.target).toBe(14);
  });
});

describe("mapa de fadiga", () => {
  it("fadiga é o que falta recuperar, com faixas 50/75", () => {
    const s = hack("2026-11-02"); // 4 séries → 48 h, termina 19h do dia 2
    const st = muscleStatus([s], 3, "2026-11-03", Date.parse("2026-11-02T23:00:00")); // 4 h depois
    expect(fatiguePct(st.quadriceps)).toBe(92);
    expect(fatigueLevel(fatiguePct(st.quadriceps))).toBe("critico");
    expect(hoursToReady(st.quadriceps)).toBe(44);
    expect(fatiguePct(st.peito)).toBe(0); // nunca treinado não conta como cansado
    expect(fatigueLevel(74)).toBe("atencao");
    expect(fatigueLevel(49)).toBe("estavel");
    expect(readiness(st, ["quadriceps", "peito"])).toBe(54);
    expect(readiness(st, [])).toBe(100);
  });

  it("séries por dia nos últimos 7 dias", () => {
    const days = dailySets([hack("2026-11-03", 5), hack("2026-11-01", 3), hack("2026-10-20", 4)], "2026-11-03");
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ date: "2026-11-03", sets: 5 });
    expect(days[4]).toEqual({ date: "2026-11-01", sets: 3 });
    expect(days.reduce((a, d) => a + d.sets, 0)).toBe(8);
  });
});

describe("atividade do ano", () => {
  it("monta 53 semanas e dá intensidade pelos sets", () => {
    const grid = activityGrid([hack("2026-11-02", 2), hack("2026-10-27", 6), hack("2025-01-01", 4)], "2026-11-03", 5);
    expect(grid.weeks).toHaveLength(53);
    expect(grid.weeks[52]).toBe("2026-11-02");
    expect(grid.totalSessions).toBe(2); // o de 2025 fica fora da janela
    expect(grid.days.get("2026-10-27")!.level).toBe(4);
    expect(grid.days.get("2026-11-02")!.level).toBeLessThan(4);
  });

  it("sequência de semanas na meta: semana atual não quebra", () => {
    const weeks = ["2026-10-12", "2026-10-19", "2026-10-26"];
    const sessions = weeks.flatMap((w) => [0, 1].map((d) => hack(addDay(w, d))));
    // Semana atual (2026-11-02) ainda sem treinos: sequência continua 3.
    expect(weekStreaks(sessions, "2026-11-03", 2)).toEqual({ streak: 3, longest: 3 });
    // Uma semana falhada no meio quebra.
    const broken = sessions.filter((s) => !s.date.startsWith("2026-10-2") || s.date >= "2026-10-26");
    expect(weekStreaks(broken, "2026-11-03", 2).streak).toBe(1);
    expect(weekStreaks(broken, "2026-11-03", 2).longest).toBe(1);
  });
});

function addDay(d: string, n: number): string {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

const body = (date: string, weightKg: number, id = date): BodyEntry => ({ id, date, weightKg });

describe("peso corporal", () => {
  it("ritmo semanal por regressão e status da meta", () => {
    const entries = [body("2026-10-06", 80), body("2026-10-13", 80.3), body("2026-10-20", 80.6), body("2026-10-27", 80.9)];
    const t = weightTrend(entries)!;
    expect(t.current).toBe(80.9);
    expect(t.kgPerWeek).toBeCloseTo(0.3, 3);
    expect(t.pctPerWeek).toBeCloseTo(0.371, 2);

    const gain = goalStatus(t, { mode: "ganhar", targetKg: 83 })!;
    expect(gain.pace).toBe("no-ritmo");
    expect(gain.remainingKg).toBe(2.1);
    expect(gain.etaWeeks).toBe(7);

    expect(goalStatus(t, { mode: "perder", targetKg: 75 })!.pace).toBe("contrario");
    expect(goalStatus(t, { mode: "perder", targetKg: 75 })!.etaWeeks).toBeUndefined();
    expect(goalStatus(t, { mode: "manter" })!.pace).toBe("rapido");
    expect(goalStatus(t, undefined)).toBeNull();
  });

  it("um ponto só não dá ritmo", () => {
    const t = weightTrend([body("2026-10-27", 82)])!;
    expect(t.spanDays).toBe(0);
    expect(goalStatus(t, { mode: "ganhar" })!.pace).toBe("sem-dados");
    expect(weightTrend([])).toBeNull();
  });

  it("peso da época e força relativa", () => {
    const entries = [body("2026-10-01", 80), body("2026-10-20", 82)];
    expect(bodyweightAt(entries, "2026-10-10")).toBe(80);
    expect(bodyweightAt(entries, "2026-10-25")).toBe(82);
    expect(bodyweightAt(entries, "2026-09-20")).toBe(80); // até 30 dias antes da primeira pesagem
    expect(bodyweightAt(entries, "2026-08-01")).toBeNull();

    const rel = relativeStrength([hack("2026-10-05", 4, 100), hack("2026-10-26", 4, 110)], entries);
    const h = rel.find((r) => r.exId === "lower-a.hack")!;
    expect(h.sessions).toBe(2);
    expect(h.bodyweightKg).toBe(82);
    expect(h.ratio).toBeCloseTo(h.e1rmKg / 82, 5);
    expect(h.deltaPct).toBeGreaterThan(0);
  });
});
