-- One paper job per file (#88). Jobs were keyed by Canvas source path, so the
-- same bytes under several paths got several jobs. Keep one per account,
-- programme, course and file hash: a completed job first, then one already
-- queued or running, then the most finished sections, then the oldest. The
-- others become 'duplicate' with a pointer to the kept job; their saved work
-- stays in place, they are never dispatched, and they are hidden from the
-- paper bank. Clearing the lease stops a worker mid-step from writing back.
WITH ranked AS (
  SELECT user_id, document_key,
    first_value(document_key) OVER w AS keep,
    row_number() OVER w AS rank
  FROM user_documents
  WHERE namespace = 'study-paper-jobs' AND value->>'status' <> 'duplicate' AND value->>'sha256' IS NOT NULL
  WINDOW w AS (
    PARTITION BY user_id, value->>'programmeId', value->'course'->>'courseCode', value->>'sha256'
    ORDER BY CASE value->>'status' WHEN 'complete' THEN 0 WHEN 'running' THEN 1 WHEN 'queued' THEN 1 ELSE 2 END,
      coalesce((value->>'completedSections')::int, 0) DESC, created_at, document_key
  )
)
UPDATE user_documents jobs
SET value = jobs.value || jsonb_build_object(
      'status', 'duplicate', 'duplicateOf', ranked.keep, 'previousStatus', jobs.value->>'status',
      'lease', NULL, 'queueDeliveryUntil', 0, 'revision', gen_random_uuid()::text),
    updated_at = now()
FROM ranked
WHERE jobs.namespace = 'study-paper-jobs' AND jobs.user_id = ranked.user_id
  AND jobs.document_key = ranked.document_key AND ranked.rank > 1;
