-- Versioned academic-record snapshots.
--
-- Deliberately no document column. Wicker Study reads an uploaded transcript or
-- Academic Work overview and keeps only what it derived — the course rows and
-- the totals — because the original carries a student's full grade history and
-- the product's stated position is that uploads are read, not retained.
-- Progress over time is a diff between two of these rows.
CREATE TABLE IF NOT EXISTS academic_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  source_label TEXT,
  printed_on TEXT,
  content_hash TEXT NOT NULL,
  summary JSONB NOT NULL,
  courses JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_snapshots_user_created_idx
  ON academic_snapshots (user_id, created_at DESC);

-- Re-uploading the identical document is not new progress.
CREATE UNIQUE INDEX IF NOT EXISTS academic_snapshots_user_hash_idx
  ON academic_snapshots (user_id, content_hash);
