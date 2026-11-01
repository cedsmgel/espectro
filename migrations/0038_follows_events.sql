-- Migração 0038: seguidores, eventos de leitura (base do algoritmo) e preferência de personalização

-- Seguir é de mão única (diferente da amizade, que é mútua)
CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- O que cada pessoa viu e fez com as publicações: impression (apareceu na tela), open (abriu), dwell (tempo em ms).
-- Guardado por 90 dias e só para quem não desligou a personalização.
CREATE TABLE IF NOT EXISTS post_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  value INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_post_events_user ON post_events(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_post_events_post ON post_events(post_id, type);

-- 1 = o Espectro pode usar a atividade da pessoa para ordenar o feed
ALTER TABLE users ADD COLUMN personalization INTEGER NOT NULL DEFAULT 1;
