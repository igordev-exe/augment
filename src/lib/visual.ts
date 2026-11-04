import { EXERCISE_BY_ID, MUSCLE_ORDER, PROGRAM } from "../data/program";
import type { BodyEntry, BodyGoal, MuscleId, Session } from "../data/types";
import { addDays, daysBetween, mondayOf } from "./dates";
import { e1rm, historyOf, toKg, workSets } from "./progression";
import { plannedVolume, sessionStats, weeklyVolume } from "./sessions";

// Telemetria visual da tela Progresso: mapa muscular, mapa de atividade do ano, ritmo do peso e força relativa.
// Tudo puro (sem React) para dar para testar.

// ---------- Mapa muscular ----------

export type MuscleState = "recuperando" | "pronto" | "atrasado" | "sem-treino";

export interface MuscleStatus {
  muscle: MuscleId;
  /** Séries de trabalho na semana (seg–dom). */
  sets: number;
  /** Séries que a ficha pede na semana do mesociclo. */
  target: number;
  /** Data do último treino com séries para o músculo. */
  lastDate?: string;
  daysSince?: number;
  /** Séries no último treino do músculo. */
  lastSets: number;
  /** 0–1: quanto já recuperou desde o último treino. */
  recovery: number;
  state: MuscleState;
}

/** Janela de recuperação pelo volume da última sessão do músculo: pouco volume recupera mais rápido. */
export function recoveryHours(sets: number): number {
  return sets <= 3 ? 36 : sets <= 6 ? 48 : 72;
}

/** Sem treinar há 5+ dias fica "atrasado"; 8+ dias (ou nunca) é "sem treino". A ficha bate cada músculo ~2× por semana. */
export const LATE_DAYS = 5;
export const UNTRAINED_DAYS = 8;

/** Sinergistas de exercícios compostos: contam 0,5 série por série de trabalho na estimativa de fadiga/recuperação. */
const SECONDARY_MUSCLES: Partial<Record<string, MuscleId[]>> = {
  "supino-inclinado-halteres": ["deltAnterior", "triceps"],
  "supino-reto-maquina": ["deltAnterior", "triceps"],
  "supino-inclinado-smith": ["deltAnterior", "triceps"],
  "desenvolvimento-maquina": ["deltLateral", "triceps"],
  "desenvolvimento-halteres": ["deltLateral", "triceps"],
  "puxada-aberta": ["biceps", "deltPosterior"],
  "puxada-unilateral": ["biceps", "deltPosterior"],
  "remada-apoio-peito": ["deltPosterior", "trapezio", "biceps"],
  "remada-baixa-neutra": ["deltPosterior", "trapezio", "biceps"],
  "terra-romeno": ["gluteo"],
};

export function muscleStatus(sessions: Session[], week: number, today: string, now = Date.now()): Record<MuscleId, MuscleStatus> {
  const done = sessions.filter((s) => s.status === "done" && s.date <= today);
  const vol = weeklyVolume(done, today);
  const plan = plannedVolume(week);
  const last = new Map<MuscleId, { date: string; at: number; sets: number }>();
  for (const s of done) {
    const at = s.finishedAt ?? Date.parse(`${s.date}T12:00:00`);
    const perMuscle = new Map<MuscleId, number>();
    for (const e of s.exercises) {
      const ex = EXERCISE_BY_ID[e.exId];
      if (!ex) continue;
      const n = workSets(e).length;
      if (!n) continue;
      for (const m of ex.muscles) perMuscle.set(m, (perMuscle.get(m) ?? 0) + n);
      for (const m of SECONDARY_MUSCLES[ex.lib] ?? []) {
        if (!ex.muscles.includes(m)) perMuscle.set(m, (perMuscle.get(m) ?? 0) + n * 0.5);
      }
    }
    for (const [m, rawSets] of perMuscle) {
      const n = Math.ceil(rawSets);
      const cur = last.get(m);
      if (!cur || at > cur.at) last.set(m, { date: s.date, at, sets: n });
    }
  }

  const out = {} as Record<MuscleId, MuscleStatus>;
  for (const m of MUSCLE_ORDER) {
    const l = last.get(m);
    if (!l) {
      out[m] = { muscle: m, sets: vol[m], target: plan[m], lastSets: 0, recovery: 1, state: "sem-treino" };
      continue;
    }
    const daysSince = daysBetween(l.date, today);
    const hours = Math.max(0, (now - l.at) / 3600_000);
    const recovery = Math.min(1, hours / recoveryHours(l.sets));
    const state: MuscleState =
      daysSince >= UNTRAINED_DAYS ? "sem-treino" : daysSince >= LATE_DAYS ? "atrasado" : recovery < 1 ? "recuperando" : "pronto";
    out[m] = { muscle: m, sets: vol[m], target: plan[m], lastDate: l.date, daysSince, lastSets: l.sets, recovery, state };
  }
  return out;
}

