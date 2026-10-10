-- The verbatim check now ignores page-numbered footers between the halves of
-- a question, and an automatic paper keeps going when one section has no
-- verifiable items. Re-queue papers paused by a whole section failing that
-- check; the retry flag re-runs the failed section.
UPDATE user_documents
SET value = value || jsonb_build_object(
      'status', 'queued', 'error', NULL, 'issues', '[]'::jsonb, 'retry', true,
      'runAfter', 0, 'queueDeliveryUntil', 0, 'lease', NULL,
      'revision', gen_random_uuid()::text),
    updated_at = now()
WHERE namespace = 'study-paper-jobs'
  AND value->>'status' = 'paused'
  AND value->>'error' IN (
    'An extracted question differs from its cited text. Inspect the original and retry.',
    'A paper question is not linked to its original page.'
  );
