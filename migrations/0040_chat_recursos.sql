-- Migração 0040: mensagens temporárias, foto de visualização única, favoritas, reações em grupo, convite e permissões do grupo

ALTER TABLE direct_messages ADD COLUMN expires_at DATETIME;
ALTER TABLE direct_messages ADD COLUMN view_once INTEGER NOT NULL DEFAULT 0;

ALTER TABLE chat_group_messages ADD COLUMN expires_at DATETIME;
ALTER TABLE chat_group_messages ADD COLUMN view_once INTEGER NOT NULL DEFAULT 0;

ALTER TABLE chat_groups ADD COLUMN disappear_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_groups ADD COLUMN invite_code TEXT;
ALTER TABLE chat_groups ADD COLUMN members_can_edit_info INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_groups ADD COLUMN members_can_add INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_groups ADD COLUMN members_can_invite INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_groups_invite ON chat_groups(invite_code) WHERE invite_code IS NOT NULL;

-- Prazo das mensagens temporárias de uma conversa privada (valor único para os dois lados, par ordenado)
CREATE TABLE IF NOT EXISTS dm_disappearing (
  user_lo INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_hi INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_lo, user_hi)
);

-- Quem já abriu uma foto/vídeo de visualização única (kind: 'dm' ou 'group')
CREATE TABLE IF NOT EXISTS view_once_views (
  kind TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, message_id, user_id)
);

CREATE TABLE IF NOT EXISTS starred_messages (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, kind, message_id)
);

CREATE TABLE IF NOT EXISTS group_message_reactions (
  message_id INTEGER NOT NULL REFERENCES chat_group_messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_reactions_message ON group_message_reactions(message_id);
