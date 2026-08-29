-- Personal API keys for agents and administrators. Only the SHA-256 hash of a
-- key is stored; the plaintext is shown once at creation.
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id, created_at DESC);
