import { describe, expect, it } from "vitest";
import { DAY_BY_ID, EXERCISE_BY_ID, shortName } from "../data/program";
import { PRINCIPLES } from "../data/science";
import type { BodyEntry, Session, SessionExercise, SetEntry } from "../data/types";
import { bodyAdvice, ENGINE_RULES, intensifierPlan, liveNudges, regressingExercises, volumeAdvice, type LiveInput } from "./engine";
import { describeProposal, parseProposal, proposalPatch } from "./coach/context";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./db";
import { fatigueDeloadFor, setsFor, withSetAdjust } from "./mesocycle";
import { loadRef, regressionOf, suggest, suggestNext, type ExerciseHistoryItem } from "./progression";
import { weeklyReport } from "./report";
import { buildSession, plannedVolume } from "./sessions";

// Motor de decisões: regras ao vivo, entre sessões, fadiga, peso e fim de mesociclo.

type S = [number, number, number?]; // peso, reps, rir

function sets(list: S[], t0 = 0, gap = 0): SetEntry[] {
  return list.map(([weight, reps, rir], i) => ({
    id: `s${i}`,
    kind: "work",
    weight,
    reps,
    rir,
    done: true,
    doneAt: gap ? t0 + i * gap * 1000 : undefined,
  }));
}

function entry(exId: string, list: S[], extra: Partial<SessionExercise> = {}): SessionExercise {
  return { exId, unit: "kg", sets: sets(list), ...extra };
}

function session(date: string, dayId: string, exercises: SessionExercise[], week = 3, extra: Partial<Session> = {}): Session {
  const t = Date.parse(date);
  return { id: `${dayId}-${date}`, date, dayId, week, startedAt: t, finishedAt: t + 70 * 60000, status: "done", exercises, ...extra };
}

const SUPINO = EXERCISE_BY_ID["push-a.supino-incl-halt"]; // 4×6–10, falha técnica, 3 min
const LATERAL = EXERCISE_BY_ID["push-a.lateral-cabo"]; // 4×12–20, falha, intensificador
const MAQ = EXERCISE_BY_ID["push-a.supino-maq"]; // 3×8–12, falha técnica, 2 min

function live(partial: Partial<LiveInput> & Pick<LiveInput, "ex" | "entry">): ReturnType<typeof liveNudges> {
  return liveNudges({ week: 3, lowDay: false, history: [], plannedSets: 4, step: 2, intensifier: false, ...partial });
}

const ids = (n: { id: string }[]) => n.map((x) => x.id);

describe("motor: catálogo", () => {
  it("toda regra aponta para um princípio que existe", () => {
    const known = new Set(PRINCIPLES.map((p) => p.id));
    for (const r of ENGINE_RULES) expect(known.has(r.why), r.id).toBe(true);
  });
});

