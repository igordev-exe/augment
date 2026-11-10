-- AUGMENT online: contas, amigos, recordes comparáveis, atividade e backups na nuvem.
-- Banco SQLite (Cloudflare D1 em produção; node:sqlite no servidor local e nos testes).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  -- Entra (anônimo) na comparação "você levanta mais que X% dos usuários".
  share_percentiles INTEGER NOT NULL DEFAULT 1,
  -- Amigos veem seus treinos (resumo) e recordes.
  share_activity INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Login: guardamos só o hash do token (quem ler o banco não consegue entrar na conta).
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens(user_id);

-- Amizade: um registro por par, com a < b (ordem alfabética dos ids).
CREATE TABLE IF NOT EXISTS friendships (
  a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS friendships_b ON friendships(b);

-- Melhor marca por exercício da biblioteca (id `lib`), sempre em kg.
CREATE TABLE IF NOT EXISTS records (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lib TEXT NOT NULL,
  e1rm_kg REAL NOT NULL,
  load_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  date TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, lib)
);
CREATE INDEX IF NOT EXISTS records_lib ON records(lib, e1rm_kg);

-- Resumo de cada treino concluído (o feed dos amigos). O id é o id local da sessão.
CREATE TABLE IF NOT EXISTS activity (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  sets INTEGER NOT NULL,
  volume_kg REAL NOT NULL,
  minutes INTEGER NOT NULL,
  prs INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS activity_user_date ON activity(user_id, date);

-- Backup automático: o JSON do app em pedaços (o D1 limita cada linha a ~2 MB).
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  size INTEGER NOT NULL,
  hash TEXT NOT NULL,
  sessions INTEGER NOT NULL,
  chunks INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS backups_user ON backups(user_id, created_at);

CREATE TABLE IF NOT EXISTS backup_chunks (
  backup_id TEXT NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (backup_id, idx)
);

-- Limite de tentativas (cadastro por IP, login por usuário).
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
