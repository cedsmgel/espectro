-- Migração 0023: moderação (admin, suspensão de contas e resolução de denúncias)

ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN suspended_at DATETIME;
ALTER TABLE users ADD COLUMN suspended_reason TEXT;

-- Denúncias também podem apontar para uma publicação ou um comentário
ALTER TABLE reports ADD COLUMN post_id INTEGER;
ALTER TABLE reports ADD COLUMN comment_id INTEGER;
ALTER TABLE reports ADD COLUMN resolution TEXT;
ALTER TABLE reports ADD COLUMN resolution_note TEXT;
ALTER TABLE reports ADD COLUMN resolved_by INTEGER;
ALTER TABLE reports ADD COLUMN resolved_at DATETIME;

-- Registro das ações de moderação, para auditoria
CREATE TABLE IF NOT EXISTS moderation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_user_id INTEGER,
  target_type TEXT,
  target_id INTEGER,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log(created_at);
