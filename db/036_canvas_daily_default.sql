-- Existing explicit refresh preferences remain unchanged.
ALTER TABLE canvas_corpus_permissions ALTER COLUMN refresh_materials_minutes SET DEFAULT 1440;
