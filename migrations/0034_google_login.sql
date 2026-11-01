-- Migração 0034: entrar com o Google (OpenID Connect)

-- Quais contas do Google estão ligadas a quais contas do Espectro (o "sub" do Google nunca muda, o e-mail pode mudar)
CREATE TABLE IF NOT EXISTS oauth_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, subject),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON oauth_identities(user_id);

-- Estado de cada tentativa (anti-CSRF) com o verificador PKCE e o nonce; uso único, 10 minutos
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  mode TEXT NOT NULL, -- login | link
  user_id INTEGER,
  expires_at DATETIME NOT NULL
);

-- Código de troca de uso único (60 s): o navegador troca por uma sessão sem nunca ter o token na URL
CREATE TABLE IF NOT EXISTS oauth_exchange (
  code_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME
);

-- Contas criadas pelo Google nascem sem senha própria; a pessoa pode definir uma depois
ALTER TABLE users ADD COLUMN has_password INTEGER NOT NULL DEFAULT 1;
