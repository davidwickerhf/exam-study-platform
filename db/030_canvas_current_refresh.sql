-- Account-specific: a historical edition stays accessible without being polled.
ALTER TABLE canvas_corpus_access ADD COLUMN IF NOT EXISTS auto_refresh BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS canvas_corpus_access_refresh_idx ON canvas_corpus_access(user_id, binding_id) WHERE auto_refresh=true AND sync_paused=false;
