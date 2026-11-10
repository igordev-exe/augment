-- Registro de erros do app (tela que quebrou). Sem dados pessoais: só a mensagem, o trecho da pilha, a rota e a
-- versão. Erros iguais somam em `count`.

CREATE TABLE IF NOT EXISTS error_reports (
  fingerprint TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT NOT NULL,
  route TEXT NOT NULL,
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS error_reports_last ON error_reports(last_at);
