-- Migração 0031: sessões por aparelho, com localização aproximada do acesso

-- Uma linha por login. O IP completo fica guardado por até 6 meses (Marco Civil, art. 15);
-- a tela mostra só a localização aproximada e o IP parcialmente oculto.
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ip TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  asn INTEGER,
  as_org TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created ON user_sessions(created_at);
