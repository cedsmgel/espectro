-- Migração 0005: Adicionar colunas is_private e allow_scraps na tabela users
ALTER TABLE users ADD COLUMN is_private INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN allow_scraps INTEGER DEFAULT 1;
