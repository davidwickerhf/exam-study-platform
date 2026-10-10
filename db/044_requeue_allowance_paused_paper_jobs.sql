-- Paper jobs that hit a daily or monthly allowance used to pause until a
-- manual retry. They now wait in the queue until the allowance resets, so
-- re-queue the ones already paused that way. One job per file stays active;
-- a job's own spending cap still needs an explicit decision and stays paused.
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
    AND jobs.value->>'error' IN (
      'The shared generation budget has been reached. Resume later or explicitly choose your own AI key in Settings.',
      'Your platform generation allowance is used. Resume later or explicitly choose your own AI key in Settings.',
      'Your daily study token allowance has been reached. Finished work is saved.',
      'Your included chapter allowance is used. Resume later or explicitly choose your own AI key. Finished chapters remain readable.',
      'The monthly spending limit for your own AI key has been reached. Adjust it in Settings or resume next month.'
    )
  ORDER BY jobs.user_id, jobs.value->>'programmeId', jobs.value->'course'->>'courseCode', jobs.value->>'sha256',
    coalesce((jobs.value->>'completedSections')::int, 0) DESC, jobs.created_at
);