// ---------- Mapa de fadiga ----------

/** Faixas do mapa de fadiga: 0–49 estável, 50–74 atenção, 75+ crítico. */
export type FatigueLevel = "estavel" | "atencao" | "critico";

/** 0–100: quanto ainda falta recuperar desde o último treino. Pronto, atrasado ou sem treino = 0. */
export function fatiguePct(s: MuscleStatus): number {
  return s.state === "recuperando" ? Math.round((1 - s.recovery) * 100) : 0;
}

export function fatigueLevel(pct: number): FatigueLevel {
  return pct >= 75 ? "critico" : pct >= 50 ? "atencao" : "estavel";
}

/** Horas até 100% recuperado (0 se já está). */
export function hoursToReady(s: MuscleStatus): number {
  return s.state === "recuperando" ? Math.ceil((1 - s.recovery) * recoveryHours(s.lastSets)) : 0;
}

/** Prontidão (0–100) de um conjunto de músculos: média do quanto cada um já recuperou. */
export function readiness(status: Record<MuscleId, MuscleStatus>, muscles: MuscleId[]): number {
  if (!muscles.length) return 100;
  return Math.round(muscles.reduce((a, m) => a + (100 - fatiguePct(status[m])), 0) / muscles.length);
}

/** Séries de trabalho por dia nos últimos `days` dias (o último é hoje). */
export function dailySets(sessions: Session[], today: string, days = 7): { date: string; sets: number }[] {
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(today, i - days + 1), sets: 0 }));
  const byDate = new Map(out.map((d) => [d.date, d]));
  for (const s of sessions) {
    if (s.status !== "done") continue;
    const d = byDate.get(s.date);
    if (d) d.sets += sessionStats(s).sets;
  }
  return out;
}

// ---------- Mapa de atividade do ano ----------

export interface DayActivity {
  date: string;
  sessions: number;
  sets: number;
  volumeKg: number;
  dayIds: string[];
  /** 0 = nada, 1–4 = intensidade relativa às séries dos outros dias. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ActivityGrid {
  /** Segundas-feiras de cada coluna, da mais antiga para a atual. */
  weeks: string[];
  days: Map<string, DayActivity>;
  totalSessions: number;
  activeDays: number;
  /** Semanas seguidas (até a atual) com a meta de treinos cumprida. */
  streak: number;
  longestStreak: number;
}

