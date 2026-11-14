import { describe, expect, it } from "vitest";
import { programDays } from "../../data/program";
import type { Session, SetEntry, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { simulateLiveOperator, SIM_EXERCISES } from "./backtest";
import { CUE_CAP, ignoredRules, isLowForm, judgeLog, logCue, MUTE_MIN, pickCue, sanitizeLiveLog, type Cue } from "./director";
import { dayForm, dropModel, liveState, personalEpley, predictFromPrevious, REST_OVER_TOP, restAfter } from "./live";
import { rirBiasOf, simulateOperator } from "./operator";
import { rirRange } from "../mesocycle";

// Garantias do núcleo ao vivo (molde de guarantees.test.ts): sob operadores simulados e muitas combinações.

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-06-01", trainingDays: [1, 3, 5] };

const OPS = [
  simulateLiveOperator({ seed: 3, weeks: 8, startDate: "2026-06-01", trueDrop: 0.3, habitRir: 1, dayNoise: 1 }),
  simulateLiveOperator({ seed: 5, weeks: 8, startDate: "2026-06-01", trueDrop: 1.2, habitRir: 2, dayNoise: 1.5 }),
  simulateLiveOperator({ seed: 9, weeks: 8, startDate: "2026-06-01", trueDrop: 2.2, habitRir: 0, dayNoise: 2.5 }),
];

/** Reproduz uma sessão série por série, como a tela faz: liveState → registra a fala → marca a série. */
function replay(target: Session, past: Session[], mark?: (s: SetEntry, k: number) => SetEntry): { cues: (Cue | null)[]; session: Session } {
  const session: Session = {
    ...target,
    status: "active",
    liveLog: undefined,
    exercises: target.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })),
  };
  const cues: (Cue | null)[] = [];
  const step = () => {
    const judged = judgeLog(session);
    if (judged) session.liveLog = judged;
    const st = liveState(session, past, undefined, SETTINGS, session.startedAt + 3600_000);
    cues.push(st.cue);
    const logged = logCue(session, st.cue, Date.now());
    if (logged) session.liveLog = logged;
  };
  step();
  let k = 0;
  for (const e of session.exercises) {
    for (let i = 0; i < e.sets.length; i++) {
      const orig = target.exercises.find((x) => x.exId === e.exId)!.sets[i];
      e.sets[i] = { ...(mark ? mark(orig, k++) : orig), done: true };
      step();
      step(); // re-renderização: a fala não muda nem se duplica
    }
  }
  return { cues, session };
}

