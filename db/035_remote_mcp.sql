-- OAuth secrets are hashed. Durable state is shared by every API replica.
CREATE TABLE IF NOT EXISTS mcp_records (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  value JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS mcp_records_expiry ON mcp_records (expires_at);
CREATE INDEX IF NOT EXISTS mcp_records_owner ON mcp_records ((value->>'userId'));
CREATE TABLE IF NOT EXISTS mcp_budgets (
  id TEXT PRIMARY KEY,
  used BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
