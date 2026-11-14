// A voz do núcleo fora do app, como dado (puro, sem React, sem rede). `plannedNotices` devolve as notificações
// locais dos próximos 7 dias; `syncNotices` (lib/native.ts) as agenda no aparelho. Regras (docs/prompt-balao-nucleo.md,
// seção 1.3): no máximo 1 por canal por dia, nada entre 22h e 7h, nada em dia de ausência declarada, lembrete na
// hora em que a pessoa costuma treinar, só números que vêm dos dados. Cada canal desliga em Ajustes → Avisos.

import { dayById, MUSCLE_LABEL } from "../../data/program";
import type { MuscleId, NoticeChannel, Session, Settings } from "../../data/types";
import { addDays, daysBetween, fromISO, mondayOf, toISO } from "../dates";
import { weekFor } from "../mesocycle";
import { weeklyReport } from "../report";
import { planAhead } from "../schedule";
import { hoursToReady, muscleStatus, type Absence } from "../visual";
import { learnedRecoveryMultipliers, type OperatorMemory, type OperatorState } from "./operator";

export type NoticeTone = "info" | "ok" | "warn" | "reward";

export interface Notice {
  /** Id da notificação no aparelho (7100–7199). */
  id: number;
  channel: NoticeChannel;
  tone: NoticeTone;
  title: string;
  text: string;
  /** Rota do app que o toque abre. */
  route: string;
  /** Data local (AAAA-MM-DD) e hora exata (ms). */
  date: string;
  at: number;
}

export const NOTICE_ID_BASE = 7100;
export const NOTICE_ID_MAX = 7199;
export const NOTICE_DAYS = 7;
/** Nada antes das 7h nem a partir das 22h. */
export const QUIET_FROM = 22;
export const QUIET_UNTIL = 7;
export const DEFAULT_NOTICE_HOUR = 18;
/** Hora fixa dos avisos de fim de semana e de ciclo. */
const EVENING = 20;
const RETOMADA_DAYS = 3;
const BACKUP_DAYS = 14;

export const CHANNEL_INFO: Record<NoticeChannel, { name: string; description: string }> = {
  treino: { name: "Dia de treino", description: "Lembra o treino do dia, na hora em que você costuma treinar." },
  pronto: { name: "Músculo pronto", description: "Avisa quando os músculos do próximo treino terminam de recuperar." },
  semana: { name: "Relatório da semana", description: "Domingo à noite, o resumo da semana, se você treinou." },
  retomada: { name: "Retomada", description: "Depois de 3 dias sem treino, sugere voltar com um treino curto." },
  ciclo: { name: "Deload e ciclo novo", description: "Na véspera do deload e do começo de um ciclo novo." },
  backup: { name: "Backup", description: "Uma vez por semana, se o último backup passou de 14 dias." },
};

export function isAbsent(date: string, absences: Absence[] | undefined): boolean {
  return !!absences?.some((a) => date >= a.from && date <= a.until);
}

/** Hora do lembrete: a escolhida em Ajustes, senão a aprendida, sempre entre 7h e 21h. */
export function noticeHour(settings: Settings, state: OperatorState | undefined): number {
  const h = settings.notices?.hour ?? state?.behavior.preferredHour ?? DEFAULT_NOTICE_HOUR;
  return Math.min(QUIET_FROM - 1, Math.max(QUIET_UNTIL, Math.round(h)));
}

