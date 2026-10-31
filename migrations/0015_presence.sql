-- Migração 0015: presença (visto por último) com opção de privacidade

ALTER TABLE users ADD COLUMN last_seen_at DATETIME;
ALTER TABLE users ADD COLUMN show_last_seen INTEGER NOT NULL DEFAULT 1;
