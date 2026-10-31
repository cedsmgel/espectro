-- Migração 0009: colunas que existiam apenas no banco de produção (criadas por ALTER em tempo de requisição).
-- Em produção estas colunas já existem: esta migração foi registrada como aplicada sem executar.

ALTER TABLE communities ADD COLUMN icon_color TEXT DEFAULT '#712ae2';
ALTER TABLE direct_messages ADD COLUMN reply_to_id INTEGER;
