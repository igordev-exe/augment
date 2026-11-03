import { LIB_BY_ID } from "../data/library";
import { DAY_BY_ID, EXERCISE_BY_ID, MUSCLE_ORDER, PROGRAM, shortName } from "../data/program";
import type { MuscleId, Session } from "../data/types";
import { addDays, shortDate } from "./dates";
import { rirRange, setsFor, weekFor } from "./mesocycle";
import { e1rm, formatWeight, historyOf, prsInSession, toKg, workSets, type PR } from "./progression";
import { plannedVolume, weeklyVolume } from "./sessions";

// Relatório da semana (seg–dom): o que saiu do plano e um foco só para a próxima. Regras fixas, sem IA.

export interface Shortfall {
  date: string;
  dayId: string;
  exId: string;
  done: number;
  planned: number;
}

export interface RirMiss {
  exId: string;
  date: string;
  rir: number;
  target: [number, number];
}

export interface Stall {
  exId: string;
  /** Resumo das três últimas sessões, da mais antiga para a mais nova. */
  trail: string[];
}

export interface JointIssue {
  exId: string;
  /** Vezes que incomodou nas últimas 3 semanas (até o fim desta). */
  times: number;
  alternatives: string[];
}

export interface WeekReport {
  weekStart: string;
  /** Semana do mesociclo (da sessão registrada; sem treino, pelo calendário). null = antes do mesociclo. */
  mesoWeek: number | null;
  sessions: Session[];
  done: number;
  planned: number;
  /** Treinos da sequência que ficaram de fora (só quando a semana comporta todos). */
  missingDays: string[];
  shortfalls: Shortfall[];
  volume: { muscle: MuscleId; done: number; planned: number }[];
  rir: { logged: number; inTarget: number; harder: RirMiss[]; easier: RirMiss[] };
  stalls: Stall[];
  prs: (PR & { date: string })[];
  signals: string[];
  joints: JointIssue[];
  focus: { title: string; detail: string };
}

function byDate(a: Session, b: Session): number {
  return a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1;
}

/** Melhor 1RM estimado da entrada, contando as reps que sobraram (normaliza semanas com RIR diferente). */
function bestE1rm(entry: Session["exercises"][number]): number {
  return Math.max(0, ...workSets(entry, false).map((s) => e1rm(toKg(s.weight!, entry.unit), s.reps! + (s.rir ?? 0))));
}

