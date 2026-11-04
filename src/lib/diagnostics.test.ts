import { describe, expect, it } from "vitest";
import { LIB_BY_ID } from "../data/library";
import { EXERCISE_EVIDENCE, PRINCIPLES } from "../data/science";
import type { Session, SessionExercise } from "../data/types";
import { equipOf } from "../screens/Exercises";
import { DEFAULT_SETTINGS } from "./db";
import { engineDiagnostics } from "./diagnostics";

function ex(exId: string, reps: number[], w = 60): SessionExercise {
  return { exId, unit: "kg", sets: reps.map((r, i) => ({ id: `${exId}${i}`, kind: "work" as const, weight: w, reps: r, done: true })) };
}
function session(date: string, dayId: string, exercises: SessionExercise[]): Session {
  const t = Date.parse(date);
  return { id: `${dayId}-${date}`, date, dayId, week: 4, startedAt: t, finishedAt: t + 1, status: "done", exercises };
}
const settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-10-05" };

describe("diagnóstico do motor", () => {
  it("sem treinos: nada a diagnosticar", () => {
    expect(engineDiagnostics({ sessions: [], settings, bodyLog: [], today: "2026-11-04" })).toEqual([]);
  });

  it("reps caindo na mesma carga aparecem em FADIGA; o próximo treino diz o que sobe", () => {
    const ss = (
      [
        ["2026-10-26", 11],
        ["2026-10-30", 10],
        ["2026-11-03", 9],
      ] as const
    ).map(([date, r]) => session(date, "push-a", [ex("push-a.supino-maq", [r, r, r])]));
    const d = engineDiagnostics({ sessions: ss, settings, bodyLog: [], today: "2026-11-04" });
    expect(d.find((x) => x.area === "FADIGA")?.title).toBe("Reps caindo na mesma carga");
    expect(d.find((x) => x.area === "PROGR" && x.title.startsWith("Próximo treino"))).toBeDefined();
  });

  it("ajustes de séries ativos aparecem em AJUSTE", () => {
    const s = session("2026-11-02", "push-a", [ex("push-a.supino-maq", [10, 10, 10])]);
    const d = engineDiagnostics({
      sessions: [s],
      settings: { ...settings, setAdjust: { "push-a.supino-maq": 1 } },
      bodyLog: [],
      today: "2026-11-04",
    });
    expect(d.find((x) => x.area === "AJUSTE")?.text).toContain("+1");
  });
});

describe("oficina de exercícios", () => {
  it("equipamento classificado pelo texto da biblioteca", () => {
    expect(equipOf(LIB_BY_ID["triceps-corda"].equipment)).toBe("cabo");
    expect(equipOf(LIB_BY_ID["hack"].equipment)).toBe("maquina");
    expect(equipOf(LIB_BY_ID["rosca-inclinada"].equipment)).toBe("halteres");
    expect(equipOf(LIB_BY_ID["abdominal-roda"].equipment)).toBe("livre");
  });

  it("etiquetas de evidência apontam para exercícios e princípios que existem", () => {
    const ids = new Set(PRINCIPLES.map((p) => p.id));
    for (const [lib, ev] of Object.entries(EXERCISE_EVIDENCE)) {
      expect(LIB_BY_ID[lib], lib).toBeDefined();
      expect(ids.has(ev.why), ev.why).toBe(true);
    }
  });
});
