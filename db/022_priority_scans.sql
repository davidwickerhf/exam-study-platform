-- Per-student, source-grounded obligation scans. The scan is a derived view of
-- private Canvas evidence: it stores structured claims and chunk references,
-- never a second copy of the source document.

CREATE TABLE IF NOT EXISTS canvas_priority_scans (
  id TEXT PRIMARY KEY,
  binding_id TEXT NOT NULL REFERENCES canvas_course_bindings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'needs-review', 'not-found')),
  course_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (binding_id, user_id, evidence_hash)
);

CREATE INDEX IF NOT EXISTS canvas_priority_scans_latest_idx
  ON canvas_priority_scans (user_id, binding_id, scanned_at DESC);

-- A binding is shared by everyone enrolled in the same Canvas course, while
-- its imported snapshots and derived obligations are private per student.
-- Therefore active refresh jobs must be unique per student + binding too.
DROP INDEX IF EXISTS canvas_sync_jobs_one_course_idx;
CREATE UNIQUE INDEX canvas_sync_jobs_one_course_idx
  ON canvas_sync_jobs (user_id, binding_id)
  WHERE job_type = 'course' AND status IN ('pending', 'running');
