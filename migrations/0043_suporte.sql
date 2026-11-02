-- Migração 0043: mensagens enviadas pelo formulário de suporte (inclui encarregado de dados e direitos autorais)

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_email TEXT,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_support_status ON support_messages(status, id);
