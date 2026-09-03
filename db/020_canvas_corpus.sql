-- Shared Canvas source corpus. Bytes and extracted chunks are deduplicated
-- globally, while access remains tied to an observed Canvas enrolment. An
-- administrator may promote a contribution into the editorial workflow only
-- after the existing rights review.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS canvas_course_bindings (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  canvas_course_id TEXT NOT NULL,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  canonical_course_id TEXT NOT NULL,
  course_code TEXT NOT NULL DEFAULT '',
  course_name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  term_name TEXT NOT NULL DEFAULT '',
  canvas_updated_at TIMESTAMPTZ,
  manifest_hash TEXT,
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (origin, canvas_course_id)
);

CREATE INDEX IF NOT EXISTS canvas_course_bindings_edition_idx
  ON canvas_course_bindings (canonical_course_id, academic_year, period, last_synced_at DESC);

CREATE TABLE IF NOT EXISTS canvas_corpus_permissions (
  user_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  collection_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sharing_mode TEXT NOT NULL DEFAULT 'private' CHECK (sharing_mode IN ('private', 'community')),
  consent_version TEXT NOT NULL DEFAULT 'v1',
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, origin)
);

CREATE TABLE IF NOT EXISTS canvas_corpus_access (
  user_id TEXT NOT NULL,
  binding_id TEXT NOT NULL REFERENCES canvas_course_bindings(id) ON DELETE CASCADE,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sharing_mode TEXT NOT NULL DEFAULT 'private' CHECK (sharing_mode IN ('private', 'community')),
  PRIMARY KEY (user_id, binding_id)
);

CREATE INDEX IF NOT EXISTS canvas_corpus_access_user_idx
  ON canvas_corpus_access (user_id, last_observed_at DESC);

CREATE TABLE IF NOT EXISTS canvas_source_snapshots (
  id TEXT PRIMARY KEY,
  binding_id TEXT NOT NULL REFERENCES canvas_course_bindings(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES editorial_source_assets(id) ON DELETE RESTRICT,
  contribution_id TEXT REFERENCES editorial_contributions(id) ON DELETE SET NULL,
  contributor_user_id TEXT NOT NULL,
  sharing_mode TEXT NOT NULL DEFAULT 'private' CHECK (sharing_mode IN ('private', 'community')),
  resource_key TEXT NOT NULL,
  source_path TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'file',
  canvas_updated_at TIMESTAMPTZ,
  etag TEXT,
  sha256 TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (binding_id, resource_key, sha256, contributor_user_id)
);

CREATE INDEX IF NOT EXISTS canvas_source_snapshots_current_idx
  ON canvas_source_snapshots (binding_id, resource_key, last_seen_at DESC)
  WHERE retired_at IS NULL;

ALTER TABLE canvas_source_snapshots
  ADD COLUMN IF NOT EXISTS contributor_user_id TEXT,
  ADD COLUMN IF NOT EXISTS sharing_mode TEXT NOT NULL DEFAULT 'private';

-- Existing rows can only occur during a rolling deployment of this migration;
-- keep them private until a contributing account is known.
UPDATE canvas_source_snapshots SET contributor_user_id = '' WHERE contributor_user_id IS NULL;
ALTER TABLE canvas_source_snapshots ALTER COLUMN contributor_user_id SET NOT NULL;

-- Early development versions keyed snapshots without the contributor. That
-- cannot represent two private imports of the same Canvas file safely.
ALTER TABLE canvas_source_snapshots
  DROP CONSTRAINT IF EXISTS canvas_source_snapshots_binding_id_resource_key_sha256_key;
CREATE UNIQUE INDEX IF NOT EXISTS canvas_source_snapshots_version_contributor_uidx
  ON canvas_source_snapshots (binding_id, resource_key, sha256, contributor_user_id);

CREATE INDEX IF NOT EXISTS canvas_source_snapshots_access_idx
  ON canvas_source_snapshots (binding_id, sharing_mode, contributor_user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS canvas_sync_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  binding_id TEXT REFERENCES canvas_course_bindings(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('catalog', 'course')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS canvas_sync_jobs_queue_idx
  ON canvas_sync_jobs (status, priority DESC, run_after, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS canvas_sync_jobs_one_catalog_idx
  ON canvas_sync_jobs (user_id, origin)
  WHERE job_type = 'catalog' AND status IN ('pending', 'running');

CREATE UNIQUE INDEX IF NOT EXISTS canvas_sync_jobs_one_course_idx
  ON canvas_sync_jobs (user_id, binding_id)
  WHERE job_type = 'course' AND status IN ('pending', 'running');

ALTER TABLE editorial_source_retrieval_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS editorial_source_retrieval_embedding_idx
  ON editorial_source_retrieval_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
