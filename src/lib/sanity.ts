import type { SetEntry, Unit } from "../data/types";
import { toKg } from "./progression";

// Trava contra erro de digitação: 800 no lugar de 80 virava "Carga máxima: 800 kg" e ficava no recorde. A série é
// marcada mesmo assim (pode ser verdade), mas o app avisa com o botão "Corrigir".

/** Carga acima disso × a maior já registrada no exercício parece erro de digitação. */
export const TYPO_LOAD_FACTOR = 1.5;
/** Só desconfia da carga quando o histórico já tem pelo menos isso (kg): em cargas baixas, 1,5× é normal. */
export const TYPO_MIN_HISTORY_KG = 20;
/** Reps acima disso numa série de musculação parecem erro de digitação. */
export const TYPO_MAX_REPS = 50;

/**
 * Motivo para desconfiar da série recém-marcada, ou null. `historyMaxKg` é a maior carga de trabalho já registrada no
 * exercício antes desta série (undefined na primeira vez: aí não há com o que comparar).
 */
export function suspiciousSet(set: Pick<SetEntry, "weight" | "reps">, unit: Unit, historyMaxKg: number | undefined): string | null {
  if (set.reps != null && set.reps > TYPO_MAX_REPS) return `${set.reps} reps numa série.`;
  if (set.weight == null || historyMaxKg == null || historyMaxKg < TYPO_MIN_HISTORY_KG) return null;
  const kg = toKg(set.weight, unit);
  if (kg > historyMaxKg * TYPO_LOAD_FACTOR) {
    return `${set.weight} ${unit} é bem mais que o seu máximo aqui (${Math.round(historyMaxKg)} kg).`;
  }
  return null;
}
