-- Migração 0006: Adicionar coluna music na tabela users para música do perfil
ALTER TABLE users ADD COLUMN music TEXT;
