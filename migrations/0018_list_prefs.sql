-- Migração 0018: conversas fixadas e marcadas como não lidas

ALTER TABLE conversation_settings ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversation_settings ADD COLUMN manual_unread INTEGER NOT NULL DEFAULT 0;