describe("motor: entre sessões", () => {
  it("série-âncora: progride pela 1ª série, não pela carga das leves", () => {
    const e = entry(SUPINO.id, [
      [30, 8],
      [26, 10],
      [26, 9],
      [26, 9],
    ]);
    expect(loadRef(e.sets)).toMatchObject({ load: 30, anchor: true, volumeLoad: 26 });
    const same = suggest(SUPINO, e, 4, 3, 2, 3);
    expect(same.kind).toBe("same");
    expect(same.weight).toBe(30);
    expect(same.volumeWeight).toBe(26);
    expect(same.targets[0]).toBe(9);

    const top = entry(SUPINO.id, [
      [30, 10],
      [26, 10],
      [26, 9],
    ]);
    const up = suggest(SUPINO, top, 4, 3, 2, 3);
    expect(up.kind).toBe("up");
    expect(up.weight).toBe(32);
    expect(up.volumeWeight).toBeCloseTo(28, 0);
  });

  it("buildSession pré-preenche âncora e volume com cargas diferentes", () => {
    const prev = session("2026-10-19", "push-a", [
      entry(SUPINO.id, [
        [30, 8],
        [26, 10],
        [26, 9],
      ]),
    ]);
    const s = buildSession("push-a", "2026-10-26", 3, DEFAULT_SETTINGS, [prev]);
    const work = s.exercises[0].sets.filter((x) => x.kind === "work").map((x) => x.weight);
    expect(work).toEqual([30, 26, 26, 26]);
  });

  it("sobrou 2+ além da meta em todas as séries → sobe já, se a previsão cabe na faixa", () => {
    const e = entry(MAQ.id, [
      [60, 10, 4],
      [60, 10, 4],
      [60, 9, 4],
    ]);
    const s = suggest(MAQ, e, 3, 3, 2.5, 3);
    expect(s.kind).toBe("up");
    expect(s.weight).toBe(62.5);
    expect(s.title).toContain("sobrou");
    // Sem RIR marcado continua a dupla progressão normal.
    const plain = suggest(MAQ, entry(MAQ.id, [[60, 10], [60, 10], [60, 9]]), 3, 3, 2.5, 3); // prettier-ignore
    expect(plain.kind).toBe("same");
  });

  it("reps caindo com a mesma carga em 2 sessões seguidas → nota de fadiga", () => {
    const hist: ExerciseHistoryItem[] = [
      [11, 10, 10],
      [10, 9, 9],
      [9, 8, 8],
    ].map((reps, i) => {
      const e = entry(
        MAQ.id,
        reps.map((r) => [60, r] as S),
      );
      return { session: session(`2026-10-${10 + i * 7}`, "push-a", [e]), entry: e };
    });
    expect(regressionOf(hist)?.trail).toHaveLength(3);
    const s = suggestNext(MAQ, hist, 3, 4, 2.5);
    expect(s.notes.some((n) => n.includes("Reps caindo"))).toBe(true);
    // Caiu porque parou mais longe da falha (RIR maior): não é regressão.
    const easier = hist.map((h, i) => ({ ...h, entry: { ...h.entry, sets: h.entry.sets.map((x) => ({ ...x, rir: i })) } }));
    expect(regressionOf(easier)).toBeNull();
  });

  it("fadiga: queda de reps + articulação = dois sinais → propõe deload", () => {
    const s1 = session("2026-10-12", "push-a", [entry(MAQ.id, [[60, 10]], { feedback: { joint: "incomodou" } })], 3);
    const s2 = session("2026-10-13", "pull-a", [], 3);
    expect(fatigueDeloadFor([s1, s2], "2026-09-28", "2026-10-14")).toBeNull();
    const alert = fatigueDeloadFor([s1, s2], "2026-09-28", "2026-10-14", undefined, ["Supino na máquina"]);
    expect(alert?.regressingExs).toBe(1);
    expect(alert?.reasons.join(" ")).toContain("reps caindo");
  });

  it("regressingExercises acha exercícios regredindo nos últimos 10 dias", () => {
    const ss = [11, 10, 9].map((r, i) => session(`2026-10-${String(1 + i * 7).padStart(2, "0")}`, "push-a", [entry(MAQ.id, [[60, r], [60, r]])])); // prettier-ignore
    expect(regressingExercises(ss, "2026-10-17")).toEqual([shortName(MAQ)]);
  });
});

