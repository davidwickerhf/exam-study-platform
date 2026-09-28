-- Releasing an original exam file is a separate decision from consenting to
-- community processing and accepting a contribution for editorial use.
CREATE TABLE IF NOT EXISTS shared_exam_paper_reviews (
  snapshot_id TEXT PRIMARY KEY REFERENCES canvas_source_snapshots(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('approved', 'withheld')),
  reviewed_by TEXT NOT NULL,
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_exam_paper_reviews_approved_idx
  ON shared_exam_paper_reviews (snapshot_id) WHERE status = 'approved';
