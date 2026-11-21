-- Joining completed paper sections now merges items whose labels differ only
-- in spacing ("8a (b)" / "8a(b)") and drops shared introductions and lab steps
-- extracted as items. Re-join every completed automatic paper from its saved
-- sections: all sections are complete, so this makes no AI calls, and the
-- joined set replaces the paper's earlier set in place.
UPDATE user_documents
SET value = value || jsonb_build_object(
      'status', 'queued', 'runAfter', 0, 'queueDeliveryUntil', 0, 'lease', NULL,
      'revision', gen_random_uuid()::text),
    updated_at = now()
WHERE namespace = 'study-paper-jobs'
  AND value->>'status' = 'complete'
  AND jsonb_array_length(coalesce(value->'sections', '[]'::jsonb)) > 0
  AND (value->>'completedSections')::int = jsonb_array_length(value->'sections');
