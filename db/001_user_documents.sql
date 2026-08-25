CREATE TABLE IF NOT EXISTS user_documents (
  user_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  document_key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, namespace, document_key)
);

CREATE INDEX IF NOT EXISTS user_documents_user_updated_idx
  ON user_documents (user_id, updated_at DESC);