describe("motor: ao vivo", () => {
  it("composto marcado com 0 sobrando → aviso", () => {
    const n = live({ ex: SUPINO, entry: entry(SUPINO.id, [[30, 9, 0]]) });
    expect(ids(n)).toContain("falha-composto");
    expect(n[0].toast).toBe(true);
  });

  it("isolado à falha na semana 1 → segurar; sobrando demais → ir mais perto", () => {
    expect(ids(live({ ex: LATERAL, entry: entry(LATERAL.id, [[10, 15, 0]]), week: 1 }))).toContain("falha-cedo");
    const far = live({ ex: LATERAL, entry: entry(LATERAL.id, [[10, 15, 3]]), week: 4 });
    expect(ids(far)).toContain("longe-da-falha");
    expect(ids(live({ ex: LATERAL, entry: entry(LATERAL.id, [[10, 15, 1]]), week: 4 }))).not.toContain("longe-da-falha");
  });

  it("descanso curto que custou reps → aviso; com o descanso da ficha, nada", () => {
    const e: SessionExercise = { exId: MAQ.id, unit: "kg", sets: sets([[60, 11], [60, 8]], 1_000_000, 70) }; // prettier-ignore
    expect(ids(live({ ex: MAQ, entry: e, plannedSets: 3 }))).toContain("descanso-curto");
    const ok: SessionExercise = { exId: MAQ.id, unit: "kg", sets: sets([[60, 11], [60, 8]], 1_000_000, 160) }; // prettier-ignore
    expect(ids(live({ ex: MAQ, entry: ok, plannedSets: 3 }))).not.toContain("descanso-curto");
  });

  it("1ª série 2+ reps abaixo da última vez com a mesma carga → dia abaixo do normal", () => {
    const prev = entry(MAQ.id, [[60, 11], [60, 10]]); // prettier-ignore
    const history = [{ session: session("2026-10-19", "push-a", [prev]), entry: prev }];
    expect(ids(live({ ex: MAQ, entry: entry(MAQ.id, [[60, 8]]), history, plannedSets: 3 }))).toContain("abaixo-do-normal");
    expect(ids(live({ ex: MAQ, entry: entry(MAQ.id, [[60, 10]]), history, plannedSets: 3 }))).not.toContain("abaixo-do-normal");
  });

  it("recorde de reps na carga, na hora", () => {
    const prev = entry(MAQ.id, [[60, 10]]);
    const history = [{ session: session("2026-10-19", "push-a", [prev]), entry: prev }];
    const n = live({ ex: MAQ, entry: entry(MAQ.id, [[60, 12]]), history, plannedSets: 3 });
    expect(n.find((x) => x.id === "recorde-reps")?.text).toContain("12 (antes 10)");
  });

  it("intensificador só na última série e só com a cota liberada", () => {
    const e: SessionExercise = {
      exId: LATERAL.id,
      unit: "kg",
      sets: [...sets([[10, 16], [10, 15], [10, 14]]), { id: "x", kind: "work", weight: 10, reps: null, done: false }], // prettier-ignore
    };
    expect(ids(live({ ex: LATERAL, entry: e, intensifier: true }))).toContain("intensificador");
    expect(ids(live({ ex: LATERAL, entry: e, intensifier: false }))).not.toContain("intensificador");
  });

  it("teto batido ao terminar → diz a carga da próxima sessão", () => {
    const n = live({ ex: MAQ, entry: entry(MAQ.id, [[60, 12], [60, 12], [60, 12]]), plannedSets: 3, step: 2.5 }); // prettier-ignore
    expect(n.find((x) => x.id === "meta-batida")?.text).toContain("62,5");
  });

  it("cota de intensificadores da semana (Push A tem 2)", () => {
    const push = DAY_BY_ID["push-a"].exercises;
    expect(intensifierPlan(push, 2, false).size).toBe(0);
    expect(intensifierPlan(push, 3, false).size).toBe(1);
    expect(intensifierPlan(push, 4, false).size).toBe(2);
    expect(intensifierPlan(push, 5, true).size).toBe(0);
  });
});

describe("motor: peso corporal (plano alimentar)", () => {
  const goal = { mode: "perder" as const };
  function log(weeklyKg: number[], waist?: [number, number]): BodyEntry[] {
    // 3 semanas terminando em 2026-11-04, 3 pesagens por semana; weeklyKg = média de cada semana (mais antiga primeiro).
    const out: BodyEntry[] = [{ id: "start", date: "2026-09-20", weightKg: weeklyKg[0] + 1 }];
    weeklyKg.forEach((kg, w) => {
      for (const d of [1, 3, 5]) {
        const date = new Date(Date.parse("2026-10-14") + (w * 7 + d) * 86400000).toISOString().slice(0, 10);
        out.push({ id: `${w}${d}`, date, weightKg: kg });
      }
    });
    if (waist) {
      out.push({ id: "w1", date: "2026-10-15", waistCm: waist[0] });
      out.push({ id: "w2", date: "2026-11-03", waistCm: waist[1] });
    }
    return out;
  }

  it("primeiras 2 semanas: só observa", () => {
    const n = bodyAdvice([{ id: "a", date: "2026-10-30", weightKg: 94 }], goal, [], "2026-11-04");
    expect(n[0].text).toContain("água");
  });

  it("perdendo devagar 2 semanas → −130 kcal; rápido → +130; na faixa → não mexa", () => {
    expect(bodyAdvice(log([94, 93.9, 93.8]), goal, [], "2026-11-04")[0].text).toContain("Tire ~130 kcal");
    expect(bodyAdvice(log([94, 93, 92]), goal, [], "2026-11-04")[0].text).toContain("Acrescente ~130 kcal");
    expect(bodyAdvice(log([94, 93.5, 93]), goal, [], "2026-11-04")[0].text).toContain("Não mexa");
  });

  it("peso parado + cintura caindo + cargas subindo = recomposição", () => {
    const ss = [session("2026-10-20", "push-a", [entry(MAQ.id, [[60, 9]])]), session("2026-10-27", "push-a", [entry(MAQ.id, [[60, 11]])])];
    const n = bodyAdvice(log([94, 93.95, 93.9], [100, 98]), goal, ss, "2026-11-04");
    expect(n[0]).toMatchObject({ tone: "good", why: "recomposicao" });
  });
});

