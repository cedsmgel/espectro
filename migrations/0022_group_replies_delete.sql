-- Migração 0022: respostas e apagar mensagens de grupo

ALTER TABLE chat_group_messages ADD COLUMN reply_to_id INTEGER;
ALTER TABLE chat_group_messages ADD COLUMN deleted_at DATETIME;
