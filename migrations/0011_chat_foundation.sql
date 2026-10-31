-- Migração 0011: D1 passa a ser a fonte única das mensagens diretas
-- (idempotência de envio, status de entrega e índices para conversas e paginação)

ALTER TABLE direct_messages ADD COLUMN client_id TEXT;
ALTER TABLE direct_messages ADD COLUMN delivered_at DATETIME;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_client_id ON direct_messages(sender_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_pair_id ON direct_messages(sender_id, receiver_id, id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver_pair_id ON direct_messages(receiver_id, sender_id, id);
