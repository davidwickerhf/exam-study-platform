-- Queue messages are disposable notifications. These rows are the durable
-- inventory and checkpoints, retained even after delivery retention expires.
CREATE TABLE IF NOT EXISTS canvas_sync_checkpoints (
  job_id TEXT NOT NULL REFERENCES canvas_sync_jobs(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  PRIMARY KEY (job_id, key)
);
CREATE TABLE IF NOT EXISTS canvas_sync_resources (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES canvas_sync_jobs(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  payload JSONB NOT NULL,
  stage TEXT NOT NULL DEFAULT 'download' CHECK (stage IN ('download','extract','index','complete','failed')),
  asset_id TEXT REFERENCES editorial_source_assets(id) ON DELETE SET NULL,
  downloaded_bytes BIGINT NOT NULL DEFAULT 0,
  total_bytes BIGINT,
  etag TEXT,
  index_offset INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, source_path)
);
CREATE TABLE IF NOT EXISTS canvas_sync_resource_bytes (
  resource_id TEXT NOT NULL REFERENCES canvas_sync_resources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  data BYTEA NOT NULL,
  PRIMARY KEY(resource_id, chunk_index)
);
CREATE TABLE IF NOT EXISTS canvas_sync_index_staging (
  resource_id TEXT NOT NULL REFERENCES canvas_sync_resources(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  embedding_model TEXT,
  PRIMARY KEY(resource_id, ordinal)
);
ALTER TABLE canvas_sync_jobs ADD COLUMN IF NOT EXISTS queue_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS canvas_sync_resources_pending ON canvas_sync_resources(job_id, stage, source_path);
