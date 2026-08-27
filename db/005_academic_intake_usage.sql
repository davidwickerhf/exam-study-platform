ALTER TABLE ai_usage_events
  DROP CONSTRAINT IF EXISTS ai_usage_events_feature_check;

ALTER TABLE ai_usage_events
  ADD CONSTRAINT ai_usage_events_feature_check
  CHECK (feature IN ('chat', 'exercises', 'intake'));