export function activityGrid(sessions: Session[], today: string, perWeekTarget: number, numWeeks = 53): ActivityGrid {
  const end = mondayOf(today);
  const weeks = Array.from({ length: numWeeks }, (_, i) => addDays(end, -7 * (numWeeks - 1 - i)));
  const from = weeks[0];
  const done = sessions.filter((s) => s.status === "done" && s.date <= today);

  const days = new Map<string, DayActivity>();
  for (const s of done) {
    if (s.date < from) continue;
    const st = sessionStats(s);
    const d = days.get(s.date) ?? { date: s.date, sessions: 0, sets: 0, volumeKg: 0, dayIds: [], level: 0 as const };
    d.sessions += 1;
    d.sets += st.sets;
    d.volumeKg += st.volumeKg;
    d.dayIds.push(s.dayId);
    days.set(s.date, d);
  }

  // Intensidade relativa ao dia mais cheio "típico" (percentil 90), para um treino gigante não apagar os outros.
  const setsList = [...days.values()].map((d) => d.sets).sort((a, b) => a - b);
  const ref = Math.max(1, setsList[Math.ceil((setsList.length - 1) * 0.9)] ?? 1);
  for (const d of days.values()) {
    const r = d.sets / ref;
    d.level = d.sets === 0 ? 1 : r < 0.35 ? 1 : r < 0.65 ? 2 : r < 0.9 ? 3 : 4;
  }

  const { streak, longest } = weekStreaks(done, today, perWeekTarget);
  return {
    weeks,
    days,
    totalSessions: [...days.values()].reduce((a, d) => a + d.sessions, 0),
    activeDays: days.size,
    streak,
    longestStreak: longest,
  };
}

/** Sequência de semanas com a meta cumprida. A semana atual só conta se já bateu a meta (não quebra a sequência). */
export function weekStreaks(sessions: Session[], today: string, target: number): { streak: number; longest: number } {
  const goal = Math.max(1, target);
  const perWeek = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== "done" || s.date > today) continue;
    const w = mondayOf(s.date);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  if (!perWeek.size) return { streak: 0, longest: 0 };

  const current = mondayOf(today);
  let streak = 0;
  let w = current;
  if ((perWeek.get(w) ?? 0) >= goal) streak = 1;
  w = addDays(w, -7);
  while ((perWeek.get(w) ?? 0) >= goal) {
    streak += 1;
    w = addDays(w, -7);
  }

  const first = [...perWeek.keys()].sort()[0];
  let longest = 0;
  let run = 0;
  for (let x = first; x <= current; x = addDays(x, 7)) {
    if ((perWeek.get(x) ?? 0) >= goal) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (x !== current) run = 0;
  }
  return { streak, longest: Math.max(longest, streak) };
}

// ---------- Peso corporal: ritmo e meta ----------

export interface WeightTrend {
  current: number;
  currentDate: string;
  /** kg por semana (regressão linear nas últimas 4 semanas, ou 8 se tiver pouco ponto). */
  kgPerWeek: number;
  /** % do peso por semana. */
  pctPerWeek: number;
  /** Dias cobertos pela regressão. */
  spanDays: number;
}

/** Ritmo recomendado (% do peso por semana) para quem treina hipertrofia. */
export const GOAL_RANGES: Record<BodyGoal["mode"], [number, number]> = {
  ganhar: [0.25, 0.5],
  perder: [-0.7, -0.4],
  manter: [-0.25, 0.25],
};

export const GOAL_LABEL: Record<BodyGoal["mode"], string> = {
  ganhar: "Ganhar massa",
  perder: "Perder gordura",
  manter: "Manter",
};

