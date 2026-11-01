-- Migração 0029: publicações salvas (privadas, só a própria pessoa vê)

CREATE TABLE IF NOT EXISTS saved_posts (
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id, created_at);
