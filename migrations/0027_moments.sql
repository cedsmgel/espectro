-- Migração 0027: Momentum (conteúdo de 24 horas visível para amigos)

CREATE TABLE IF NOT EXISTS moments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'text', -- image | video | text
  text TEXT,
  bg TEXT,
  overlay TEXT, -- ferramentas de edição (texto, desenho, adesivos, filtro, recorte) em JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_moments_user ON moments(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_moments_expires ON moments(expires_at);

CREATE TABLE IF NOT EXISTS moment_views (
  moment_id INTEGER NOT NULL,
  viewer_id INTEGER NOT NULL,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (moment_id, viewer_id),
  FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
);
