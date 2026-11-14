import type { ProgramExercise, Session, SessionExercise, SetEntry, Settings } from "../../data/types";
import { dayOf, exOf, shortName } from "../../data/program";
import { liveNudges, intensifierPlan, restsBefore } from "../engine";
import { isLowDay, rirRange, setsFor, WEEK_RULES } from "../mesocycle";
import { formatWeight, historyOf, increaseStep, toKg, workSets } from "../progression";
import { suspiciousSet } from "../sanity";
import type { DayForm, LiveState } from "./live";
import type { OperatorState } from "./operator";

// Núcleo ao vivo (fase 2): uma voz só. Os candidatos (recados do motor e as falas novas) passam por um diretor que
// devolve no máximo UMA fala. Silêncio é o padrão: série no alvo não gera fala além da meta da próxima.

export type CueMoment = "abertura" | "antes" | "depois" | "descanso" | "troca" | "fim";

export interface Cue {
  /** `regra:alvo` (ex.: `falha-composto:push-a.supino`). O mesmo id não repete no treino. */
  id: string;
  moment: CueMoment;
  /** 0 segurança, 1 correção, 2 meta, 3 registro de fato bom. */
  priority: 0 | 1 | 2 | 3;
  text: string;
  /** Id do princípio em `science.ts`. */
  why?: string;
  /** Meta (abertura, antes, troca): é a linha padrão do HUD, não conta no teto nem no "1 fala por série". */
  meta?: boolean;
  /** Série depois da qual a fala saiu (a memória do diretor). */
  setId?: string;
}

export interface LiveLogEntry {
  id: string;
  at: number;
  setId?: string;
  acted?: boolean;
  /** O que foi dito (para o histórico recolhido no cartão do exercício). */
  text?: string;
}

/** Leitura do dia (fase 3): ±0,5 = ±3% de força estimada, cerca de 1 rep numa série de 10. */
/** Dia abaixo com confiança: mantém cargas, sem intensificador, oferece o corte de isolados. */
export const isLowForm = (f: Pick<DayForm, "value" | "confidence">) => f.confidence >= 0.5 && f.value <= -0.5;
export const isHighForm = (f: Pick<DayForm, "value" | "confidence">) => f.confidence >= 0.5 && f.value >= 0.5;

/** Teto de falas (fora as metas) por treino. Calibrado nos simulados (`director.test.ts`). */
export const CUE_CAP = 8;

export const ruleOf = (id: string) => id.split(":")[0];

// ---------- Variação determinística ----------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Escolhe 1 de 3–4 jeitos de dizer a mesma regra, pela semente `session.id` + contagem de falas. */
export function vary(session: Session, rule: string, options: string[]): string {
  const count = (session.liveLog ?? []).filter((e) => !e.id.startsWith("meta")).length;
  return options[hash(`${session.id}|${rule}|${count}`) % options.length];
}

// ---------- Candidatos ----------

const unitOf = (e: SessionExercise) => (e.unit === "lb" ? "lb" : "kg");

function doneWork(e: SessionExercise): SetEntry[] {
  return e.sets
    .filter((s) => s.done && s.kind !== "warmup" && s.reps != null && s.weight != null)
    .sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0));
}

/** A série feita mais recente da sessão inteira (a que abre o momento "depois"). */
export function latestDone(session: Session): { entry: SessionExercise; set: SetEntry } | null {
  let best: { entry: SessionExercise; set: SetEntry } | null = null;
  for (const e of session.exercises) {
    for (const s of e.sets) {
      if (!s.done || s.kind === "warmup") continue;
      if (!best || (s.doneAt ?? 0) >= (best.set.doneAt ?? 0)) best = { entry: e, set: s };
    }
  }
  return best;
}

function nameOf(ex: ProgramExercise) {
  return shortName(ex);
}

