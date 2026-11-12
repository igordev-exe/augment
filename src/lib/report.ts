import { LIB_BY_ID } from "../data/library";
import { dayById, exById, MUSCLE_LABEL, MUSCLE_ORDER, programDays, shortName, exOf } from "../data/program";
import { SCIENCE } from "../data/science";
import type { MuscleId, Session, Unit } from "../data/types";
import { addDays, bySessionAsc, daysBetween, shortDate, todayISO } from "./dates";
import { rirRange, setsFor, weekFor } from "./mesocycle";
import { bestE1rm, entryE1rm, formatWeight, historyOf, LB_TO_KG, mainLoad, prsBySession, toKg, workSets, type PR } from "./progression";
import { restsBefore, volumeAdvice, type VolumeAdvice } from "./engine";
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
  /** Séries diretas (done/planned) e fracionadas (diretas + 0,5 por série indireta, Pelland 2026). */
  volume: { muscle: MuscleId; done: number; planned: number; fractional: number; fractionalPlanned: number }[];
  /** Músculos abaixo da dose mínima efetiva (séries fracionadas) numa semana já fechada. */
  belowMinimum: MuscleId[];
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

export function weeklyReport(
  all: Session[],
  weekStart: string,
  mesoStart: string,
  trainingDays: number[],
  today = todayISO(),
  /** Ajuste de séries por exercício (Ajustes → setAdjust). */
  setAdjust: Record<string, number> = {},
): WeekReport {
  const weekEnd = addDays(weekStart, 7);
  const done = all.filter((s) => s.status === "done");
  const sessions = done.filter((s) => s.date >= weekStart && s.date < weekEnd).sort(bySessionAsc);
  const upToEnd = done.filter((s) => s.date < weekEnd);
  const mesoWeek = sessions[0]?.week ?? (weekStart >= mesoStart ? weekFor(mesoStart, weekStart) : null);
  const planned = trainingDays.length;

  // Frequência
  const doneDays = new Set(sessions.map((s) => s.dayId));
  const missingDays =
    planned >= programDays().length && sessions.length < planned
      ? programDays()
          .map((d) => d.id)
          .filter((id) => !doneDays.has(id))
      : [];

  // Séries a menos que o planejado. O treino guarda todo exercício do dia; o pulado fica com 0 séries.
  const shortfalls: Shortfall[] = [];
  for (const s of sessions) {
    for (const e of s.exercises) {
      const ex = exOf(e);
      if (!ex) continue;
      const want = setsFor(ex, s.week, setAdjust[ex.id]);
      const got = workSets(e).length;
      if (got < want) shortfalls.push({ date: s.date, dayId: s.dayId, exId: e.exId, done: got, planned: want });
    }
  }

  // Volume por músculo contra a meta da semana
  const vol = weeklyVolume(sessions, weekStart);
  const plan = plannedVolume(mesoWeek ?? 2, false, setAdjust);
  const frac = weeklyVolume(sessions, weekStart, true);
  const fracPlan = plannedVolume(mesoWeek ?? 2, true, setAdjust);
  const volume = MUSCLE_ORDER.filter((m) => plan[m] > 0).map((m) => ({
    muscle: m,
    done: vol[m],
    planned: plan[m],
    fractional: frac[m],
    fractionalPlanned: fracPlan[m],
  }));
  // Dose mínima efetiva só faz sentido com a semana fechada e fora do deload (que corta o volume de propósito).
  const weekOver = today >= weekEnd;
  const belowMinimum =
    weekOver && sessions.length > 0 && mesoWeek !== 7
      ? volume
          .filter((v) => v.fractionalPlanned >= SCIENCE.volume.minEffective && v.fractional < SCIENCE.volume.minEffective)
          .map((v) => v.muscle)
      : [];

  // Reps que sobraram contra a meta da semana de cada sessão
  const rir = { logged: 0, inTarget: 0, harder: [] as RirMiss[], easier: [] as RirMiss[] };
  for (const s of sessions) {
    for (const e of s.exercises) {
      const ex = exOf(e);
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
  const trained = new Map<string, { exId: string; alt?: string; lib?: string }>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (workSets(e).length) trained.set(e.exId, { exId: e.exId, alt: e.alt, lib: exOf(e)?.lib });
    }
  }
  for (const { exId, alt, lib } of trained.values()) {
    const h = historyOf(
      upToEnd.filter((s) => s.week !== 7),
      exId,
      alt,
      lib,
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
  // Descanso real (pelos horários de "feita") bem abaixo do da ficha: custa reps (Singer 2024; erro nº 2 da ficha).
  const shortRest: string[] = [];
  const restById = new Map<string, number[]>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      const ex = exOf(e);
      if (!ex || ex.superset || ex.rest[0] < 60) continue;
      const rs = restsBefore(e)
        .map((r) => r.rest)
        .filter((r): r is number => r != null && r < 600);
      restById.set(e.exId, [...(restById.get(e.exId) ?? []), ...rs]);
    }
  }
  for (const [exId, rs] of restById) {
    if (rs.length < 2) continue;
    const median = [...rs].sort((a, b) => a - b)[Math.floor(rs.length / 2)];
    const ex = exById(exId) ?? sessions.flatMap((s) => s.exercises).find((e) => e.exId === exId)?.snap;
    if (ex && median < ex.rest[0] * 0.6) shortRest.push(`${shortName(ex)} (~${median} s, ficha ${ex.restLabel})`);
  }
  if (shortRest.length) {
    signals.push(`Descanso curto em ${list(shortRest)}: com menos descanso as séries seguintes rendem menos reps.`);
  }
  const long = sessions.filter((s) => s.finishedAt && (s.finishedAt - s.startedAt) / 60000 > 100).length;
  if (long >= 2) {
    signals.push(`${long} treinos passaram de 100 min (a ficha prevê 70–80): use o superset e, se precisar, corte 1 série da face pull.`);
  }
  if (belowMinimum.length) {
    signals.push(
      `${list(belowMinimum.map((m) => MUSCLE_LABEL[m]))} abaixo de ${SCIENCE.volume.minEffective} séries fracionadas: ` +
        "dose mínima para manter o estímulo de hipertrofia (Pelland 2026).",
    );
  }

  const recent = done.filter((s) => s.date >= addDays(weekStart, -14) && s.date < weekEnd);
  const joints: JointIssue[] = [];
  for (const { exId, lib } of trained.values()) {
    const hurtThisWeek = sessions.some((s) => s.exercises.some((e) => e.exId === exId && e.feedback?.joint === "incomodou"));
    if (!hurtThisWeek) continue;
    const times = recent.filter((s) => s.exercises.some((e) => e.exId === exId && e.feedback?.joint === "incomodou")).length;
    const libId = lib ?? exById(exId)?.lib;
    joints.push({ exId, times, alternatives: (libId ? LIB_BY_ID[libId]?.alternatives : undefined) ?? [] });
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
    belowMinimum,
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
    const name = shortName(exById(joint.exId));
    const alt = joint.alternatives.length ? ` Alternativas: ${list(joint.alternatives)}.` : "";
    return { title: `Trocar ${name}`, detail: `Incomodou a articulação ${joint.times} vezes em 3 semanas.${alt}` };
  }
  if (r.signals.some((s) => s.startsWith("Dor forte"))) {
    return { title: "Cuidar da dor", detail: "Teve dor forte nesta semana. Pule o que dói e, se continuar, procure avaliação." };
  }
  if (r.done < Math.ceil(r.planned / 2)) {
    const miss = r.missingDays.length ? ` Ficaram de fora: ${list(r.missingDays.map((d) => dayById(d).name))}.` : "";
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
      detail: `Faltaram ${missingSets} séries: ${list(worst.map((s) => `${shortName(exById(s.exId))} (${s.done}/${s.planned})`))}.`,
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
    const names = r.stalls.map((s) => shortName(exById(s.exId)));
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
  /** +1/−1 série por exercício para o próximo mesociclo (retorno "como bateu" + evolução). */
  volumeAdvice: (VolumeAdvice & { name: string })[];
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
  const allProgramEx = programDays().flatMap((d) => d.exercises);

  for (const ex of allProgramEx) {
    // Considera sessões do ciclo; para comparar o pico, prefere última sessão fora do deload quando disponível.
    const allHits = inCycle
      .map((s) => ({ session: s, entry: s.exercises.find((e) => e.exId === ex.id) }))
      .filter((x): x is { session: Session; entry: Session["exercises"][number] } => !!x.entry && workSets(x.entry).length > 0);
    if (!allHits.length) continue;

    // Compara a mesma variante: a titular se tiver 2+ sessões no ciclo, senão a mais usada. Misturar a titular com
    // uma alternativa mais leve fazia o relatório ver "queda" e sugerir tirar série.
    const byAlt = new Map<string, typeof allHits>();
    for (const h of allHits) {
      const k = h.entry.alt || "";
      byAlt.set(k, [...(byAlt.get(k) ?? []), h]);
    }
    const own = byAlt.get("") ?? [];
    const hits = own.length >= 2 ? own : [...byAlt.values()].sort((a, b) => b.length - a.length)[0];

    const first = hits[0];
    const nonDeloadHits = hits.filter((h) => h.session.week !== 7);
    const last = nonDeloadHits.length > 0 ? nonDeloadHits[nonDeloadHits.length - 1] : hits[hits.length - 1];

    const fWork = workSets(first.entry, false);
    const lWork = workSets(last.entry, false);
    if (!fWork.length || !lWork.length) continue;

    const unit = last.entry.unit;
    const conv = (w: number, u: Unit) => (u === unit ? w : Number((unit === "kg" ? toKg(w, u) : w / LB_TO_KG).toFixed(2)));
    const firstRawLoad = mainLoad(fWork) ?? fWork[0].weight!;
    const firstLoad = conv(firstRawLoad, first.entry.unit);
    const firstReps = Math.max(...fWork.filter((s) => s.weight === firstRawLoad).map((s) => s.reps!));
    // Régua de comparação (soma o que sobrou, sem teto de reps): a semana 1 para com 2–3 sobrando, a 6 vai à falha.
    const firstE1rm = entryE1rm(first.entry, "comparacao")?.value;

    const lastLoad = mainLoad(lWork) ?? lWork[0].weight!;
    const lastReps = Math.max(...lWork.filter((s) => s.weight === lastLoad).map((s) => s.reps!));
    const lastE1rm = entryE1rm(last.entry, "comparacao")?.value;
    if (firstE1rm == null || lastE1rm == null) continue;

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
    const ex = exById(ep.exId);
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
      .filter((ep) => !ep.compound && !already.has(ep.exId) && (LIB_BY_ID[exById(ep.exId).lib]?.alternatives?.length ?? 0) > 0)
      .sort((a, b) => a.deltaE1rmPct - b.deltaE1rmPct);
    for (const ep of more) {
      if (swapCandidates.length >= 3) break;
      const alts = LIB_BY_ID[exById(ep.exId).lib]?.alternatives ?? [];
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
    volumeAdvice: volumeAdvice(inCycle, Object.fromEntries(exercises.map((e) => [e.exId, e.deltaE1rmPct])), (id) =>
      exById(id) ? setsFor(exById(id), 3) : 0,
    ).map((v) => ({ ...v, name: shortName(exById(v.exId)) })),
  };
}
