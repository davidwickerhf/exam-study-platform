-- A durable queue also needs expiring ownership: process restarts must not
-- strand running rows forever, nor let a late process complete a newer retry.
ALTER TABLE canvas_sync_jobs ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE canvas_sync_jobs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS canvas_sync_jobs_heartbeat_idx ON canvas_sync_jobs (heartbeat_at) WHERE status='running';
