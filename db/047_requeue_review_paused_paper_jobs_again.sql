-- Extraction review findings left after the correction round are now notes on
-- the completed paper instead of a pause. Re-queue jobs the review paused;
-- the retry flag restores the correction round and clears old findings.
UPDATE user_documents
SET value = value || jsonb_build_object(
      'status', 'queued', 'error', NULL, 'issues', '[]'::jsonb, 'retry', true,
      'runAfter', 0, 'queueDeliveryUntil', 0, 'lease', NULL,
      'revision', gen_random_uuid()::text),
    updated_at = now()
WHERE namespace = 'study-paper-jobs'
  AND value->>'status' = 'paused'
  AND value->>'error' = 'The practice check found issues after one correction. Review them before retrying extraction or generation.';
