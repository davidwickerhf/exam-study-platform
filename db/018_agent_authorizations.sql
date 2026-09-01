-- Short-lived, single-use codes that let a locally running agent obtain an API
-- key without the key ever passing through a chat transcript. No secret is
-- stored here: the row only records that a signed-in browser approved minting a
-- key, and the key itself is created at exchange time and returned once.
CREATE TABLE IF NOT EXISTS agent_authorizations (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_authorizations_expiry_idx
  ON agent_authorizations (expires_at);
