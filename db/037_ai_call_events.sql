CREATE TABLE IF NOT EXISTS ai_call_events (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_call_events_created_idx ON ai_call_events(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_call_events_user_created_idx ON ai_call_events(user_id, created_at DESC);
