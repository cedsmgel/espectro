-- Migração 0012: preferências por conversa (silenciar, tema, papel de parede, apelido, limpar para mim)

CREATE TABLE IF NOT EXISTS conversation_settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'default',
  wallpaper TEXT NOT NULL DEFAULT 'none',
  nickname TEXT,
  cleared_before_id INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id)
);
