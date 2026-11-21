CREATE TABLE IF NOT EXISTS shared_course_question_sets (
  course_code TEXT PRIMARY KEY,
  draft JSONB NOT NULL DEFAULT '[]'::jsonb,
  published JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  generated_by TEXT,
  published_by TEXT
);
