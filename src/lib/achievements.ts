import type { BodyEntry, Session, Settings } from "../data/types";
import { mondayOf } from "./dates";
import { prsBySession } from "./progression";
import { sessionStats } from "./sessions";

export interface Achievement {
  id: string;
  code: string;
  title: string;
  detail: string;
  unlocked: boolean;
  progress: string;
  pct: number;
}

export function computeAchievements(sessions: Session[], settings: Settings, bodyLog: BodyEntry[] = []): Achievement[] {
  const done = sessions.filter((s) => s.status === "done");
  const totalSessions = done.length;

  // Volume total e séries com RIR
  let totalVolumeKg = 0;
  let rirSets = 0;
  let cardioMinutes = 0;
  const byWeek = new Map<string, number>();
  const weeksSeen = new Set<number>();

  for (const s of done) {
    const st = sessionStats(s);
    totalVolumeKg += st.volumeKg;
    cardioMinutes += s.cardio?.minutes ?? 0;
    const wk = mondayOf(s.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
    if (s.week >= 1 && s.week <= 7) weeksSeen.add(s.week);
    for (const e of s.exercises) {
      for (const set of e.sets) {
        if (set.done && set.kind !== "warmup" && set.rir != null) rirSets += 1;
      }
    }
  }

  const targetPerWeek = Math.max(1, settings.trainingDays.length);
  const maxInAWeek = Math.max(0, ...byWeek.values());

  const prMap = prsBySession(done);
  let totalPrs = 0;
  for (const list of prMap.values()) totalPrs += list.length;

  const hasDeloadOr6Weeks = weeksSeen.has(7) || weeksSeen.size >= 6;

  function item(id: string, code: string, title: string, detail: string, current: number, target: number, unit = ""): Achievement {
    const unlocked = current >= target;
    const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
    const progress = `${Math.min(current, target)}${unit} / ${target}${unit}`;
    return { id, code, title, detail, unlocked, progress, pct };
  }

  return [
    item("first-protocol", "MOD-01", "Primeiro Protocolo", "Concluir o 1º treino no sistema.", totalSessions, 1),
    item("consistency-10", "MOD-02", "Cadência Operacional", "Concluir 10 treinos registrados.", totalSessions, 10),
    item("veteran-30", "MOD-03", "Chassi Veterano", "Concluir 30 treinos registrados.", totalSessions, 30),
    item(
      "full-week",
      "MOD-04",
      "Semana Blindada",
      `Cumprir os ${targetPerWeek} treinos planejados na mesma semana.`,
      maxInAWeek,
      targetPerWeek,
    ),
    item(
      "meso-cycle",
      "MOD-05",
      "Ciclo Completo",
      "Atravessar 6 semanas do mesociclo ou concluir a semana de Deload.",
      hasDeloadOr6Weeks ? 6 : weeksSeen.size,
      6,
      " sem",
    ),
    item("pr-hunter", "MOD-06", "Caçador de Recordes", "Bater 10 recordes pessoais (carga, 1RM ou reps).", totalPrs, 10),
    item("tonnage-50t", "MOD-07", "50 Toneladas", "Acumular 50.000 kg de carga total movida.", Math.floor(totalVolumeKg / 1000), 50, " t"),
    item("precision-rir", "MOD-08", "Calibragem Neural", "Marcar quantas reps sobraram (RIR) em 30 séries de trabalho.", rirSets, 30),
    item("body-tracker", "MOD-09", "Biometria Ativa", "Registrar 3 medições de peso ou medidas corporais.", bodyLog.length, 3),
    item("cardio-engine", "MOD-10", "Motor Aeróbico", "Acumular 120 minutos de cardio pós-treino.", cardioMinutes, 120, " min"),
  ];
}
