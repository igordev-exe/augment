-- Perfil opcional para a comparação mais justa (sexo e peso corporal; nunca aparecem para outras pessoas),
-- bloqueios entre usuários e denúncias para o dono do servidor ler em /admin/reports.

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  sex TEXT NOT NULL DEFAULT '',
  bw_kg REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker TEXT NOT NULL,
  blocked TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker, blocked)
);
CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks(blocked);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter TEXT NOT NULL,
  target TEXT NOT NULL,
  target_username TEXT NOT NULL,
  target_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_created ON reports(created_at);