function atHour(date: string, hour: number): number {
  const d = fromISO(date);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayMuscles(dayId: string): MuscleId[] {
  const day = dayById(dayId);
  if (!day) return [];
  const out: MuscleId[] = [];
  for (const e of day.exercises) for (const m of e.muscles) if (!out.includes(m)) out.push(m);
  return out;
}

export function plannedNotices(
  sessions: Session[],
  settings: Settings,
  memory: OperatorMemory,
  state: OperatorState | undefined,
  today: string,
  now: number,
): Notice[] {
  const off = new Set(settings.notices?.off ?? []);
  const absences = memory.absences;
  const hour = noticeHour(settings, state);
  const done = sessions.filter((s) => s.status === "done");
  const lastDone = done.reduce<string | undefined>((a, s) => (!a || s.date > a ? s.date : a), undefined);
  const horizon = Array.from({ length: NOTICE_DAYS }, (_, i) => addDays(today, i));
  const out: Omit<Notice, "id">[] = [];
  const push = (n: Omit<Notice, "id">) => out.push(n);

  // Retomada: o primeiro dia de treino da janela com 3+ dias desde o último treino. Nesse dia, ela substitui o
  // lembrete de treino (uma fala só).
  let retomadaDate: string | undefined;
  if (lastDone) {
    for (const d of horizon) {
      const gap = daysBetween(lastDone, d);
      if (gap < RETOMADA_DAYS || !settings.trainingDays.includes(fromISO(d).getDay()) || isAbsent(d, absences)) continue;
      if (atHour(d, hour) <= now) continue;
      retomadaDate = d;
      push({
        channel: "retomada",
        tone: "warn",
        title: "Hora de voltar",
        text: `${gap} dias sem treino. Hoje vale um treino curto, só para retomar o ritmo.`,
        route: "/",
        date: d,
        at: atHour(d, hour),
      });
      break;
    }
  }

  // Dia de treino e músculo pronto.
  const plan = planAhead(sessions, today, NOTICE_DAYS, settings.trainingDays).filter(
    (p) => !sessions.some((s) => s.status === "active" && s.date === p.date),
  );
  const status = muscleStatus(
    sessions,
    weekFor(settings.mesoStart, today),
    today,
    now,
    settings.setAdjust,
    learnedRecoveryMultipliers(state),
  );
  const readyAt = (m: MuscleId) => now + hoursToReady(status[m]) * 3_600_000;
  let prontoDone = false;
  for (const p of plan) {
    const day = dayById(p.dayId);
    if (!day || !day.exercises.length) continue;
    const at = atHour(p.date, hour);
    if (at <= now || isAbsent(p.date, absences)) continue;
    const muscles = dayMuscles(p.dayId);
    const week = weekFor(settings.mesoStart, p.date);
    if (p.date !== retomadaDate) {
      // Prontos: só os músculos principais (primeiros do dia) que de fato estarão recuperados na hora.
      const ready = muscles.slice(0, 3).filter((m) => readyAt(m) <= at);
      const tail =
        ready.length === Math.min(3, muscles.length) && ready.length
          ? ` ${cap(joinNames(ready.slice(0, 2).map((m) => MUSCLE_LABEL[m].toLowerCase())))} ${ready.length > 1 ? "prontos" : "pronto"}.`
          : "";
      push({
        channel: "treino",
        tone: "info",
        title: week === 7 ? "Deload hoje" : "Dia de treino",
        text: `${day.name} hoje, ${day.exercises.length} ${day.exercises.length === 1 ? "exercício" : "exercícios"}.${tail}`,
        route: "/",
        date: p.date,
        at,
      });
    }
    // Músculo pronto: só para o próximo treino, quando o último músculo principal termina de recuperar antes dele.
    if (!prontoDone) {
      prontoDone = true;
      const pending = muscles.slice(0, 3).filter((m) => readyAt(m) > now);
      if (pending.length) {
        let when = Math.max(...pending.map(readyAt));
        const wd = new Date(when);
        if (wd.getHours() >= QUIET_FROM) when = atHour(addDays(dateOf(when), 1), QUIET_UNTIL);
        else if (wd.getHours() < QUIET_UNTIL) when = atHour(dateOf(when), QUIET_UNTIL);
        const date = dateOf(when);
        if (when < at && when > now && date >= today && date <= horizon[horizon.length - 1] && !isAbsent(date, absences)) {
          push({
            channel: "pronto",
            tone: "ok",
            title: "Recuperado",
            text: `${cap(joinNames(pending.slice(0, 2).map((m) => MUSCLE_LABEL[m].toLowerCase())))} ${pending.length > 1 ? "prontos" : "pronto"} para o ${day.name}.`,
            route: "/progresso",
            date,
            at: when,
          });
        }
      }
    }
  }

  // Relatório da semana: domingo às 20h, se já houve treino nesta semana.
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const rep = weeklyReport(sessions, monday, settings.mesoStart, settings.trainingDays, today, settings.setAdjust);
  if (rep.done > 0 && !isAbsent(sunday, absences) && atHour(sunday, EVENING) > now) {
    const prs = rep.prs.length;
    const label = rep.mesoWeek ? `Semana ${rep.mesoWeek} fechada` : "Semana fechada";
    push({
      channel: "semana",
      tone: prs ? "reward" : "info",
      title: "Relatório da semana",
      text: `${label}: ${rep.done} de ${rep.planned} ${rep.planned === 1 ? "treino" : "treinos"}${prs ? `, ${prs} ${prs === 1 ? "recorde" : "recordes"}` : ""}.`,
      route: "/relatorio",
      date: sunday,
      at: atHour(sunday, EVENING),
    });
  }

  // Véspera do deload e do ciclo novo (programa com mesociclo).
  for (const d of horizon) {
    const next = addDays(d, 1);
    const w = weekFor(settings.mesoStart, d);
    const wn = weekFor(settings.mesoStart, next);
    if (!w || w === wn || isAbsent(d, absences) || atHour(d, EVENING) <= now) continue;
    if (wn === 7) {
      push({
        channel: "ciclo",
        tone: "info",
        title: "Deload amanhã",
        text: "Amanhã começa o deload: metade das séries, mesma carga.",
        route: "/",
        date: d,
        at: atHour(d, EVENING),
      });
    } else if (wn === 1 && w === 7) {
      push({
        channel: "ciclo",
        tone: "info",
        title: "Ciclo novo",
        text: "Amanhã começa um ciclo novo, na semana 1.",
        route: "/",
        date: d,
        at: atHour(d, EVENING),
      });
    }
  }

  // Backup: uma vez na janela, se o último passou de 14 dias (ou nunca houve, com treinos registrados).
  const stale = settings.lastBackupAt ? daysBetween(settings.lastBackupAt, today) >= BACKUP_DAYS : done.length >= 3;
  if (stale) {
    const d = horizon.find((x) => !isAbsent(x, absences) && atHour(x, 12) > now);
    if (d) {
      const text = settings.lastBackupAt
        ? `Último backup há ${daysBetween(settings.lastBackupAt, d)} dias. Salve uma cópia dos seus treinos.`
        : `${done.length} treinos e nenhum backup ainda. Salve uma cópia dos seus treinos.`;
      push({ channel: "backup", tone: "warn", title: "Backup", text, route: "/ajustes", date: d, at: atHour(d, 12) });
    }
  }

  // Regras finais: canal desligado, 1 por canal por dia, nunca no silêncio, nunca no passado, por ordem de hora.
  const seen = new Set<string>();
  return out
    .filter((n) => !off.has(n.channel))
    .filter((n) => {
      const h = new Date(n.at).getHours();
      return n.at > now && h >= QUIET_UNTIL && h < QUIET_FROM && !isAbsent(n.date, absences);
    })
    .sort((a, b) => a.at - b.at)
    .filter((n) => {
      const k = `${n.channel}|${n.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, NOTICE_ID_MAX - NOTICE_ID_BASE + 1)
    .map((n, i) => ({ ...n, id: NOTICE_ID_BASE + i }));
}

function dateOf(ms: number): string {
  return toISO(new Date(ms));
}