describe("núcleo ao vivo: garantias", () => {
  it("descanso nunca abaixo do mínimo da ficha nem 30 s acima do topo", () => {
    for (const { ex } of SIM_EXERCISES) {
      for (const rir of [undefined, 0, 1, 2, 3, 4]) {
        for (const reps of [1, 5, 8, 12, 20]) {
          for (const prevReps of [undefined, reps, reps + 1, reps + 3]) {
            const last: SetEntry = { id: "a", kind: "work", weight: 50, reps, rir, done: true, failure: rir === 0 };
            const prev: SetEntry | undefined =
              prevReps == null ? undefined : { id: "p", kind: "work", weight: 50, reps: prevReps, done: true };
            const r = restAfter(ex, last, prev);
            expect(r.sec).toBeGreaterThanOrEqual(ex.rest[0]);
            expect(r.sec).toBeLessThanOrEqual(ex.rest[1] + REST_OVER_TOP);
            if (r.why) expect(r.why.split(" ").length).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it("nunca sobe a carga: a proposta é sempre abaixo da carga da série", () => {
    for (const sessions of OPS) {
      for (let i = 8; i < sessions.length; i += 3) {
        const s = sessions[i];
        const past = sessions.slice(0, i);
        // Série ruim de propósito: 2 reps, para forçar previsão abaixo do piso.
        const { session } = replay(s, past, (x, k) => (k % 3 === 0 ? { ...x, reps: 2 } : x));
        void session;
        const half: Session = {
          ...s,
          status: "active",
          exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x, j) => ({ ...x, done: j === 0, reps: j === 0 ? 2 : x.reps })) })),
        };
        const st = liveState(half, past, undefined, SETTINGS, s.startedAt);
        if (st.next?.adjust && st.next.weight != null) expect(st.next.adjust.weight).toBeLessThan(st.next.weight);
      }
    }
  });

  it("no máximo 1 fala por série e o teto por treino", () => {
    let maxSpoken = 0;
    for (const sessions of OPS) {
      for (let i = 6; i < sessions.length; i++) {
        const noisy = (x: SetEntry, k: number): SetEntry => ({ ...x, rir: [0, 4, 1, 3][k % 4], reps: k % 5 === 0 ? 3 : x.reps });
        const { session } = replay(sessions[i], sessions.slice(0, i), noisy);
        const spoken = (session.liveLog ?? []).filter((e) => !e.id.startsWith("meta"));
        const perSet = new Map<string, number>();
        for (const e of spoken) if (e.setId) perSet.set(e.setId, (perSet.get(e.setId) ?? 0) + 1);
        for (const n of perSet.values()) expect(n).toBeLessThanOrEqual(1);
        expect(spoken.filter((e) => !e.id.startsWith("carga-suspeita") && !e.id.startsWith("dor")).length).toBeLessThanOrEqual(CUE_CAP);
        expect(new Set(spoken.map((e) => e.id)).size).toBe(spoken.length);
        maxSpoken = Math.max(maxSpoken, spoken.length);
      }
    }
    expect(maxSpoken).toBeGreaterThan(0);
  });

  it("treino todo no alvo: zero falas além das metas", () => {
    for (const sessions of OPS) {
      for (let i = 6; i < sessions.length; i++) {
        const s = sessions[i];
        // No alvo: a mesma força da última vez, com a sobra dentro da meta da semana.
        const prevSession = sessions
          .slice(0, i)
          .filter((x) => x.week !== 7)
          .pop()!;
        const onTarget = (x: SetEntry): SetEntry => {
          const se = s.exercises.find((e) => e.sets.includes(x))!;
          const ex = SIM_EXERCISES.find((e) => e.ex.id === se.exId)!.ex;
          const j = se.sets.indexOf(x);
          const prev = prevSession.exercises.find((e) => e.exId === se.exId)?.sets[j];
          const [lo, hi] = rirRange(ex.stop, s.week);
          const rir = Math.min(hi, Math.max(lo, prev?.rir ?? lo));
          // Mesma força da última vez, na carga de hoje (reps + sobra na relação carga × reps).
          const strength = prev ? prev.weight! * (1 + (prev.reps! + (prev.rir ?? 0)) / 30) : 0;
          const reps = Math.max(ex.reps[0], prev ? Math.round(30 * (strength / x.weight! - 1)) - rir : ex.reps[0]);
          return { ...x, rir, reps };
        };
        const { cues } = replay(s, sessions.slice(0, i), onTarget);
        const nonMeta = cues.filter(
          (c) => c && !c.meta && !c.id.startsWith("ajuste") && !c.id.startsWith("recorde") && !c.id.startsWith("meta-batida"),
        );
        expect(nonMeta.map((c) => c!.id)).toEqual([]);
      }
    }
  });

  it("mesma entrada → mesma saída", () => {
    const s = OPS[1];
    const a = replay(s[10], s.slice(0, 10)).cues.map((c) => c?.text);
    const b = replay(s[10], s.slice(0, 10)).cues.map((c) => c?.text);
    expect(a).toEqual(b);
  });

  it("regra ignorada 2 vezes seguidas não volta na sessão", () => {
    const s: Session = { ...OPS[0][10], status: "active" };
    s.liveLog = [
      { id: "longe-da-falha:sim.supino", at: 1, acted: false },
      { id: "longe-da-falha:sim.remada", at: 2, acted: false },
    ];
    const cue: Cue = { id: "longe-da-falha:sim.rosca", moment: "depois", priority: 1, text: "x" };
    expect(pickCue([cue], s)).toBeNull();
  });

  it("nada muda o programa em memória", () => {
    const before = JSON.stringify(programDays());
    for (const sessions of OPS) replay(sessions[12], sessions.slice(0, 12));
    const op = simulateOperator({
      seed: 1,
      weeks: 3,
      startDate: "2026-09-07",
      trainingDays: [1, 3, 5],
      preferredHour: 7,
      trueRestRatio: 1,
      trueMuscleRecovery: {},
    });
    liveState({ ...op[op.length - 1], status: "active" }, op.slice(0, -1), undefined, SETTINGS, Date.now());
    expect(JSON.stringify(programDays())).toBe(before);
  });

  it("queda aprendida encolhe para o padrão com poucos dados e previsão segue a carga", () => {
    const ex = SIM_EXERCISES[0].ex;
    expect(dropModel(ex, []).drop).toBe(1);
    expect(predictFromPrevious({ id: "a", kind: "work", weight: 80, reps: 8, done: true }, 80, 1)).toBe(7);
    expect(predictFromPrevious({ id: "a", kind: "work", weight: 80, reps: 8, done: true }, 70, 1)!).toBeGreaterThan(8);
  });

  it("sanitiza o liveLog do backup", () => {
    expect(sanitizeLiveLog([{ id: "a", at: 1, acted: true }, { id: 3 }, null, { id: "b", at: "x" }])).toEqual([
      { id: "a", at: 1, acted: true },
    ]);
    expect(sanitizeLiveLog("lixo")).toBeUndefined();
  });

  // ---------- Fase 3: leitura do dia ----------

  /** Sessão de hoje com os primeiros `n` exercícios feitos, cada 1ª série com `delta` reps a mais ou a menos. */
  function today(sessions: Session[], i: number, n: number, delta: number): Session {
    const s = sessions[i];
    return {
      ...s,
      status: "active",
      exercises: s.exercises.map((e, j) => ({
        ...e,
        sets: e.sets.map((x, k) => ({ ...x, done: j < n, reps: k === 0 && j < n ? Math.max(1, x.reps! + delta) : x.reps })),
      })),
    };
  }

  it("leitura do dia: lado certo, confiança cresce a cada exercício, determinística", () => {
    const s = OPS[1];
    const past = s.slice(0, 12);
    const low1 = dayForm(today(s, 12, 1, -4), past);
    const low3 = dayForm(today(s, 12, 3, -4), past);
    expect(low3.value).toBeLessThan(0);
    expect(low3.confidence).toBeGreaterThan(low1.confidence);
    expect(dayForm(today(s, 12, 3, +4), past).value).toBeGreaterThan(0);
    expect(dayForm(today(s, 12, 3, -4), past)).toEqual(low3);
    expect(dayForm({ ...s[12], exercises: [] }, past).confidence).toBe(0);
    // Check-in de baixa conta como ponto de partida.
    const low = dayForm({ ...s[12], status: "active", exercises: [], checkin: { sleep: "ruim", energy: "baixa", pain: "nenhuma" } }, past);
    expect(low.value).toBeLessThan(0);
  });

  it("dia abaixo: nunca sobe carga, sem intensificador e uma fala só no treino", () => {
    for (const sessions of OPS) {
      for (const i of [10, 14, 18]) {
        const past = sessions.slice(0, i);
        const s = today(sessions, i, 2, -5);
        const st = liveState(s, past, undefined, SETTINGS, s.startedAt);
        if (isLowForm(st.form)) {
          expect(st.cue?.id).not.toMatch(/^intensificador/);
          if (st.next?.adjust && st.next.weight != null) expect(st.next.adjust.weight).toBeLessThan(st.next.weight);
        }
      }
      const { session } = replay(sessions[16], sessions.slice(0, 16), (x, k) =>
        k < 9 && k % 3 === 0 ? { ...x, reps: Math.max(1, x.reps! - 5) } : x,
      );
      expect((session.liveLog ?? []).filter((e) => e.id === "dia-abaixo").length).toBeLessThanOrEqual(1);
    }
  });

  // ---------- Fase 4: conhecer a pessoa ----------

  it("curva própria encolhe para 30 com poucos dados", () => {
    expect(personalEpley([]).k).toBe(30);
    const hist = OPS[0].slice(0, 30).map((session) => ({ session, entry: session.exercises[0] }));
    const k = personalEpley(hist).k;
    expect(k).toBeGreaterThan(18);
    expect(k).toBeLessThan(45);
  });

  it("erro no RIR: confere a sobra pela série seguinte até a falha", () => {
    const set = (id: string, reps: number, rir?: number, failure?: boolean): SetEntry => ({
      id,
      kind: "work",
      weight: 60,
      reps,
      rir,
      failure,
      done: true,
    });
    const sessions: Session[] = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      dayId: "x",
      date: `2026-10-${String(i + 10).padStart(2, "0")}`,
      week: 3,
      startedAt: i,
      status: "done",
      // Diz que sobraram 3, mas a próxima à falha mostra que sobrava ~1.
      exercises: [{ exId: "sim.supino", snap: SIM_EXERCISES[0].ex, unit: "kg", sets: [set("a", 8, 3), set("b", 8, 0, true)] }],
    }));
    const r = rirBiasOf(sessions);
    expect(r.bias).toBeGreaterThan(0.9);
    expect(r.confidence).toBe(1);
    expect(rirBiasOf([]).bias).toBe(0);
  });

  it("fala nunca seguida sai do treino (segurança nunca sai)", () => {
    const base = OPS[0][10];
    const sessions: Session[] = Array.from({ length: MUTE_MIN }, (_, i) => ({
      ...base,
      id: `m${i}`,
      liveLog: [{ id: "longe-da-falha:sim.supino", at: i, acted: false }],
    }));
    const muted = ignoredRules(sessions);
    expect(muted.has("longe-da-falha")).toBe(true);
    expect(ignoredRules(sessions.slice(1)).size).toBe(0);
    const s: Session = { ...base, status: "active", liveLog: [] };
    expect(pickCue([{ id: "longe-da-falha:sim.rosca", moment: "depois", priority: 1, text: "x" }], s, muted)).toBeNull();
    expect(pickCue([{ id: "carga-suspeita:z", moment: "depois", priority: 0, text: "x" }], s, new Set(["carga-suspeita"]))?.id).toBe(
      "carga-suspeita:z",
    );
  });
});
