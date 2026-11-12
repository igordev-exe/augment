import { describe, expect, it } from "vitest";
import { exById } from "../data/program";
import type { Session, SessionExercise, SetEntry } from "../data/types";
import { libraryBests } from "./online/sync";
import { E1RM_MAX_REPS, entryE1rm, prsBySession, recordsOf, stallOf, type ExerciseHistoryItem } from "./progression";
import { mesoReport } from "./report";
import { suspiciousSet } from "./sanity";
import { afterSet } from "./superset";

// Onda 1 do plano (docs/melhorias-fable-argon.md): números certos.

type S = [number, number, { kind?: SetEntry["kind"]; rir?: number }?];

function entry(exId: string, sets: S[], alt?: string): SessionExercise {
  return {
    exId,
    unit: "kg",
    alt,
    sets: sets.map(([weight, reps, o], i) => ({ id: `${exId}${i}`, kind: o?.kind ?? "work", weight, reps, rir: o?.rir, done: true })),
  };
}

function session(id: string, date: string, week: number, exercises: SessionExercise[]): Session {
  const t = Date.parse(`${date}T18:00:00`);
  return { id, date, dayId: "lower-a", week, startedAt: t, finishedAt: t + 3600_000, status: "done", exercises };
}

const HACK = "lower-a.hack";
const kinds = (s: Session, all: Session[]) => (prsBySession(all).get(s.id) ?? []).map((p) => p.kind);

describe("M1: uma régua só para o 1RM", () => {
  it("drop-set com reps altas não gera recorde de 1RM", () => {
    const a = session("a", "2026-10-05", 2, [entry(HACK, [[100, 8]])]);
    const b = session("b", "2026-10-08", 2, [
      entry(HACK, [
        [100, 8],
        [80, 20, { kind: "drop" }],
      ]),
    ]);
    expect(kinds(b, [a, b])).not.toContain("1rm");
  });
  it("série de trabalho acima de 15 reps não gera 1RM, mas a carga máxima continua valendo", () => {
    const a = session("a", "2026-10-05", 2, [entry(HACK, [[100, 8]])]);
    const b = session("b", "2026-10-08", 2, [entry(HACK, [[90, 20]])]);
    expect(kinds(b, [a, b])).not.toContain("1rm");
    const rec = recordsOf([a, b].map((s) => ({ session: s, entry: s.exercises[0] })));
    expect(rec.bestE1rm?.reps).toBe(8);
    expect(rec.mostReps?.reps).toBe(20);
    expect(E1RM_MAX_REPS).toBe(15);
  });
  it("entrada sem série válida devolve null, nunca 0 ou -Infinity", () => {
    expect(entryE1rm(entry(HACK, []), "recorde")).toBeNull();
    expect(entryE1rm(entry(HACK, [[50, 30]]), "recorde")).toBeNull();
    expect(entryE1rm(entry(HACK, [[50, 30]]), "comparacao")?.value).toBeGreaterThan(50);
  });
  it("15 → 16 → 18 reps na mesma carga não é estagnação", () => {
    const hist: ExerciseHistoryItem[] = [15, 16, 18].map((r, i) => {
      const s = session(`s${i}`, `2026-10-0${5 + i}`, 3, [entry(HACK, [[60, r]])]);
      return { session: s, entry: s.exercises[0] };
    });
    expect(stallOf(hist)).toBeNull();
  });
  it("o melhor 1RM local bate com o que sobe para o servidor", () => {
    const s = session("a", "2026-10-05", 2, [
      entry(HACK, [
        [100, 8],
        [110, 5],
        [80, 20],
      ]),
    ]);
    const local = recordsOf([{ session: s, entry: s.exercises[0] }]).bestE1rm!.value;
    const cloud = libraryBests([s]).find((r) => r.lib === exById(HACK).lib)!.e1rmKg;
    expect(cloud).toBeCloseTo(Math.round(local * 10) / 10, 5);
  });
});

describe("M1 + M2: relatório do mesociclo", () => {
  it("20 × 14 sobrando 1 na semana 1 e 20 × 16 na semana 5 é ganho, não queda", () => {
    const a = session("a", "2026-10-05", 1, [entry(HACK, [[20, 14, { rir: 1 }]])]);
    const b = session("b", "2026-11-02", 5, [entry(HACK, [[20, 16, { rir: 0 }]])]);
    const ex = mesoReport([a, b], "2026-10-05", [1, 3, 5], "2026-11-05").exercises.find((e) => e.exId === HACK)!;
    expect(ex.deltaE1rmPct).toBeGreaterThan(0);
  });
  it("último treino na alternativa mais leve não vira queda", () => {
    const own = [session("a", "2026-10-05", 1, [entry(HACK, [[100, 8]])]), session("b", "2026-10-12", 2, [entry(HACK, [[100, 10]])])];
    const alt = session("c", "2026-10-19", 3, [entry(HACK, [[60, 10]], "leg-press")]);
    const ex = mesoReport([...own, alt], "2026-10-05", [1, 3, 5], "2026-10-20").exercises.find((e) => e.exId === HACK)!;
    expect(ex.alt).toBeUndefined();
    expect(ex.deltaE1rmPct).toBeGreaterThan(0);
  });
});

describe("M3: trava contra erro de digitação", () => {
  it("800 depois de 80 dispara; 82,5 não; primeira vez não; reps absurdas disparam", () => {
    expect(suspiciousSet({ weight: 800, reps: 8 }, "kg", 80)).not.toBeNull();
    expect(suspiciousSet({ weight: 82.5, reps: 8 }, "kg", 80)).toBeNull();
    expect(suspiciousSet({ weight: 800, reps: 8 }, "kg", undefined)).toBeNull();
    expect(suspiciousSet({ weight: 25, reps: 8 }, "kg", 10)).toBeNull(); // histórico leve: 2,5× é normal
    expect(suspiciousSet({ weight: 40, reps: 80 }, "kg", 40)).not.toBeNull();
  });
});

describe("M4: superset com séries desiguais", () => {
  it("par igual: A1 → A2 sem descanso, A2 → A1 com descanso curto", () => {
    expect(afterSet({ warmup: false, order: 1, partnerPending: true, remaining: 2 })).toEqual({ rest: "none", focus: "partner" });
    expect(afterSet({ warmup: false, order: 2, partnerPending: true, remaining: 2 })).toEqual({ rest: "superset", focus: "partner" });
  });
  it("A1 maior: com o A2 já completo, o A1 descansa normal e segue nele", () => {
    expect(afterSet({ warmup: false, order: 1, partnerPending: false, remaining: 1 })).toEqual({ rest: "normal", focus: "self" });
    expect(afterSet({ warmup: false, order: 1, partnerPending: false, remaining: 0 })).toEqual({ rest: "normal", focus: "next" });
  });
  it("A2 maior: com o A1 completo, o A2 descansa normal e segue nele", () => {
    expect(afterSet({ warmup: false, order: 2, partnerPending: false, remaining: 1 })).toEqual({ rest: "normal", focus: "self" });
  });
  it("aquecimento fica no próprio exercício", () => {
    expect(afterSet({ warmup: true, order: 1, partnerPending: true, remaining: 3 })).toEqual({ rest: "warmup", focus: "self" });
  });
});
