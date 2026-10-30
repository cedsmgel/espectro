-- Migração 0002: Atualização do esquema para suporte a slugs de comunidade, mídias/votos/tipos de posts e comentários em thread

-- 1. Comunidades: Adicionar coluna slug para URLs amigáveis (/e/nome-da-comunidade)
ALTER TABLE communities ADD COLUMN slug TEXT;

-- Atualizar slugs para comunidades existentes com base no nome
UPDATE communities SET slug = lower(replace(replace(name, ' ', '-'), '.', '')) WHERE slug IS NULL;

-- Criar índice para busca rápida por slug
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);

-- 2. Posts: Adicionar title, media_url, media_type, upvotes, downvotes e post_type
ALTER TABLE posts ADD COLUMN title TEXT;
ALTER TABLE posts ADD COLUMN media_url TEXT;
ALTER TABLE posts ADD COLUMN media_type TEXT;
ALTER TABLE posts ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN downvotes INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN post_type TEXT DEFAULT 'scrap';

-- 3. Comentários: Nova tabela com suporte a threads / respostas aninhadas (parent_id)
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
