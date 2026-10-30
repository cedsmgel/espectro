-- Migração 0004: Adicionar campos name e bio na tabela users
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
