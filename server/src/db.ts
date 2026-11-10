// Subconjunto da API do Cloudflare D1 que o servidor usa. Em produção é o D1 de verdade; no servidor local e nos
// testes, um adaptador sobre node:sqlite (sqlite-node.ts) com o mesmo formato.

export interface DbStatement {
  bind(...values: unknown[]): DbStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface Db {
  prepare(sql: string): DbStatement;
  batch(statements: DbStatement[]): Promise<unknown[]>;
}

export interface Env {
  DB: Db;
  /** Origens permitidas (CORS), separadas por vírgula. Vazio = qualquer origem (o login é por token, não cookie). */
  ALLOWED_ORIGINS?: string;
  /** Senha do dono para ler erros e denúncias (`/admin/*`). Sem ela, essas rotas ficam fechadas. */
  ADMIN_TOKEN?: string;
}
