-- Migração 0021: mensagens de grupo com GIF e figurinha

ALTER TABLE chat_group_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE chat_group_messages ADD COLUMN media_url TEXT;
