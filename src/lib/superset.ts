// Para onde vai o foco e quanto descansar depois de marcar uma série, inclusive em superset.
// Superset: A1 → A2 sem descanso, A2 → A1 com 60 s. Quando um dos dois tem mais séries que o outro (ajuste do fim do
// mesociclo, série removida, programa montado pela pessoa), o que sobrou segue como exercício normal: antes, marcar o
// A1 não iniciava descanso nenhum e jogava o foco para o A2 já completo.

export type RestKind = "none" | "warmup" | "superset" | "normal";
export type Focus = "self" | "partner" | "next";

export interface SetStep {
  rest: RestKind;
  focus: Focus;
}

export function afterSet({
  warmup,
  order,
  partnerPending,
  remaining,
}: {
  warmup: boolean;
  /** Posição no superset (1 = A1, 2 = A2) ou undefined fora de superset. */
  order?: 1 | 2;
  /** O parceiro do superset ainda tem série de trabalho por fazer. */
  partnerPending: boolean;
  /** Séries de trabalho que faltam neste exercício (depois desta). */
  remaining: number;
}): SetStep {
  if (warmup) return { rest: "warmup", focus: "self" };
  if (order && partnerPending) return order === 1 ? { rest: "none", focus: "partner" } : { rest: "superset", focus: "partner" };
  return { rest: "normal", focus: remaining > 0 ? "self" : "next" };
}
