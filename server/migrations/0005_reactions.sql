-- Reações com emoji nos treinos do feed: uma por pessoa por treino (trocar de emoji substitui; tocar de novo tira).
-- Só amigos (ou o dono) reagem; apagar a conta ou bloquear alguém apaga as reações entre os dois.

CREATE TABLE IF NOT EXISTS reactions (
  owner_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  reactor_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, activity_id, reactor_id)
);
CREATE INDEX IF NOT EXISTS reactions_reactor ON reactions(reactor_id);