/** Recados de `liveNudges` reescritos em fala curta, com o número da pessoa. */
function afterSetCues(
  session: Session,
  history: Session[],
  settings: Settings,
  entry: SessionExercise,
  set: SetEntry,
  live: LiveState,
  operator?: OperatorState,
): Cue[] {
  const ex = exOf(entry);
  if (!ex) return [];
  const week = session.week;
  const lowDay = isLowDay(session.checkin);
  const day = dayOf(session);
  const intensifiers = intensifierPlan(day?.exercises ?? [], week, lowDay);
  const hist = historyOf(history, ex.id, entry.alt, ex.lib);
  const nudges = liveNudges({
    ex,
    entry,
    week,
    lowDay,
    history: hist,
    plannedSets: setsFor(ex, week, settings.setAdjust?.[ex.id]),
    step: increaseStep(ex, entry.unit, settings.increments[ex.id]),
    availableWeights: settings.machineWeights?.[ex.id],
    intensifier: intensifiers.has(ex.id) && !isLowForm(live.form),
    rirBias: (operator?.behavior.rirBiasConfidence ?? 0) >= 0.5 ? operator?.behavior.rirBias : undefined,
  });
  const u = unitOf(entry);
  const w = formatWeight(set.weight);
  const reps = set.reps ?? 0;
  const [tLo, tHi] = rirRange(ex.stop, week);
  const tLabel = tLo === tHi ? `${tLo}` : `${tLo}–${tHi}`;
  const out: Cue[] = [];
  const add = (rule: string, priority: Cue["priority"], why: string, options: string[], moment: CueMoment = "depois") =>
    out.push({ id: `${rule}:${ex.id}`, moment, priority, text: vary(session, rule, options), why, setId: set.id });

  // Segurança: número que parece erro de digitação.
  const histMaxKg = Math.max(0, ...hist.flatMap((h) => workSets(h.entry).map((s) => toKg(s.weight!, h.entry.unit))));
  const odd = set.kind !== "warmup" ? suspiciousSet(set, entry.unit, histMaxKg) : null;
  if (odd) {
    out.push({
      id: `carga-suspeita:${set.id}`,
      moment: "depois",
      priority: 0,
      text: `Confira: ${odd}`,
      why: "carga-pratica",
      setId: set.id,
    });
  }

  for (const n of nudges) {
    const isLatestRule = n.id !== "abaixo-do-normal" && n.id !== "meta-batida" && n.id !== "intensificador";
    if (isLatestRule && set.kind !== "work" && n.id !== "descanso-curto") continue;
    switch (n.id) {
      case "falha-composto":
        add("falha-composto", 1, n.why, [
          `Falha com ${w} ${u}. Na próxima, pare com 1 sobrando.`,
          `${reps} reps até a falha. Composto pede 1 sobrando: segure 1 na próxima.`,
          `Foi a 0 com ${w} ${u}. Guarde 1 rep na próxima série.`,
        ]);
        break;
      case "falha-cedo":
        add("falha-cedo", 1, n.why, [
          `Sobrou ${set.rir}; a semana ${week} pede ${tLabel}. Segure um pouco.`,
          `Semana ${week}: meta de ${tLabel} sobrando, foi ${set.rir}. Pare antes na próxima.`,
          `${set.rir} sobrando é cedo para a semana ${week} (meta ${tLabel}).`,
        ]);
        break;
      case "longe-da-falha":
        add("longe-da-falha", 1, n.why, [
          `Sobraram ${set.rir! >= 4 ? "4+" : set.rir}; a meta é ${tLabel}. Vá mais perto na próxima.`,
          `${reps} reps com ${set.rir! >= 4 ? "4+" : set.rir} sobrando. Pode passar do número na próxima.`,
          `Meta de ${tLabel} sobrando, ficou ${set.rir! >= 4 ? "4+" : set.rir}. Próxima: mais perto da falha.`,
        ]);
        break;
      case "descanso-curto": {
        const rests = restsBefore(entry);
        const r = rests.find((x) => x.set.id === set.id)?.rest;
        add("descanso-curto", 1, n.why, [
          `Descanso de ~${r ?? "?"} s e as reps caíram para ${reps}. Espere o timer.`,
          `~${r ?? "?"} s de pausa custou reps (${reps}). Próxima: o descanso da ficha.`,
          `Caiu para ${reps} depois de ~${r ?? "?"} s. Descanse até o timer zerar.`,
        ]);
        break;
      }
      case "abaixo-do-normal":
        // Com a leitura do dia confiável, quem fala é o "dia-abaixo" (um só para o treino inteiro).
        if (live.form.confidence >= 0.5) break;
        add("abaixo-do-normal", 1, n.why, [
          `1ª série com ${reps} reps, abaixo da última vez. Mantenha ${w} ${u}, sem recorde hoje.`,
          `${reps} na 1ª, menos que da última vez. Dia abaixo: segure a carga.`,
          `Abaixo do normal (${reps} reps). Mantenha ${w} ${u} e sem intensificador.`,
        ]);
        break;
      case "recorde-reps":
        add("recorde-reps", 3, n.why, [
          `Recorde: ${reps} reps com ${w} ${u}.`,
          `${reps} com ${w} ${u}: melhor marca nessa carga.`,
          `Nova marca nessa carga: ${reps} reps.`,
        ]);
        break;
      case "intensificador":
        if (ex.intensifier) {
          add(
            "intensificador",
            2,
            n.why,
            [
              `Última série: ${ex.intensifier.toLowerCase()}. Só se a técnica estiver limpa.`,
              `Falta 1 série. Vale ${ex.intensifier.toLowerCase()} nela.`,
              `Série final com ${ex.intensifier.toLowerCase()}, técnica primeiro.`,
            ],
            "antes",
          );
        }
        break;
      case "meta-batida":
        out.push({
          id: `meta-batida:${ex.id}`,
          moment: "depois",
          priority: n.tone === "good" ? 3 : 1,
          text: n.text.split(" (")[0].replace(/\.$/, "") + ".",
          why: n.why,
          setId: set.id,
        });
        break;
    }
  }
  // Leitura do dia (fase 3): uma fala por treino, sempre para o lado seguro.
  const f = live.form;
  const pct = Math.abs(Math.round(f.value * 6));
  if (isLowForm(f)) {
    out.push({
      id: "dia-abaixo",
      moment: "depois",
      priority: 1,
      text: vary(session, "dia-abaixo", [
        `Hoje está ~${pct}% abaixo (${f.basis.length} ${f.basis.length === 1 ? "sinal" : "sinais"}). Mantenha as cargas, sem intensificador.`,
        `Força ~${pct}% abaixo do normal hoje. Segure as cargas; dá para tirar 1 série dos isolados.`,
        `Dia ~${pct}% abaixo. Nada de subir carga nem intensificador hoje.`,
      ]),
      why: "autorregulacao",
      setId: set.id,
    });
  } else if (isHighForm(f)) {
    out.push({
      id: "dia-acima",
      moment: "depois",
      priority: 3,
      text: vary(session, "dia-acima", [
        `Hoje está ~${pct}% acima. Pode passar do topo da faixa; a carga sobe na próxima sessão.`,
        `Força ~${pct}% acima do normal. Vale passar do topo nas séries que faltam.`,
        `Dia ~${pct}% acima: reps a mais contam, a carga fica para a próxima.`,
      ]),
      why: "autorregulacao",
      setId: set.id,
    });
  }
  return out;
}

