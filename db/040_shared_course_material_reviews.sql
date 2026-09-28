CREATE TABLE IF NOT EXISTS shared_course_material_reviews (
  snapshot_id TEXT PRIMARY KEY REFERENCES canvas_source_snapshots(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('approved', 'withheld')),
  category TEXT CHECK (category IN ('paper', 'solutions', 'material')),
  reviewed_by TEXT NOT NULL,
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_course_material_reviews_approved_idx
  ON shared_course_material_reviews (snapshot_id) WHERE status = 'approved';

INSERT INTO shared_course_material_reviews (snapshot_id, status, category, reviewed_by, review_note, reviewed_at)
SELECT old.snapshot_id, old.status, old.kind,
  old.reviewed_by, old.review_note, old.reviewed_at
FROM shared_exam_paper_reviews old
ON CONFLICT (snapshot_id) DO NOTHING;
