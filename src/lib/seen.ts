// Telas já vistas nesta abertura do app (regra F7 de docs/prompt-fluidez.md). A 1ª visita a uma tela tem a entrada
// curta em cascata; voltar a ela (trocar de aba e voltar) mostra o conteúdo direto, sem esperar animação. Só em
// memória: fechar e abrir o app de novo começa do zero.

const seen = new Set<string>();
let current = false;

/** Chamado pelo Shell ao renderizar a rota: diz se a tela já foi vista e guarda a resposta para os filhos. */
export function enterRoute(pathname: string): boolean {
  current = seen.has(pathname);
  return current;
}

/** Marca a tela como vista (depois de pintar). */
export function markRouteSeen(pathname: string): void {
  seen.add(pathname);
}

/** A tela atual já tinha sido vista? (Ticker e barras de leitura mostram o valor final direto.) */
export function routeSeen(): boolean {
  return current;
}
