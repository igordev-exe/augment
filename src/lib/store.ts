import { liveQuery } from "dexie";

// Estoque em memória do que mora no aparelho (regras F1 e F2 de docs/prompt-fluidez.md).
// Cada dado tem UMA célula: uma assinatura liveQuery do Dexie para o app inteiro, ligada no App antes de montar as
// telas. As telas leem a célula de forma síncrona (useSyncExternalStore em hooks.tsx), então o 1º quadro já sai com o
// dado certo e montar uma tela não consulta o banco. O mesmo dado sem mudança devolve o MESMO objeto: assim os useMemo
// das telas não refazem conta à toa e a tela não renderiza duas vezes.
//
// Este arquivo não importa nada do app (só o Dexie): quem conhece o banco (db.ts, restore.ts, online/sync.ts) cria a
// célula aqui e a alimenta. Assim não nasce ciclo de import novo.

export interface Cell<T> {
  /** Valor atual (undefined = ainda não carregou). */
  get(): T | undefined;
  /** Grava um valor novo. Se for igual ao atual, guarda o atual (mesma referência) e não avisa ninguém. */
  set(next: T): T;
  subscribe(cb: () => void): () => void;
  /** Liga a assinatura única ao banco (chamar de novo não cria outra). Resolve com o 1º valor. */
  watch(query: () => Promise<T>): Promise<T | undefined>;
  /** Quantas vezes a consulta ao banco rodou (testes). */
  readonly queries: number;
}

/** Igualdade estrutural barata para dados do banco (só JSON: sem Date, Map ou função). */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Reaproveita o anterior se for igual (padrão). */
function keepIfSame<T>(prev: T, next: T): T {
  return sameData(prev, next) ? prev : next;
}

/**
 * Lista com `id`: reaproveita item por item o objeto anterior quando não mudou. Se nada mudou (os mesmos itens, mesmo
 * que noutra ordem), devolve a lista anterior. Gravar uma série num treino troca só aquele treino; os outros seguem os
 * mesmos. A ordem não conta porque quem grava na hora (um treino novo no fim) e o banco (por id) ordenam diferente, e
 * as telas ordenam do jeito delas.
 */
export function shareById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const old = new Map(prev.map((x) => [x.id, x]));
  let changed = prev.length !== next.length;
  const out = next.map((x) => {
    const o = old.get(x.id);
    if (o && sameData(o, x)) return o;
    changed = true;
    return x;
  });
  return changed ? out : prev;
}

export function cell<T>(share: (prev: T, next: T) => T = keepIfSame): Cell<T> {
  let value: T | undefined;
  let queries = 0;
  let started: Promise<T | undefined> | null = null;
  const subs = new Set<() => void>();
  const c: Cell<T> = {
    get: () => value,
    set(next: T) {
      const kept = value === undefined ? next : share(value, next);
      if (kept === value) return kept;
      value = kept;
      subs.forEach((cb) => cb());
      return kept;
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    watch(query) {
      if (started) return started;
      started = new Promise((resolve) => {
        let first = true;
        liveQuery(() => {
          queries++;
          return query();
        }).subscribe({
          next: (v) => {
            c.set(v);
            if (first) (first = false), resolve(value);
          },
          error: () => {
            if (first) (first = false), resolve(value);
          },
        });
      });
      return started;
    },
    get queries() {
      return queries;
    },
  };
  return c;
}
