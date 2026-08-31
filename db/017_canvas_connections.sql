-- Canvas Personal Access Tokens are encrypted in application code before they
-- reach this table. There is deliberately no plaintext token column.
CREATE TABLE IF NOT EXISTS canvas_connections (
  user_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  encrypted_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, origin)
);

CREATE INDEX IF NOT EXISTS canvas_connections_user_updated_idx
  ON canvas_connections (user_id, updated_at DESC);
