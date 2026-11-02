-- Migração 0042: preferências de cada membro na lista de conversas (fixar e arquivar o grupo)

ALTER TABLE chat_group_members ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_group_members ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
