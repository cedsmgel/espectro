-- Migração 0028: informações do perfil com privacidade por campo e capa

ALTER TABLE users ADD COLUMN cover_url TEXT;

-- Um campo por linha: novos campos não exigem nova migração.
-- Tudo nasce privado ("private"); a pessoa escolhe public, friends ou private em cada campo.
CREATE TABLE IF NOT EXISTS user_profile_details (
  user_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, field),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
