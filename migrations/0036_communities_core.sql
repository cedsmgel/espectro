-- Migração 0036: comunidades completas (tipos, papéis, regras, hashtags da comunidade, fixados, registro de moderação)

-- Tipo: public (qualquer um lê e posta), restricted (qualquer um lê; só aprovados e moderação postam),
-- private (só membros aprovados leem; entrar exige aprovação)
ALTER TABLE communities ADD COLUMN type TEXT NOT NULL DEFAULT 'public';
ALTER TABLE communities ADD COLUMN welcome_message TEXT;
-- Exigir pelo menos uma hashtag nas publicações (no lugar dos "flairs" do Reddit)
ALTER TABLE communities ADD COLUMN require_tag INTEGER NOT NULL DEFAULT 0;

-- Papel e situação de cada pessoa na comunidade
ALTER TABLE community_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'; -- owner | moderator | member
ALTER TABLE community_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active'; -- active | pending | banned
ALTER TABLE community_members ADD COLUMN banned_until DATETIME;
ALTER TABLE community_members ADD COLUMN ban_reason TEXT;
ALTER TABLE community_members ADD COLUMN approved_poster INTEGER NOT NULL DEFAULT 0;

-- Quem criou a comunidade é "owner"; garante a linha de membro para o dono
INSERT OR IGNORE INTO community_members (user_id, community_id) SELECT owner_id, id FROM communities;
UPDATE community_members SET role = 'owner'
  WHERE EXISTS (SELECT 1 FROM communities c WHERE c.id = community_members.community_id AND c.owner_id = community_members.user_id);

-- Regras da comunidade (até 15, na ordem)
CREATE TABLE IF NOT EXISTS community_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_rules ON community_rules(community_id, position);

-- Hashtags da comunidade (até 8): aparecem como assuntos e filtros, no lugar dos flairs
CREATE TABLE IF NOT EXISTS community_tags (
  community_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (community_id, tag),
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);

-- Publicações fixadas no topo (até 2)
CREATE TABLE IF NOT EXISTS community_pins (
  community_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (community_id, post_id),
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Registro das ações de moderação da comunidade
CREATE TABLE IF NOT EXISTS community_mod_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL,
  moderator_id INTEGER,
  action TEXT NOT NULL,
  target_user_id INTEGER,
  target_post_id INTEGER,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_mod_log ON community_mod_log(community_id, id DESC);
