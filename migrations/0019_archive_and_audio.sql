-- Migração 0019: conversas arquivadas por usuário

ALTER TABLE conversation_settings ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
