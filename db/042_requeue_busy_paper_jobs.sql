-- Paper jobs used to pause permanently when another generation held the
-- account's budget lease or the per-minute allowance was busy. No AI call was
-- started for those, so re-queue them; the explicit retry flag lets the failed
-- section resume. Other paused jobs stay paused until the student retries.
UPDATE user_documents
SET value = value || jsonb_build_object(
      'status', 'queued', 'error', NULL, 'retry', true, 'runAfter', 0,
      'queueDeliveryUntil', 0, 'lease', NULL, 'revision', gen_random_uuid()::text),
    updated_at = now()
WHERE namespace = 'study-paper-jobs'
  AND value->>'status' = 'paused'
  AND value->>'error' IN (
    'Another chapter is generating on your account. This job will continue shortly.',
    'Generation is waiting for the per-minute allowance.'
  );