describe("motor: relatórios", () => {
  it("descanso real curto aparece nos sinais da semana", () => {
    const e: SessionExercise = { exId: MAQ.id, unit: "kg", sets: sets([[60, 11], [60, 9], [60, 8]], 1_000_000, 60) }; // prettier-ignore
    const r = weeklyReport([session("2026-10-19", "push-a", [e])], "2026-10-19", "2026-10-05", [1, 2, 3, 4, 5], "2026-10-21");
    expect(r.signals.some((s) => s.startsWith(`Descanso curto em ${shortName(MAQ)}`))).toBe(true);
  });

  it("fim do mesociclo: leve e subindo → +1 série; pesado → −1", () => {
    const fb = (volume: "leve" | "pesado") => entry(MAQ.id, [[60, 10]], { feedback: { volume, pump: "bom", joint: "ok" } });
    const leve = [1, 2, 3].map((i) => session(`2026-10-0${i}`, "push-a", [fb("leve")]));
    expect(volumeAdvice(leve, { [MAQ.id]: 4 }, () => 3)).toEqual([expect.objectContaining({ exId: MAQ.id, change: 1 })]);
    expect(volumeAdvice(leve, { [MAQ.id]: 4 }, () => 4)).toEqual([]); // já no teto de 4 séries
    const pesado = [1, 2, 3].map((i) => session(`2026-10-0${i}`, "push-a", [fb("pesado")]));
    expect(volumeAdvice(pesado, { [MAQ.id]: 0 }, () => 3)[0].change).toBe(-1);
  });
});

describe("ajuste de séries (fim de mesociclo)", () => {
  it("setsFor aplica o ajuste sobre a ficha, com as regras da semana por cima e teto de 4", () => {
    const crucifixo = EXERCISE_BY_ID["push-a.crucifixo-cabo"]; // 3 séries, isolado, ▲
    expect(setsFor(crucifixo, 3, 1)).toBe(4);
    expect(setsFor(crucifixo, 4, 1)).toBe(4); // ▲ não passa de 4
    expect(setsFor(crucifixo, 7, 1)).toBe(2); // deload: metade de 4
    expect(setsFor(crucifixo, 1, -1)).toBe(1); // semana 1: −1 dos isolados
    expect(setsFor(crucifixo, 3)).toBe(3);
  });

  it("treino novo, volume planejado e séries faltando usam o ajuste", () => {
    const settings = { ...DEFAULT_SETTINGS, setAdjust: { [MAQ.id]: 1 } };
    const s = buildSession("push-a", "2026-10-26", 3, settings, []);
    expect(s.exercises.find((e) => e.exId === MAQ.id)!.sets.filter((x) => x.kind === "work")).toHaveLength(4);
    expect(plannedVolume(3, false, settings.setAdjust).peito).toBe(plannedVolume(3).peito + 1);
    const done = session("2026-10-19", "push-a", [entry(MAQ.id, [[60, 10], [60, 10], [60, 10]])]); // prettier-ignore
    const r = weeklyReport([done], "2026-10-19", "2026-10-05", [1, 2, 3, 4, 5], "2026-10-26", settings.setAdjust);
    expect(r.shortfalls).toEqual([expect.objectContaining({ exId: MAQ.id, done: 3, planned: 4 })]);
  });

  it("backup: só aceita inteiros de −2 a +2 diferentes de zero", () => {
    const s = sanitizeSettings({ setAdjust: { a: 1, b: 0, c: 3, d: "1", e: -2, f: 0.5 } });
    expect(s.setAdjust).toEqual({ a: 1, e: -2 });
    expect(withSetAdjust({ a: 1 }, "a", 0)).toEqual({});
  });

  it("treinador: proposta ajustar_series com limite de 2 a 4 séries", () => {
    const p = parseProposal({ tipo: "ajustar_series", exercicio: MAQ.id, valor: 1, motivo: "leve e subindo" });
    expect(describeProposal(p, DEFAULT_SETTINGS, "2026-11-04")).toContain("3 → 4 séries");
    expect(proposalPatch(p, DEFAULT_SETTINGS, "2026-11-04")).toEqual({ setAdjust: { [MAQ.id]: 1 } });
    expect(() => parseProposal({ tipo: "ajustar_series", exercicio: SUPINO.id, valor: 1, motivo: "x" })).toThrow(/limite/);
    const undo = parseProposal({ tipo: "ajustar_series", exercicio: MAQ.id, valor: 0, motivo: "voltar" });
    expect(proposalPatch(undo, { ...DEFAULT_SETTINGS, setAdjust: { [MAQ.id]: 1 } }, "2026-11-04")).toEqual({ setAdjust: {} });
  });
});
