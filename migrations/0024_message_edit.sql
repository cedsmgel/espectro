-- Migração 0024: edição de mensagens (conversas privadas e grupos)

ALTER TABLE direct_messages ADD COLUMN edited_at DATETIME;
ALTER TABLE chat_group_messages ADD COLUMN edited_at DATETIME;