/** Linha de abertura: dia, semana e o que muda hoje (com um número). */
function openingCue(session: Session, settings: Settings): Cue {
  const day = dayOf(session);
  const rule = WEEK_RULES[session.week];
  const planned = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.kind !== "warmup").length, 0);
  const pain = session.checkin?.pain === "forte";
  if (pain) {
    return {
      id: "dor-forte",
      moment: "abertura",
      priority: 0,
      text: "Dor forte no check-in: pare se doer na execução e troque pela alternativa.",
      why: "autorregulacao",
    };
  }
  void settings;
  return {
    id: "meta:abertura",
    moment: "abertura",
    priority: 2,
    meta: true,
    text: `${day?.name ?? "Treino"} · ${rule?.label ?? `Semana ${session.week}`}: ${session.exercises.length} exercícios, ${planned} séries.`,
  };
}

/** Meta da próxima série: "Série 2: 8 com 80 kg · última vez 7." */
function nextCue(session: Session, history: Session[], live: LiveState): Cue | null {
  const n = live.next;
  if (!n) return null;
  const entry = session.exercises.find((e) => e.exId === n.exId);
  if (!entry) return null;
  const ex = exOf(entry);
  const u = unitOf(entry);
  const work = entry.sets.filter((s) => s.kind !== "warmup");
  const idx = work.findIndex((s) => s.id === n.setId) + 1;
  const started = doneWork(entry).length > 0;
  const range = `${n.target[0]}–${n.target[1]}`;
  const reps = n.predicted != null && n.confidence >= 0.4 ? `${Math.min(n.predicted, n.target[1] + 3)}` : range;
  const load = n.weight != null ? ` com ${formatWeight(n.weight)} ${u}` : "";
  const hist = historyOf(history, ex.id, entry.alt, ex.lib);
  const prevSet = workSets(hist[hist.length - 1]?.entry, false)[idx - 1];
  const last = prevSet ? ` · última vez ${prevSet.reps}` : "";
  if (n.adjust) {
    return {
      id: `ajuste:${ex.id}:${n.adjust.weight}`,
      moment: "antes",
      priority: 1,
      text: vary(session, "ajuste", [
        `Previsão de ${n.predicted} reps${load}. Baixe para ${formatWeight(n.adjust.weight)} ${u} e fique em ${range}.`,
        `${formatWeight(n.adjust.weight)} ${u} agora: com ${formatWeight(n.weight)} a previsão é ${n.predicted}, abaixo de ${n.target[0]}.`,
        `Com ${formatWeight(n.weight)} ${u} sairiam ~${n.predicted}. Vá de ${formatWeight(n.adjust.weight)} ${u}.`,
      ]),
      why: "autorregulacao",
      setId: latestDone(session)?.set.id,
    };
  }
  if (!started) {
    return {
      id: `meta:troca:${ex.id}`,
      moment: "troca",
      priority: 2,
      meta: true,
      text: `${nameOf(ex)}: ${work.length} séries de ${range}${load}${last}.`,
    };
  }
  return {
    id: `meta:antes:${n.setId}`,
    moment: "antes",
    priority: 2,
    meta: true,
    text: `Série ${idx}/${work.length}: ${reps}${load}${last}.`,
  };
}

