import { LIB_BY_ID } from "../data/library";
import { DAY_BY_ID, EXERCISE_BY_ID, MUSCLE_ORDER, PROGRAM, shortName } from "../data/program";
import type { MuscleId, Session, Unit } from "../data/types";
import { addDays, bySessionAsc, daysBetween, shortDate, todayISO } from "./dates";
import { rirRange, setsFor, weekFor } from "./mesocycle";
import { bestE1rm, e1rm, formatWeight, historyOf, mainLoad, prsBySession, toKg, workSets, type PR } from "./progression";
import { plannedVolume, sessionStats, weeklyVolume } from "./sessions";

// Relatório da semana (seg–dom) e do mesociclo (6 semanas + deload): regras fixas, sem IA.

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
  cardioMinutes: number;
  cardioSessions: number;
  avgSteps: number | null;
  focus: { title: string; detail: string };
}

/** Melhor 1RM estimado da entrada, contando as reps que sobraram (normaliza semanas com RIR diferente). */
function list(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function weeklyReport(all: Session[], weekStart: string, mesoStart: string, trainingDays: number[]): WeekReport {
  const weekEnd = addDays(weekStart, 7);
  const done = all.filter((s) => s.status === "done");
  const sessions = done.filter((s) => s.date >= weekStart && s.date < weekEnd).sort(bySessionAsc);
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

  // Recordes batidos na semana (em O(N) via prsBySession)
  const prMap = prsBySession(done);
  const prs = sessions.flatMap((s) => (prMap.get(s.id) ?? []).map((p) => ({ ...p, date: s.date })));

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

  // Cardio e passos na semana (F10)
  let cardioMinutes = 0;
  let cardioSessions = 0;
  const stepValues: number[] = [];
  for (const s of sessions) {
    if (s.cardio?.minutes && s.cardio.minutes > 0) {
      cardioMinutes += s.cardio.minutes;
      cardioSessions += 1;
    }
    if (s.cardio?.steps && s.cardio.steps > 0) {
      stepValues.push(s.cardio.steps);
    }
  }
  const avgSteps = stepValues.length > 0 ? Math.round(stepValues.reduce((a, b) => a + b, 0) / stepValues.length) : null;

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
    cardioMinutes,
    cardioSessions,
    avgSteps,
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

// ---------- Relatório de Mesociclo (F2) + Rotação de Acessórios (F1) ----------

export interface MesoExerciseProgress {
  exId: string;
  name: string;
  compound: boolean;
  unit: Unit;
  alt?: string;
  sessions: number;
  firstDate: string;
  firstLoad: number;
  firstReps: number;
  firstE1rm: number;
  lastDate: string;
  lastLoad: number;
  lastReps: number;
  lastE1rm: number;
  deltaLoad: number;
  deltaE1rmPct: number;
  jointComplaints: number;
}

export interface AccessorySwapCandidate {
  exId: string;
  name: string;
  currentAlt?: string;
  reason: "articular" | "estagnado" | "variacao";
  detail: string;
  alternatives: string[];
}

export interface MesoReport {
  cycleStart: string;
  cycleEnd: string;
  currentWeek: number;
  weeksElapsed: number;
  sessionsDone: number;
  sessionsPlanned: number;
  totalSets: number;
  totalVolumeKg: number;
  cardioMinutes: number;
  prsCount: number;
  exercises: MesoExerciseProgress[];
  swapCandidates: AccessorySwapCandidate[];
}

/**
 * Resume o ciclo atual de 7 semanas (a partir do início do ciclo que contém `today`),
 * comparando a 1ª sessão registrada de cada exercício com a última sessão pré-deload,
 * e sugere 2–3 acessórios candidatos a rotação para o próximo mesociclo (F1 + F2).
 */
export function mesoReport(all: Session[], mesoStart: string, trainingDays: number[], today = todayISO()): MesoReport {
  const diffDays = Math.max(0, daysBetween(mesoStart, today));
  const cycleIndex = Math.floor(diffDays / 49);
  const cycleStart = addDays(mesoStart, cycleIndex * 49);
  const cycleEnd = addDays(cycleStart, 49);
  const currentWeek = weekFor(mesoStart, today);
  const weeksElapsed = Math.min(7, Math.max(1, Math.floor(daysBetween(cycleStart, today) / 7) + 1));

  const done = all.filter((s) => s.status === "done");
  const prMap = prsBySession(done);
  const inCycle = done.filter((s) => s.date >= cycleStart && s.date < cycleEnd).sort(bySessionAsc);

  let totalSets = 0;
  let totalVolumeKg = 0;
  let cardioMinutes = 0;
  let prsCount = 0;

  for (const s of inCycle) {
    const st = sessionStats(s);
    totalSets += st.sets;
    totalVolumeKg += st.volumeKg;
    cardioMinutes += s.cardio?.minutes ?? 0;
    prsCount += (prMap.get(s.id) ?? []).length;
  }

  const exercises: MesoExerciseProgress[] = [];
  const allProgramEx = PROGRAM.flatMap((d) => d.exercises);

  for (const ex of allProgramEx) {
    // Considera sessões do ciclo; para comparar o pico, prefere última sessão fora do deload quando disponível.
    const hits = inCycle
      .map((s) => ({ session: s, entry: s.exercises.find((e) => e.exId === ex.id) }))
      .filter((x): x is { session: Session; entry: Session["exercises"][number] } => !!x.entry && workSets(x.entry).length > 0);
    if (!hits.length) continue;

    const first = hits[0];
    const nonDeloadHits = hits.filter((h) => h.session.week !== 7);
    const last = nonDeloadHits.length > 0 ? nonDeloadHits[nonDeloadHits.length - 1] : hits[hits.length - 1];

    const fWork = workSets(first.entry, false);
    const lWork = workSets(last.entry, false);
    if (!fWork.length || !lWork.length) continue;

    const firstLoad = mainLoad(fWork) ?? fWork[0].weight!;
    const firstReps = Math.max(...fWork.filter((s) => s.weight === firstLoad).map((s) => s.reps!));
    const firstE1rm = Math.max(...fWork.map((s) => e1rm(toKg(s.weight!, first.entry.unit), s.reps!)));

    const lastLoad = mainLoad(lWork) ?? lWork[0].weight!;
    const lastReps = Math.max(...lWork.filter((s) => s.weight === lastLoad).map((s) => s.reps!));
    const lastE1rm = Math.max(...lWork.map((s) => e1rm(toKg(s.weight!, last.entry.unit), s.reps!)));

    const deltaLoad = Number((lastLoad - firstLoad).toFixed(2));
    const deltaE1rmPct = firstE1rm > 0 ? Math.round(((lastE1rm - firstE1rm) / firstE1rm) * 100) : 0;
    const jointComplaints = hits.filter((h) => h.entry.feedback?.joint === "incomodou").length;

    exercises.push({
      exId: ex.id,
      name: shortName(ex),
      compound: ex.compound,
      unit: last.entry.unit,
      alt: last.entry.alt,
      sessions: hits.length,
      firstDate: first.session.date,
      firstLoad,
      firstReps,
      firstE1rm: Math.round(firstE1rm),
      lastDate: last.session.date,
      lastLoad,
      lastReps,
      lastE1rm: Math.round(lastE1rm),
      deltaLoad,
      deltaE1rmPct,
      jointComplaints,
    });
  }

  // Candidatos a rotação de acessórios (F1):
  // Prioridade: 1) incomodou articulação, 2) isolado/acessório estagnado (sessions >= 2 e deltaE1rmPct <= 0), 3) isolados para variar estímulo.
  const swapCandidates: AccessorySwapCandidate[] = [];
  for (const ep of exercises) {
    const ex = EXERCISE_BY_ID[ep.exId];
    const alts = LIB_BY_ID[ex.lib]?.alternatives ?? [];
    if (!alts.length) continue;

    if (ep.jointComplaints > 0) {
      swapCandidates.push({
        exId: ep.exId,
        name: ep.name,
        currentAlt: ep.alt,
        reason: "articular",
        detail: `Incomodou a articulação em ${ep.jointComplaints} sessão(ões) neste ciclo.`,
        alternatives: alts,
      });
    } else if (!ep.compound && ep.sessions >= 2 && ep.deltaE1rmPct <= 0) {
      swapCandidates.push({
        exId: ep.exId,
        name: ep.name,
        currentAlt: ep.alt,
        reason: "estagnado",
        detail: `Sem ganho de 1RM estimado após ${ep.sessions} sessões (${formatWeight(ep.lastLoad)}×${ep.lastReps}).`,
        alternatives: alts,
      });
    }
  }

  // Se ainda faltam sugestões até 3 acessórios, sugere isolados com menor evolução percentual para variar no próximo ciclo
  if (swapCandidates.length < 3) {
    const already = new Set(swapCandidates.map((c) => c.exId));
    const more = exercises
      .filter((ep) => !ep.compound && !already.has(ep.exId) && (LIB_BY_ID[EXERCISE_BY_ID[ep.exId].lib]?.alternatives?.length ?? 0) > 0)
      .sort((a, b) => a.deltaE1rmPct - b.deltaE1rmPct);
    for (const ep of more) {
      if (swapCandidates.length >= 3) break;
      const alts = LIB_BY_ID[EXERCISE_BY_ID[ep.exId].lib]?.alternatives ?? [];
      swapCandidates.push({
        exId: ep.exId,
        name: ep.name,
        currentAlt: ep.alt,
        reason: "variacao",
        detail: `Acessório com ${ep.sessions} sessão(ões) no ciclo (${ep.deltaE1rmPct >= 0 ? `+${ep.deltaE1rmPct}%` : `${ep.deltaE1rmPct}%`}) — bom candidato para variar o estímulo.`,
        alternatives: alts,
      });
    }
  }

  return {
    cycleStart,
    cycleEnd: addDays(cycleEnd, -1),
    currentWeek,
    weeksElapsed,
    sessionsDone: inCycle.length,
    sessionsPlanned: weeksElapsed * trainingDays.length,
    totalSets,
    totalVolumeKg: Math.round(totalVolumeKg),
    cardioMinutes,
    prsCount,
    exercises,
    swapCandidates,
  };
}
