// Banco no formato do D1 sobre o SQLite embutido do Node (node:sqlite, Node 22.5+).
// Usado no servidor local (node.ts), em hospedagem própria (VPS) e nos testes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import type { Db, DbStatement } from "./db";

interface SyncStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint };
}
interface SyncDatabase {
  exec(sql: string): void;
  prepare(sql: string): SyncStatement;
}

// createRequire: o empacotador dos testes não conhece "node:sqlite" (módulo recente do Node).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => SyncDatabase };

class Stmt implements DbStatement {
  constructor(
    private db: SyncDatabase,
    private sql: string,
    private params: unknown[] = [],
  ) {}
  bind(...values: unknown[]): DbStatement {
    return new Stmt(
      this.db,
      this.sql,
      values.map((v) => (typeof v === "boolean" ? Number(v) : v === undefined ? null : v)),
    );
  }
  runSync(): { changes: number } {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { changes: Number(r.changes) };
  }
  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params);
    return row ? ({ ...(row as object) } as T) : null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return {
      results: this.db
        .prepare(this.sql)
        .all(...this.params)
        .map((r) => ({ ...(r as object) }) as T),
    };
  }
  async run(): Promise<{ meta: { changes: number } }> {
    return { meta: this.runSync() };
  }
}

/** `migrations`: a pasta (roda todos os .sql em ordem; todos são "IF NOT EXISTS") ou um arquivo só. */
export function openSqlite(path: string, migrations: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const files = statSync(migrations).isDirectory()
    ? readdirSync(migrations)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => join(migrations, f))
    : [migrations];
  for (const f of files) db.exec(readFileSync(f, "utf8"));
  return {
    prepare: (sql) => new Stmt(db, sql),
    async batch(statements) {
      // Igual ao D1: tudo ou nada.
      db.exec("BEGIN");
      try {
        const out = statements.map((s) => ({ meta: (s as Stmt).runSync() }));
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  };
}
