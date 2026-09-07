-- Private versions/revisions/progress use the existing account-erased document store.
-- Sharing is an explicit immutable publication document, with source permission checks.
CREATE INDEX IF NOT EXISTS study_generation_outbox_idx ON user_documents (updated_at)
  WHERE namespace='study-versions' AND value->'draft'->>'status' IN ('queued','running');
CREATE INDEX IF NOT EXISTS study_publications_course_idx ON user_documents ((value->'course'->>'courseCode'),updated_at)
  WHERE namespace='study-publications' AND value->>'status'='published';
