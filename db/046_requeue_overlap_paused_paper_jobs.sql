-- Joining sections used to fail when two overlapping sections read a shared
-- boundary-page question differently. Joining now keeps the better-evidenced
-- reading with a warning, so re-queue those jobs: every section is already
-- extracted, so they complete without new AI calls.
UPDATE user_documents
SET value = value || jsonb_build_object(
      'status', 'queued', 'error', NULL, 'runAfter', 0, 'queueDeliveryUntil', 0,
      'lease', NULL, 'revision', gen_random_uuid()::text),
    updated_at = now()
WHERE namespace = 'study-paper-jobs'
  AND value->>'status' = 'paused'
  AND value->>'error' = 'Overlapping sections disagree about an answer or question. Review extraction before practising.';
