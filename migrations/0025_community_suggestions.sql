-- Migração 0025: comunidades recomendadas que a pessoa dispensou

CREATE TABLE IF NOT EXISTS dismissed_community_suggestions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, community_id)
);
