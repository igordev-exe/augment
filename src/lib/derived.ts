// Contas derivadas do histórico, com cache por identidade (lib/memo.ts). As telas chamam estas no lugar das funções
// puras: trocar de aba (Hoje → Progresso → Relatório) acha o resultado pronto em vez de refazer a conta sobre todos
// os treinos. O boot também as chama uma vez (warmDerived), para a 1ª visita de cada aba custar o mesmo que a 2ª.
// Nunca mutar o que estas funções devolvem: o mesmo objeto vai para várias telas.
import type { BodyEntry, Session, Settings } from "../data/types";
import { computeAchievements } from "./achievements";
import { attributes } from "./attributes";
import { learnedRecoveryMultipliers, operatorState, type OperatorMemory } from "./core/operator";
import { mesoReport, weeklyReport } from "./report";
import { memoByArgs, minuteNow } from "./memo";
import { prsBySession } from "./progression";
import { volumeSlots } from "./slots";
import { activityGrid, dailySets, muscleStatus, relativeStrength } from "./visual";
import { weekFor } from "./mesocycle";

export const operatorStateOf = memoByArgs(operatorState);
export const prsOf = memoByArgs(prsBySession);
export const achievementsOf = memoByArgs(computeAchievements);
export const recoveryOf = memoByArgs(learnedRecoveryMultipliers);
/** `now` arredondado ao minuto (minuteNow) para o cache valer durante o minuto. */
export const muscleStatusOf = memoByArgs(muscleStatus);
export const activityGridOf = memoByArgs(activityGrid);
export const relativeStrengthOf = memoByArgs(relativeStrength);
export const dailySetsOf = memoByArgs(dailySets);
export const volumeSlotsOf = memoByArgs(volumeSlots);
export const attributesOf = memoByArgs((sessions: Session[], bodyLog: BodyEntry[], settings: Settings, today: string) =>
  attributes({ sessions, bodyLog, settings, today }),
);
export const weeklyReportOf = memoByArgs(weeklyReport);
export const mesoReportOf = memoByArgs(mesoReport);

/**
 * Faz uma vez as contas que as abas pedem ao abrir (Hoje, Progresso), com os mesmos argumentos que elas passam.
 * Chamado no boot e em tempo ocioso: quando a pessoa toca na aba, o resultado já está guardado.
 */
export function warmDerived(sessions: Session[], bodyLog: BodyEntry[], settings: Settings, memory: OperatorMemory, today: string): void {
  const op = operatorStateOf(sessions, bodyLog, settings, memory, today);
  const week = weekFor(settings.mesoStart, today);
  muscleStatusOf(sessions, week, today, minuteNow(), settings.setAdjust, recoveryOf(op));
  prsOf(sessions);
  achievementsOf(sessions, settings, bodyLog);
  activityGridOf(sessions, today, settings.trainingDays.length, 53, memory.absences);
  relativeStrengthOf(sessions, bodyLog);
  dailySetsOf(sessions, today);
  volumeSlotsOf(sessions, today, week, settings.setAdjust);
  attributesOf(sessions, bodyLog, settings, today);
}
