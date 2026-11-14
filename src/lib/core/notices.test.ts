import { describe, expect, it } from "vitest";
import { programDays } from "../../data/program";
import type { NoticeChannel, Session, Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { addDays, daysBetween, fromISO } from "../dates";
import { CHANNEL_INFO, NOTICE_ID_BASE, NOTICE_ID_MAX, plannedNotices, QUIET_FROM, QUIET_UNTIL, type Notice } from "./notices";
import { EMPTY_OPERATOR_MEMORY, operatorState, simulateOperator, type OperatorMemory } from "./operator";

// Garantias dos avisos fora do app: 500 operadores simulados × 30 dias, nenhuma regra violada.

const START = "2026-09-07";
const CHANNELS = Object.keys(CHANNEL_INFO) as NoticeChannel[];
const DAY_SETS = [
  [1, 2, 3, 4, 5],
  [1, 3, 5],
  [1, 2, 4, 5],
  [0, 2, 4, 6],
  [1, 2, 3, 4, 5, 6],
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function checkAll(list: Notice[], ctx: { sessions: Session[]; settings: Settings; memory: OperatorMemory; today: string; now: number }) {
  const { sessions, settings, memory, today, now } = ctx;
  const keys = new Set<string>();
  const ids = new Set<number>();
  const lastDone = sessions.filter((s) => s.status === "done" && s.date <= today).reduce<string>((a, s) => (s.date > a ? s.date : a), "");
  for (const n of list) {
    // 1 por canal por dia.
    const k = `${n.channel}|${n.date}`;
    expect(keys.has(k), k).toBe(false);
    keys.add(k);
    // Ids únicos, na faixa do app.
    expect(ids.has(n.id)).toBe(false);
    ids.add(n.id);
    expect(n.id).toBeGreaterThanOrEqual(NOTICE_ID_BASE);
    expect(n.id).toBeLessThanOrEqual(NOTICE_ID_MAX);
    // Nunca de madrugada, nunca no passado, dentro dos 7 dias, data e hora batem.
    const d = new Date(n.at);
    expect(d.getHours()).toBeGreaterThanOrEqual(QUIET_UNTIL);
    expect(d.getHours()).toBeLessThan(QUIET_FROM);
    expect(n.at).toBeGreaterThan(now);
    expect(daysBetween(today, n.date)).toBeGreaterThanOrEqual(0);
    expect(daysBetween(today, n.date)).toBeLessThan(7);
    expect(fromISO(n.date).getDate()).toBe(d.getDate());
    // Nunca em ausência; nunca em canal desligado.
    expect(memory.absences?.some((a) => n.date >= a.from && n.date <= a.until) ?? false).toBe(false);
    expect(settings.notices?.off.includes(n.channel) ?? false).toBe(false);
    // Sem jargão nem nome de assistente.
    expect(/\b(IA|Jarvis|Siri|gêmeo|calibra|telemetria)\b/i.test(`${n.title} ${n.text}`)).toBe(false);
    // Nunca com dado inventado.
    if (n.channel === "treino") {
      const name = n.text.split(" hoje,")[0];
      const count = Number(/hoje, (\d+) exerc/.exec(n.text)?.[1]);
      const day = programDays().find((d) => d.name === name);
      expect(day, name).toBeDefined();
      expect(count).toBe(day!.exercises.length);
    }
    if (n.channel === "retomada") {
      const gap = Number(/^(\d+) dias/.exec(n.text)?.[1]);
      expect(gap).toBe(daysBetween(lastDone, n.date));
      expect(gap).toBeGreaterThanOrEqual(3);
      expect(settings.trainingDays.includes(fromISO(n.date).getDay())).toBe(true);
    }
    if (n.channel === "semana") {
      const m = /: (\d+) de (\d+) treino/.exec(n.text);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBeGreaterThan(0);
      expect(fromISO(n.date).getDay()).toBe(0);
    }
  }
  // Retomada substitui o lembrete do mesmo dia.
  for (const n of list.filter((x) => x.channel === "retomada"))
    expect(list.some((x) => x.channel === "treino" && x.date === n.date)).toBe(false);
}

describe("AUG.CORE: avisos fora do app", () => {
  it("500 operadores × 30 dias: 1 por canal por dia, nunca de madrugada, em ausência ou com dado inventado", () => {
    let total = 0;
    const seen = new Set<NoticeChannel>();
    for (let seed = 1; seed <= 500; seed++) {
      const r = rng(seed);
      const trainingDays = DAY_SETS[seed % DAY_SETS.length];
      const preferredHour = [6, 7, 12, 18, 21][seed % 5];
      const all = simulateOperator({
        seed,
        weeks: 3,
        startDate: START,
        trainingDays,
        preferredHour,
        missWeekday: seed % 3 === 0 ? trainingDays[0] : undefined,
        trueRestRatio: 1,
        trueMuscleRecovery: {},
      });
      const last = all.reduce((a, s) => (s.date > a ? s.date : a), START);
      const absenceFrom = addDays(last, 2 + Math.floor(r() * 10));
      const memory: OperatorMemory =
        seed % 4 === 0
          ? { ...EMPTY_OPERATOR_MEMORY, absences: [{ from: absenceFrom, until: addDays(absenceFrom, 4) }] }
          : EMPTY_OPERATOR_MEMORY;
      const off = CHANNELS.filter(() => r() < 0.15);
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        mesoStart: START,
        trainingDays,
        notices: { off, ...(seed % 7 === 0 ? { hour: 7 + (seed % 15) } : {}) },
        ...(seed % 5 === 0 ? { lastBackupAt: START } : {}),
      };
      const state = operatorState(all, [], settings, memory, last);
      // 30 dias: os últimos 14 do histórico e 16 depois dele (parado), a uma hora qualquer do dia.
      const t0 = addDays(last, -13);
      for (let i = 0; i < 30; i++) {
        const today = addDays(t0, i);
        const now = fromISO(today).getTime() + Math.floor(r() * 24) * 3_600_000 + Math.floor(r() * 60) * 60_000;
        const sessions = all.filter((s) => s.date <= today);
        const list = plannedNotices(sessions, settings, memory, state, today, now);
        checkAll(list, { sessions, settings, memory, today, now });
        total += list.length;
        list.forEach((n) => seen.add(n.channel));
      }
    }
    // O teste exercita todos os canais e gera avisos de verdade.
    expect(total).toBeGreaterThan(5_000);
    expect([...seen].sort()).toEqual([...CHANNELS].sort());
  }, 120_000);

  it("o lembrete sai na hora escolhida, com o dia e a contagem do programa", () => {
    const all = simulateOperator({
      seed: 3,
      weeks: 2,
      startDate: START,
      trainingDays: [1, 2, 3, 4, 5],
      preferredHour: 18,
      trueRestRatio: 1,
      trueMuscleRecovery: {},
    });
    const last = all.reduce((a, s) => (s.date > a ? s.date : a), START);
    const settings: Settings = { ...DEFAULT_SETTINGS, mesoStart: START, trainingDays: [1, 2, 3, 4, 5], notices: { off: [], hour: 9 } };
    const list = plannedNotices(all, settings, EMPTY_OPERATOR_MEMORY, undefined, last, fromISO(last).getTime() + 23 * 3_600_000);
    const treino = list.filter((n) => n.channel === "treino");
    expect(treino.length).toBeGreaterThan(0);
    for (const n of treino) {
      expect(new Date(n.at).getHours()).toBe(9);
      const day = programDays().find((d) => n.text.startsWith(`${d.name} hoje, ${d.exercises.length} `));
      expect(day, n.text).toBeDefined();
    }
  });

  it("canal desligado não sai", () => {
    const all = simulateOperator({
      seed: 5,
      weeks: 2,
      startDate: START,
      trainingDays: [1, 3, 5],
      preferredHour: 18,
      trueRestRatio: 1,
      trueMuscleRecovery: {},
    });
    const last = all.reduce((a, s) => (s.date > a ? s.date : a), START);
    const settings: Settings = { ...DEFAULT_SETTINGS, mesoStart: START, trainingDays: [1, 3, 5], notices: { off: [...CHANNELS] } };
    expect(plannedNotices(all, settings, EMPTY_OPERATOR_MEMORY, undefined, last, fromISO(last).getTime())).toEqual([]);
  });
});
