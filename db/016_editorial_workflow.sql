-- The editorial workspace sits between private intake and the active release.
-- Sources are content-addressed, course editions are versioned, and generated
-- artifacts keep evidence links so a weekly update only invalidates work that
-- depends on changed material.

CREATE TABLE IF NOT EXISTS editorial_course_editions (
  id TEXT PRIMARY KEY,
  programme_id TEXT,
  canonical_course_id TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT '',
  course_code TEXT NOT NULL DEFAULT '',
  course_name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  edition_key TEXT NOT NULL UNIQUE,
  course_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editorial_course_editions_lookup_idx
  ON editorial_course_editions (canonical_course_id, academic_year, period, updated_at DESC);

CREATE TABLE IF NOT EXISTS editorial_source_assets (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  content_sha256 TEXT,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  source_kind TEXT NOT NULL DEFAULT 'file' CHECK (source_kind IN ('file', 'url')),
  source_url TEXT,
  expected_chunks INTEGER NOT NULL DEFAULT 0 CHECK (expected_chunks >= 0),
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  extraction_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'processing', 'complete', 'failed', 'unsupported')),
  extraction_error TEXT,
  extracted_text TEXT,
  extracted_pages JSONB,
  outline JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editorial_source_asset_chunks (
  asset_id TEXT NOT NULL REFERENCES editorial_source_assets(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  data BYTEA NOT NULL,
  PRIMARY KEY (asset_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS editorial_contributions (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES editorial_source_assets(id) ON DELETE RESTRICT,
  request_id TEXT REFERENCES course_content_requests(id) ON DELETE SET NULL,
  request_file_id TEXT,
  contributor_user_id TEXT,
  source_path TEXT NOT NULL DEFAULT '',
  consent_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (consent_status IN ('private', 'candidate', 'accepted', 'rejected', 'withdrawn')),
  rights_basis TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  superseded_by TEXT
);

CREATE INDEX IF NOT EXISTS editorial_contributions_request_idx
  ON editorial_contributions (request_id);

CREATE UNIQUE INDEX IF NOT EXISTS editorial_contributions_provenance_idx
  ON editorial_contributions (
    edition_id,
    asset_id,
    coalesce(request_id, ''),
    coalesce(contributor_user_id, ''),
    source_path
  );

CREATE TABLE IF NOT EXISTS editorial_source_retrieval_chunks (
  id BIGSERIAL PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES editorial_source_assets(id) ON DELETE CASCADE,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  UNIQUE (edition_id, asset_id, page_number, chunk_index)
);

CREATE INDEX IF NOT EXISTS editorial_source_retrieval_search_idx
  ON editorial_source_retrieval_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS editorial_source_retrieval_scope_idx
  ON editorial_source_retrieval_chunks (edition_id, asset_id, page_number);

CREATE TABLE IF NOT EXISTS editorial_topic_nodes (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, stable_key)
);

CREATE TABLE IF NOT EXISTS editorial_source_mappings (
  topic_id TEXT NOT NULL REFERENCES editorial_topic_nodes(id) ON DELETE CASCADE,
  source_chunk_id BIGINT NOT NULL REFERENCES editorial_source_retrieval_chunks(id) ON DELETE CASCADE,
  relation TEXT NOT NULL DEFAULT 'supports' CHECK (relation IN ('supports', 'defines', 'example', 'assessment')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  PRIMARY KEY (topic_id, source_chunk_id)
);

CREATE TABLE IF NOT EXISTS editorial_change_sets (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'published', 'rejected')),
  source_hash TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, source_hash)
);

CREATE TABLE IF NOT EXISTS editorial_processing_jobs (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES editorial_source_assets(id) ON DELETE CASCADE,
  change_set_id TEXT REFERENCES editorial_change_sets(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL
    CHECK (job_type IN ('extract', 'map', 'study-pages', 'exercises', 'flashcards', 'quality')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'awaiting-approval', 'completed', 'failed', 'cancelled')),
  input_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE (edition_id, job_type, input_hash)
);

CREATE INDEX IF NOT EXISTS editorial_processing_jobs_queue_idx
  ON editorial_processing_jobs (status, created_at);

CREATE TABLE IF NOT EXISTS editorial_generated_artifacts (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES editorial_topic_nodes(id) ON DELETE SET NULL,
  change_set_id TEXT NOT NULL REFERENCES editorial_change_sets(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL
    CHECK (artifact_type IN ('course-outline', 'study-page', 'exercise-set', 'flashcards', 'quality-report')),
  title TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_hash TEXT NOT NULL,
  generator TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'rejected', 'published')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, artifact_type, topic_id, source_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS editorial_generated_artifacts_cache_idx
  ON editorial_generated_artifacts (edition_id, artifact_type, coalesce(topic_id, ''), source_hash);

CREATE TABLE IF NOT EXISTS editorial_artifact_evidence (
  artifact_id TEXT NOT NULL REFERENCES editorial_generated_artifacts(id) ON DELETE CASCADE,
  source_chunk_id BIGINT NOT NULL REFERENCES editorial_source_retrieval_chunks(id) ON DELETE CASCADE,
  PRIMARY KEY (artifact_id, source_chunk_id)
);

CREATE TABLE IF NOT EXISTS editorial_course_releases (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editorial_course_editions(id) ON DELETE CASCADE,
  change_set_id TEXT NOT NULL REFERENCES editorial_change_sets(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'retired')),
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, version)
);

ALTER TABLE course_content_requests
  ADD COLUMN IF NOT EXISTS contribution_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contribution_license TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contribution_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edition_id TEXT REFERENCES editorial_course_editions(id) ON DELETE SET NULL;
