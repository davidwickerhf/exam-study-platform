-- Re-queue paper jobs paused by failures that paper processing now recovers
-- from: a busy budget lease or per-minute allowance (no AI call was started),
-- an exhausted output allowance (now larger, and oversized sections split),
-- review issues after one correction (retry restores the repair allowance),
-- and single-question validation errors (now omitted per question). The retry
-- flag lets the failed section resume; stored billing is kept so the payer
-- does not change. Allowance and access failures stay paused. Duplicate jobs
-- for the same file bytes (#88) are re-queued once per course, and not at all
-- when that file already has a completed job, so they never pay twice.
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
    AND NOT EXISTS (SELECT 1 FROM user_documents done WHERE done.user_id = jobs.user_id
      AND done.namespace = 'study-paper-jobs' AND done.value->>'status' IN ('complete', 'queued', 'running')
      AND done.value->>'sha256' = jobs.value->>'sha256' AND done.value->>'programmeId' IS NOT DISTINCT FROM jobs.value->>'programmeId'
      AND done.value->'course'->>'courseCode' = jobs.value->'course'->>'courseCode')
    AND jobs.value->>'error' IN (
      'Another chapter is generating on your account. This job will continue shortly.',
      'Generation is waiting for the per-minute allowance.',
      'The AI reached its response token limit before completing. The saved chapter is intact; retry the unfinished step.',
      'The practice check found issues after one correction. Review them before retrying extraction or generation.',
      'An extracted question differs from its cited text. Inspect the original and retry.',
      'A practice citation is not in the selected evidence.',
      'Repeated subquestion labels were found.'
    )
  ORDER BY jobs.user_id, jobs.value->>'programmeId', jobs.value->'course'->>'courseCode', jobs.value->>'sha256',
    coalesce((jobs.value->>'completedSections')::int, 0) DESC, jobs.created_at
);
