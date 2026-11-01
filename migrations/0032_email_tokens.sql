-- Migração 0032: confirmação de e-mail e recuperação de senha

ALTER TABLE users ADD COLUMN email_verified_at DATETIME;

-- Só o hash SHA-256 do token fica guardado: quem ler o banco não consegue usar os links
CREATE TABLE IF NOT EXISTS email_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL, -- verify_email | reset_password
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, purpose);
