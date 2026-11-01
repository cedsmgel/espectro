-- Migração 0039: melhores amigos (lista privada, como no Instagram) e o público de cada Momentum

-- Quem eu escolhi como "melhor amigo". Só amigos aceitos podem entrar; a outra pessoa não é avisada.
CREATE TABLE IF NOT EXISTS close_friends (
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_close_friends_friend ON close_friends(friend_id);

-- friends = todos os amigos; close_friends = só a lista de melhores amigos do autor
ALTER TABLE moments ADD COLUMN audience TEXT NOT NULL DEFAULT 'friends';
