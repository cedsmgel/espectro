-- Migração 0037: aparência da comunidade (ícone e banner em imagem; a cor continua em icon_color)
ALTER TABLE communities ADD COLUMN icon_url TEXT;
ALTER TABLE communities ADD COLUMN banner_url TEXT;
