-- Migração 0030: exclusão de conta (com prazo de arrependimento), sessões e retorno de quem sai

-- Pedido de exclusão: a conta fica desativada e some do app até a data programada; entrar de novo cancela
ALTER TABLE users ADD COLUMN deletion_requested_at DATETIME;
ALTER TABLE users ADD COLUMN deletion_scheduled_for DATETIME;

-- Tokens emitidos antes deste instante (em segundos) deixam de valer ("sair de todos os dispositivos")
ALTER TABLE users ADD COLUMN sessions_valid_after INTEGER;

-- Questionário de saída: anônimo de propósito, sem ligação com a pessoa
CREATE TABLE IF NOT EXISTS account_deletion_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reasons TEXT NOT NULL,
  details TEXT,
  would_return TEXT,
  account_age_days INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Controle das rotinas de manutenção (ex.: apagar contas vencidas no máximo uma vez por hora)
CREATE TABLE IF NOT EXISTS maintenance_runs (
  name TEXT PRIMARY KEY,
  ran_at DATETIME NOT NULL
);
INSERT OR IGNORE INTO maintenance_runs (name, ran_at) VALUES ('purge_accounts', '2000-01-01 00:00:00');