/** Todos os candidatos do momento atual (o diretor escolhe um). */
export function cueCandidates(session: Session, history: Session[], settings: Settings, live: LiveState, operator?: OperatorState): Cue[] {
  const out: Cue[] = [];
  const latest = latestDone(session);
  if (!latest) out.push(openingCue(session, settings));
  else out.push(...afterSetCues(session, history, settings, latest.entry, latest.set, live, operator));
  const n = nextCue(session, history, live);
  if (n) out.push(n);
  if (live.clock.overCapMin) {
    out.push({
      id: "relogio",
      moment: "descanso",
      priority: 1,
      text: `No ritmo de hoje, passa ${live.clock.overCapMin} min do tempo combinado. Dá para tirar 1 série dos isolados.`,
      why: "volume-dose",
      setId: latest?.set.id,
    });
  }
  return out;
}

// ---------- Diretor ----------

/** Regra ignorada 2 vezes seguidas nesta sessão: não volta nela. */
function ignoredTwice(log: LiveLogEntry[], rule: string): boolean {
  const judged = log.filter((e) => ruleOf(e.id) === rule && e.acted !== undefined);
  return judged.length >= 2 && judged.slice(-2).every((e) => e.acted === false);
}

/**
 * Escolhe no máximo uma fala. Regras: 1 fala por série; teto {@link CUE_CAP} por treino; o mesmo id não repete; regra
 * ignorada 2 vezes seguidas não volta; prioridade menor ganha. Sem fala, a meta da próxima série (ou nada).
 * A fala já registrada para a série atual continua na tela até a próxima série (estável entre renderizações).
 */
export function pickCue(candidates: Cue[], session: Session, muted?: Set<string>): Cue | null {
  const log = session.liveLog ?? [];
  const spoken = log.filter((e) => !e.id.startsWith("meta"));
  const latestSet = latestDone(session)?.set.id;
  const metas = candidates.filter((c) => c.meta).sort((a, b) => a.priority - b.priority);
  // Já falou nesta série: mantém a mesma fala (se ainda vale) ou a meta.
  const sayingNow = latestSet ? spoken.find((e) => e.setId === latestSet) : undefined;
  if (sayingNow) return candidates.find((c) => c.id === sayingNow.id) ?? metas[0] ?? null;
  const said = new Set(spoken.map((e) => e.id));
  const capped = spoken.length >= CUE_CAP;
  const pool = candidates
    .filter((c) => !c.meta)
    .filter((c) => !said.has(c.id))
    .filter((c) => !ignoredTwice(log, ruleOf(c.id)))
    .filter((c) => c.priority === 0 || !muted?.has(ruleOf(c.id)))
    .filter((c) => !capped || c.priority === 0)
    .sort((a, b) => a.priority - b.priority);
  return pool[0] ?? metas[0] ?? null;
}

// ---------- Fase 4: aprender com o que foi ignorado ----------

/** Mínimo de vezes conferidas para uma regra sair do treino por nunca ser seguida. */
export const MUTE_MIN = 4;

/** Taxa de aceitação por regra, a partir do `liveLog` das sessões (só as falas conferidas). */
export function acceptanceByRule(sessions: Session[]): Map<string, { judged: number; acted: number }> {
  const out = new Map<string, { judged: number; acted: number }>();
  for (const s of sessions) {
    for (const e of s.liveLog ?? []) {
      if (e.acted === undefined) continue;
      const r = ruleOf(e.id);
      const cur = out.get(r) ?? { judged: 0, acted: 0 };
      cur.judged++;
      if (e.acted) cur.acted++;
      out.set(r, cur);
    }
  }
  return out;
}

/** Regras que a pessoa nunca segue (conferidas {@link MUTE_MIN}+ vezes, aceitação 0): saem da fala no treino. */
export function ignoredRules(sessions: Session[]): Set<string> {
  const out = new Set<string>();
  for (const [r, v] of acceptanceByRule(sessions)) if (v.judged >= MUTE_MIN && v.acted === 0) out.add(r);
  return out;
}

