CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('answer', 'review', 'mock', 'resolve', 'read')),
  course_id TEXT,
  chapter_id TEXT,
  score NUMERIC(4, 1) CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_user_created_idx
  ON activity_events (user_id, created_at DESC);

INSERT INTO activity_events (id, user_id, type, course_id, chapter_id, score, label, created_at)
SELECT gen_random_uuid(), d.user_id, e->>'type', e->>'courseId', e->>'chapterId',
       NULLIF(e->>'score', '')::numeric, e->>'label', (e->>'at')::timestamptz
FROM user_documents d, jsonb_array_elements(d.value->'events') e
WHERE d.namespace = 'activity' AND d.document_key = 'log'
  AND e->>'type' IN ('answer', 'review', 'mock', 'resolve', 'read');

DELETE FROM user_documents WHERE namespace = 'activity' AND document_key = 'log';
