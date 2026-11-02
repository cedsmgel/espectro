-- Migracao 0044: registro do aceite dos termos e da declaracao de idade minima (13 anos) no cadastro

ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME;
