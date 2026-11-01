-- Migração 0041: índices para a limpeza horária de mensagens temporárias vencidas

CREATE INDEX IF NOT EXISTS idx_direct_messages_expires ON direct_messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_group_messages_expires ON chat_group_messages(expires_at) WHERE expires_at IS NOT NULL;
