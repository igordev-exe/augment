-- Sincronização treino a treino entre aparelhos da mesma conta. Cada treino concluído é uma linha; `rev` cresce a
-- cada gravação da pessoa, e cada aparelho pede "o que mudou depois da rev N". Apagar vira uma lápide (`deleted`).

CREATE TABLE IF NOT EXISTS workouts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  rev INTEGER NOT NULL,
  hash TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS workouts_rev ON workouts(user_id, rev);
