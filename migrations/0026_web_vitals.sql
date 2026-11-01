-- Migração 0026: medição de desempenho real (Core Web Vitals), sem identificar a pessoa

CREATE TABLE IF NOT EXISTS web_vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  rating TEXT NOT NULL,
  path TEXT NOT NULL,
  device TEXT NOT NULL,
  connection TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_created ON web_vitals(created_at);