function list(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function weeklyReport(all: Session[], weekStart: string, mesoStart: string, trainingDays: number[]): WeekReport {
  const weekEnd = addDays(weekStart, 7);
  const done = all.filter((s) => s.status === "done");
  const sessions = done.filter((s) => s.date >= weekStart && s.date < weekEnd).sort(byDate);
  const upToEnd = done.filter((s) => s.date < weekEnd);
  const mesoWeek = sessions[0]?.week ?? (weekStart >= mesoStart ? weekFor(mesoStart, weekStart) : null);
  const planned = trainingDays.length;

  // Frequência
  const doneDays = new Set(sessions.map((s) => s.dayId));
  const missingDays =
    planned >= PROGRAM.length && sessions.length < planned ? PROGRAM.map((d) => d.id).filter((id) => !doneDays.has(id)) : [];

  // Séries a menos que o planejado. O treino guarda todo exercício do dia; o pulado fica com 0 séries.
  const shortfalls: Shortfall[] = [];
  for (const s of sessions) {
    for (const e of s.exercises) {
      const ex = EXERCISE_BY_ID[e.exId];
      if (!ex) continue;
      const want = setsFor(ex, s.week);
      const got = workSets(e).length;
      if (got < want) shortfalls.push({ date: s.date, dayId: s.dayId, exId: e.exId, done: got, planned: want });
    }
  }

  // Volume por músculo contra a meta da semana
  const vol = weeklyVolume(sessions, weekStart);
  const plan = plannedVolume(mesoWeek ?? 2);
  const volume = MUSCLE_ORDER.filter((m) => plan[m] > 0).map((m) => ({ muscle: m, done: vol[m], planned: plan[m] }));

  // Reps que sobraram contra a meta da semana de cada sessão
  const rir = { logged: 0, inTarget: 0, harder: [] as RirMiss[], easier: [] as RirMiss[] };
  for (const s of sessions) {
    for (const e of s.exercises) {
      const ex = EXERCISE_BY_ID[e.exId];
      if (!ex) continue;
      const target = rirRange(ex.stop, s.week);
      const marked = workSets(e, false).filter((x) => x.rir != null);
      if (!marked.length) continue;
      rir.logged += marked.length;
      rir.inTarget += marked.filter((x) => x.rir! >= target[0] && x.rir! <= target[1] + 1).length;
      const least = Math.min(...marked.map((x) => x.rir!));
      const most = Math.max(...marked.map((x) => x.rir!));
      if (least < target[0]) rir.harder.push({ exId: e.exId, date: s.date, rir: least, target });
      else if (most > target[1] + 1) rir.easier.push({ exId: e.exId, date: s.date, rir: most, target });
    }
  }

  // Estagnação: três sessões seguidas (fora do deload) sem 1RM estimado novo
  const stalls: Stall[] = [];
  const trained = new Set(sessions.flatMap((s) => s.exercises.filter((e) => workSets(e).length).map((e) => e.exId)));
  for (const exId of trained) {
    const h = historyOf(
      upToEnd.filter((s) => s.week !== 7),
      exId,
    ).slice(-3);
    if (h.length < 3) continue;
    const [a, b, c] = h.map((x) => bestE1rm(x.entry));
    if (b <= a + 1e-6 && c <= a + 1e-6) {
      stalls.push({
        exId,
        trail: h.map((x) => {
          const top = workSets(x.entry, false).reduce((p, q) => (toKg(q.weight!, x.entry.unit) > toKg(p.weight!, x.entry.unit) ? q : p));
          return `${shortDate(x.session.date)}: ${formatWeight(top.weight)}×${top.reps}`;
        }),
      });
    }
  }

  // Recordes batidos na semana
  const prs = sessions.flatMap((s) => prsInSession(s, done).map((p) => ({ ...p, date: s.date })));

  // Sinais do corpo: check-in e articulação
  const signals: string[] = [];
  const checked = sessions.filter((s) => s.checkin && !s.checkin.skipped);
  const badSleep = checked.filter((s) => s.checkin!.sleep === "ruim").length;
  const lowEnergy = checked.filter((s) => s.checkin!.energy === "baixa").length;
  if (badSleep >= 2) signals.push(`Sono ruim em ${badSleep} de ${checked.length} treinos.`);
  if (lowEnergy >= 2) signals.push(`Energia baixa em ${lowEnergy} de ${checked.length} treinos.`);
  for (const s of checked.filter((x) => x.checkin!.pain === "forte")) signals.push(`Dor forte no check-in de ${shortDate(s.date)}.`);

  const recent = done.filter((s) => s.date >= addDays(weekStart, -14) && s.date < weekEnd);
  const joints: JointIssue[] = [];
  for (const exId of trained) {
    const hurtThisWeek = sessions.some((s) => s.exercises.some((e) => e.exId === exId && e.feedback?.joint === "incomodou"));
    if (!hurtThisWeek) continue;
    const times = recent.filter((s) => s.exercises.some((e) => e.exId === exId && e.feedback?.joint === "incomodou")).length;
    joints.push({ exId, times, alternatives: LIB_BY_ID[EXERCISE_BY_ID[exId]?.lib]?.alternatives ?? [] });
  }

  const report: WeekReport = {
    weekStart,
    mesoWeek,
    sessions,
    done: sessions.length,
    planned,
    missingDays,
    shortfalls,
    volume,
    rir,
    stalls,
    prs,
    signals,
    joints,
    focus: { title: "", detail: "" },
  };
  report.focus = focusOf(report);
  return report;
}

/** Um foco só, na ordem: dor > frequência > séries faltando > intensidade > estagnação. */
export function focusOf(r: WeekReport): { title: string; detail: string } {
  const joint = r.joints.find((j) => j.times >= 2);
  if (joint) {
    const name = shortName(EXERCISE_BY_ID[joint.exId]);
    const alt = joint.alternatives.length ? ` Alternativas: ${list(joint.alternatives)}.` : "";
    return { title: `Trocar ${name}`, detail: `Incomodou a articulação ${joint.times} vezes em 3 semanas.${alt}` };
  }
  if (r.signals.some((s) => s.startsWith("Dor forte"))) {
    return { title: "Cuidar da dor", detail: "Teve dor forte nesta semana. Pule o que dói e, se continuar, procure avaliação." };
  }
  if (r.done < Math.ceil(r.planned / 2)) {
    const miss = r.missingDays.length ? ` Ficaram de fora: ${list(r.missingDays.map((d) => DAY_BY_ID[d].name))}.` : "";
    return {
      title: "Frequência",
      detail: `${r.done} de ${r.planned} treinos.${miss} A agenda não pula treino: o próximo é o que ficou para trás. Meta: ${Math.ceil(r.planned / 2)}+ na semana que vem.`,
    };
  }
  const missingSets = r.shortfalls.reduce((n, s) => n + s.planned - s.done, 0);
  if (missingSets >= 3) {
    const worst = [...r.shortfalls].sort((a, b) => b.planned - b.done - (a.planned - a.done)).slice(0, 3);
    return {
      title: "Completar as séries",
      detail: `Faltaram ${missingSets} séries: ${list(worst.map((s) => `${shortName(EXERCISE_BY_ID[s.exId])} (${s.done}/${s.planned})`))}.`,
    };
  }
  if (r.rir.harder.length >= 2 && r.mesoWeek != null && r.mesoWeek <= 2) {
    return {
      title: "Segurar a intensidade",
      detail: `Em ${r.rir.harder.length} exercícios você chegou mais perto da falha do que a semana ${r.mesoWeek} pede. As semanas 1–2 guardam fôlego para as pesadas.`,
    };
  }
  if (r.rir.easier.length >= 3 && r.mesoWeek != null && r.mesoWeek >= 3 && r.mesoWeek <= 6) {
    return {
      title: "Chegar mais perto da falha",
      detail: `Em ${r.rir.easier.length} exercícios sobraram reps demais para a semana ${r.mesoWeek}. Suba reps ou carga até a meta.`,
    };
  }
  if (r.stalls.length) {
    const names = r.stalls.map((s) => shortName(EXERCISE_BY_ID[s.exId]));
    return {
      title: `Destravar ${names[0]}`,
      detail: `${list(names)} sem 1RM estimado novo em 3 sessões. Confira sono e descanso; se continuar, troque no deload.`,
    };
  }
  if (r.done === 0) return { title: "Sem treinos", detail: "Nenhum treino registrado nesta semana." };
  return { title: "Semana limpa", detail: "Nada importante fora do plano. Siga as sugestões de carga." };
}