function weightPoints(entries: BodyEntry[]): { date: string; kg: number }[] {
  return entries
    .filter((e) => e.weightKg != null && e.weightKg > 0)
    .map((e) => ({ date: e.date, kg: e.weightKg! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function weightTrend(entries: BodyEntry[]): WeightTrend | null {
  const pts = weightPoints(entries);
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const fit = (windowDays: number) => {
    const win = pts.filter((p) => daysBetween(p.date, last.date) <= windowDays);
    if (win.length < 2) return null;
    const xs = win.map((p) => daysBetween(win[0].date, p.date));
    const span = xs[xs.length - 1];
    if (span < 6) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = win.reduce((a, p) => a + p.kg, 0) / win.length;
    let num = 0;
    let den = 0;
    xs.forEach((x, i) => {
      num += (x - mx) * (win[i].kg - my);
      den += (x - mx) ** 2;
    });
    return den ? { slope: num / den, span } : null;
  };
  const f = fit(28) ?? fit(56);
  const kgPerWeek = f ? f.slope * 7 : 0;
  return {
    current: last.kg,
    currentDate: last.date,
    kgPerWeek,
    pctPerWeek: (kgPerWeek / last.kg) * 100,
    spanDays: f?.span ?? 0,
  };
}

export type GoalPace = "no-ritmo" | "rapido" | "devagar" | "contrario" | "sem-dados";

export interface GoalStatus {
  pace: GoalPace;
  range: [number, number];
  /** Semanas até a meta no ritmo atual (só quando está indo na direção certa). */
  etaWeeks?: number;
  /** kg que faltam (positivo = ganhar). */
  remainingKg?: number;
  /** Meta já alcançada (dentro de 0,3 kg). */
  reached: boolean;
}

export function goalStatus(trend: WeightTrend | null, goal: BodyGoal | undefined): GoalStatus | null {
  if (!goal) return null;
  const range = GOAL_RANGES[goal.mode];
  const remainingKg = trend && goal.targetKg ? Number((goal.targetKg - trend.current).toFixed(1)) : undefined;
  const reached = remainingKg != null && Math.abs(remainingKg) <= 0.3;
  if (!trend || trend.spanDays < 6) return { pace: "sem-dados", range, remainingKg, reached };
  const p = trend.pctPerWeek;
  let pace: GoalPace;
  if (p >= range[0] && p <= range[1]) pace = "no-ritmo";
  else if (goal.mode === "manter") pace = Math.abs(p) > range[1] ? "rapido" : "no-ritmo";
  else if (goal.mode === "ganhar") pace = p > range[1] ? "rapido" : p <= 0 ? "contrario" : "devagar";
  else pace = p < range[0] ? "rapido" : p >= 0 ? "contrario" : "devagar";
  const etaWeeks =
    remainingKg != null && !reached && trend.kgPerWeek !== 0 && Math.sign(remainingKg) === Math.sign(trend.kgPerWeek)
      ? Math.ceil(remainingKg / trend.kgPerWeek)
      : undefined;
  return { pace, range, etaWeeks, remainingKg, reached };
}

/** Peso da medição mais próxima antes da data (ou até 30 dias depois, para os primeiros treinos). */
export function bodyweightAt(entries: BodyEntry[], date: string): number | null {
  const pts = weightPoints(entries);
  let best: number | null = null;
  for (const p of pts) {
    if (p.date <= date) best = p.kg;
    else break;
  }
  if (best != null) return best;
  const after = pts.find((p) => daysBetween(date, p.date) <= 30);
  return after?.kg ?? null;
}

// ---------- Força relativa ao peso corporal ----------

export interface RelativeStrength {
  exId: string;
  e1rmKg: number;
  bodyweightKg: number;
  ratio: number;
  firstRatio: number;
  /** Variação da força relativa desde o primeiro registro (%). */
  deltaPct: number;
  sessions: number;
}

/** 1RM estimado ÷ peso corporal nos compostos (isolados não entram: o número não diz muito ali). */
export function relativeStrength(sessions: Session[], entries: BodyEntry[]): RelativeStrength[] {
  const done = sessions.filter((s) => s.status === "done");
  const out: RelativeStrength[] = [];
  for (const day of PROGRAM) {
    for (const ex of day.exercises) {
      if (ex.iso) continue;
      const hist = historyOf(done, ex.id);
      const ratios = hist
        .map(({ session, entry }) => {
          const best = Math.max(0, ...workSets(entry, false).map((s) => e1rm(toKg(s.weight!, entry.unit), s.reps!)));
          const bw = bodyweightAt(entries, session.date);
          return best > 0 && bw ? { best, bw, ratio: best / bw } : null;
        })
        .filter((x): x is { best: number; bw: number; ratio: number } => !!x);
      if (!ratios.length) continue;
      const first = ratios[0];
      const last = ratios[ratios.length - 1];
      out.push({
        exId: ex.id,
        e1rmKg: last.best,
        bodyweightKg: last.bw,
        ratio: last.ratio,
        firstRatio: first.ratio,
        deltaPct: ((last.ratio - first.ratio) / first.ratio) * 100,
        sessions: ratios.length,
      });
    }
  }
  return out.sort((a, b) => b.ratio - a.ratio);
}
