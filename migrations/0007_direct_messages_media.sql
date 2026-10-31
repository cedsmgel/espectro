-- Migração 0007: Adicionar suporte a mídias, arquivos, localização e gifs em mensagens diretas
ALTER TABLE direct_messages ADD COLUMN message_type TEXT DEFAULT 'text';
ALTER TABLE direct_messages ADD COLUMN media_url TEXT;
