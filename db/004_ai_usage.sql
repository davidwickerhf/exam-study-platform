CREATE TABLE IF NOT EXISTS ai_usage_events (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL CHECK (feature IN ('chat', 'exercises')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  estimated BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON ai_usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_feature_created_idx
  ON ai_usage_events (user_id, feature, created_at DESC);