/** Nome da regra para o relatório. */
export const RULE_LABEL: Record<string, string> = {
  "falha-composto": "parar 1 rep antes da falha nos compostos",
  "falha-cedo": "segurar a sobra da semana",
  "longe-da-falha": "ir mais perto da falha",
  "descanso-curto": "esperar o descanso da ficha",
  ajuste: "baixar a carga quando a previsão cai",
};

/** Entrada nova no `liveLog` quando a fala escolhida ainda não foi registrada (metas não entram). */
export function logCue(session: Session, cue: Cue | null, now: number): LiveLogEntry[] | null {
  if (!cue || cue.meta) return null;
  const log = session.liveLog ?? [];
  if (log.some((e) => e.id === cue.id)) return null;
  return [...log, { id: cue.id, at: now, setId: cue.setId, text: cue.text }];
}

/**
 * Confere se a pessoa seguiu o que foi dito, olhando a série feita logo depois no mesmo exercício.
 * Devolve o log com `acted` preenchido onde já dá para saber (ou null se nada mudou).
 */
export function judgeLog(session: Session): LiveLogEntry[] | null {
  const log = session.liveLog;
  if (!log?.length) return null;
  let changed = false;
  const out = log.map((e) => {
    if (e.acted !== undefined) return e;
    const rule = ruleOf(e.id);
    const target = e.id.split(":")[1];
    const entry = session.exercises.find((x) => x.exId === target);
    if (!entry) return e;
    const work = doneWork(entry);
    const i = e.setId ? work.findIndex((s) => s.id === e.setId) : -1;
    const prev = i >= 0 ? work[i] : undefined;
    const next = i >= 0 ? work[i + 1] : rule === "ajuste" ? work.find((s) => (s.doneAt ?? 0) > e.at) : undefined;
    if (!next) return e;
    let acted: boolean | undefined;
    if (rule === "falha-composto" || rule === "falha-cedo") acted = next.rir != null ? next.rir > (prev?.rir ?? 0) : undefined;
    else if (rule === "longe-da-falha") acted = next.rir != null ? next.rir < (prev?.rir ?? 4) : undefined;
    else if (rule === "descanso-curto") {
      const ex = exOf(entry);
      const r = restsBefore(entry).find((x) => x.set.id === next.id)?.rest;
      acted = r != null && ex ? r >= ex.rest[0] * 0.7 : undefined;
    } else if (rule === "ajuste") acted = next.weight != null && next.weight <= Number(e.id.split(":")[2]) + 1e-6;
    if (acted === undefined) return e;
    changed = true;
    return { ...e, acted };
  });
  return changed ? out : null;
}

/** Sanitiza o `liveLog` vindo de um backup. */
export function sanitizeLiveLog(raw: unknown): LiveLogEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: LiveLogEntry[] = [];
  for (const x of raw.slice(0, 200)) {
    const e = x as LiveLogEntry;
    if (!e || typeof e.id !== "string" || e.id.length > 200 || !Number.isFinite(e.at)) continue;
    out.push({
      id: e.id,
      at: e.at,
      ...(typeof e.setId === "string" ? { setId: e.setId } : {}),
      ...(typeof e.acted === "boolean" ? { acted: e.acted } : {}),
      ...(typeof e.text === "string" ? { text: e.text.slice(0, 300) } : {}),
    });
  }
  return out.length ? out : undefined;
}

/** Momento "fim": 1 coisa para a próxima, a partir do que foi dito e seguido hoje (linha do `TerminalLog`). */
export function finishCueLine(session: Session): string | null {
  const log = (session.liveLog ?? []).filter((e) => !e.id.startsWith("meta"));
  const ignored = log.filter((e) => e.acted === false);
  if (ignored.length) {
    const r = ruleOf(ignored[ignored.length - 1].id);
    const tip: Record<string, string> = {
      "falha-composto": "PARAR 1 REP ANTES NOS COMPOSTOS",
      "falha-cedo": "SEGURAR A SOBRA DA SEMANA",
      "longe-da-falha": "IR MAIS PERTO DA FALHA",
      "descanso-curto": "ESPERAR O TIMER",
      ajuste: "ACEITAR A CARGA MAIS LEVE QUANDO A PREVISÃO CAI",
    };
    if (tip[r]) return `//PRÓXIMA: ${tip[r]}`;
  }
  return `//NÚCLEO: ${log.length} ${log.length === 1 ? "FALA" : "FALAS"} · ${log.filter((e) => e.acted).length} SEGUIDAS`;
}
