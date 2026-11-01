-- Migração 0033: verificação em duas etapas (app autenticador + códigos de recuperação)

-- O segredo do autenticador fica cifrado (AES-GCM); enabled_at NULL = configuração começada e ainda não confirmada.
-- last_used_step impede reaproveitar o mesmo código de 30 segundos.
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id INTEGER PRIMARY KEY,
  secret_enc TEXT NOT NULL,
  enabled_at DATETIME,
  last_used_step INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Códigos de recuperação de uso único: só o hash fica guardado
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code_hash TEXT NOT NULL,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_user ON mfa_recovery_codes(user_id, code_hash);
