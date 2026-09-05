CREATE TABLE IF NOT EXISTS canvas_sync_events (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES canvas_sync_jobs(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  item TEXT,
  completed INTEGER,
  total INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS canvas_sync_events_job_idx ON canvas_sync_events (job_id, id DESC);

-- Capture every queue transition, including stop/retry and lease recovery, in
-- the same transaction as the job. Heartbeats never flood the event stream.
CREATE OR REPLACE FUNCTION record_canvas_sync_transition() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO canvas_sync_events (job_id, attempt, stage, level, message)
    VALUES (NEW.id, NEW.attempts, 'queue',
      CASE WHEN NEW.status = 'failed' THEN 'error' WHEN NEW.status = 'pending' AND NEW.attempts > 0 THEN 'warning' ELSE 'info' END,
      CASE NEW.status
        WHEN 'pending' THEN CASE WHEN NEW.attempts > 0 THEN 'Attempt interrupted. Retry queued.' ELSE 'Sync queued.' END
        WHEN 'running' THEN 'Worker started this attempt.'
        WHEN 'completed' THEN 'Sync finished. Check stage events for warnings or skipped material.'
        WHEN 'cancelled' THEN 'Sync stopped or superseded. Stored material remains available.'
        WHEN 'failed' THEN 'Sync failed after its retry limit. Open Canvas sync for the error and retry controls.'
      END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS canvas_sync_transition ON canvas_sync_jobs;
CREATE TRIGGER canvas_sync_transition AFTER INSERT OR UPDATE OF status ON canvas_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION record_canvas_sync_transition();
