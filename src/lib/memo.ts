// Contas pesadas uma vez só (regra F8 de docs/prompt-fluidez.md). Embrulho de cache para funções puras: guarda os
// últimos resultados pela IDENTIDADE dos argumentos. Funciona porque o estoque (lib/store.ts) devolve o mesmo objeto
// enquanto o dado não muda: Hoje, Progresso e Relatório pedem a mesma conta com os mesmos objetos e acham o resultado
// pronto ao trocar de aba. A função continua pura; o cache fica só aqui.
// Muitas contas leem o programa ativo do registro em memória (exById, programDays): a versão do programa entra na
// chave, então editar ou trocar de programa invalida o cache.
import { programVersion } from "../data/program";

export function memoByArgs<A extends unknown[], R>(fn: (...args: A) => R, size = 3): (...args: A) => R {
  const entries: { args: A; v: number; result: R }[] = [];
  return (...args: A): R => {
    const v = programVersion();
    const hit = entries.find((e) => e.v === v && e.args.length === args.length && e.args.every((a, i) => Object.is(a, args[i])));
    if (hit) return hit.result;
    const result = fn(...args);
    entries.unshift({ args, v, result });
    if (entries.length > size) entries.length = size;
    return result;
  };
}

/** Relógio arredondado ao minuto: contas que pedem "agora" acham o cache durante o mesmo minuto. */
export function minuteNow(now = Date.now()): number {
  return now - (now % 60_000);
}
