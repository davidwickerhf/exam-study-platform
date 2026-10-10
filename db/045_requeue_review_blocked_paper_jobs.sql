-- The extraction review treated allowed outcomes as blocking: sections with
-- no questions, figure-dependent questions marked needsOriginal, answers left
-- unavailable without a solution source, and pages owned by other sections.
-- The review now accepts those, so re-queue jobs it paused. The retry flag
-- restores the repair allowance and clears the old findings.
UPDATE user_documents
SET value = value || jsonb_build_object(
      'status', 'queued', 'error', NULL, 'issues', '[]'::jsonb, 'retry', true,
      'runAfter', 0, 'queueDeliveryUntil', 0, 'lease', NULL,
      'revision', gen_random_uuid()::text),
    updated_at = now()
WHERE (user_id, namespace, document_key) IN (
  SELECT DISTINCT ON (jobs.user_id, jobs.value->>'programmeId', jobs.value->'course'->>'courseCode', jobs.value->>'sha256')
    jobs.user_id, jobs.namespace, jobs.document_key
  FROM user_documents jobs
  WHERE jobs.namespace = 'study-paper-jobs'
    AND jobs.value->>'status' = 'paused'
    AND NOT EXISTS (SELECT 1 FROM user_documents active WHERE active.user_id = jobs.user_id
      AND active.namespace = 'study-paper-jobs' AND active.value->>'status' IN ('complete', 'queued', 'running')
      AND active.value->>'sha256' = jobs.value->>'sha256' AND active.value->>'programmeId' IS NOT DISTINCT FROM jobs.value->>'programmeId'
      AND active.value->'course'->>'courseCode' = jobs.value->'course'->>'courseCode')
    AND jobs.value->>'error' = 'The practice check found issues after one correction. Review them before retrying extraction or generation.'
  ORDER BY jobs.user_id, jobs.value->>'programmeId', jobs.value->'course'->>'courseCode', jobs.value->>'sha256',
    coalesce((jobs.value->>'completedSections')::int, 0) DESC, jobs.created_at
);
