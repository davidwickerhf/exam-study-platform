-- Institution and programme rules are not course material. Store them once,
-- map them to every programme they govern, and keep retrieval provenance down
-- to the page. Originals remain private unless a reviewed public source URL
-- and a redistribution-safe rights basis are both recorded.

CREATE TABLE IF NOT EXISTS programme_policy_sources (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES editorial_source_assets(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  document_kind TEXT NOT NULL
    CHECK (document_kind IN ('education-examination-regulations', 'rules-regulations', 'board-of-examiners', 'exam-procedure', 'programme-policy', 'other')),
  institution TEXT NOT NULL DEFAULT '',
  academic_year TEXT NOT NULL DEFAULT '',
  authority TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'programme'
    CHECK (visibility IN ('programme', 'public')),
  rights_basis TEXT NOT NULL DEFAULT 'institution-member-reference'
    CHECK (rights_basis IN ('institution-member-reference', 'official-publication', 'written-permission')),
  original_downloadable BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'indexed', 'retired')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    visibility <> 'public'
    OR (
      rights_basis IN ('official-publication', 'written-permission')
      AND source_url IS NOT NULL
      AND length(trim(source_url)) > 0
    )
  ),
  CHECK (original_downloadable = FALSE OR visibility = 'public')
);

CREATE UNIQUE INDEX IF NOT EXISTS programme_policy_sources_asset_kind_year_uidx
  ON programme_policy_sources (asset_id, document_kind, academic_year);

CREATE INDEX IF NOT EXISTS programme_policy_sources_scope_idx
  ON programme_policy_sources (academic_year, document_kind, status, visibility);

CREATE TABLE IF NOT EXISTS programme_policy_source_programmes (
  source_id TEXT NOT NULL REFERENCES programme_policy_sources(id) ON DELETE CASCADE,
  programme_id TEXT NOT NULL,
  PRIMARY KEY (source_id, programme_id)
);

CREATE INDEX IF NOT EXISTS programme_policy_source_programmes_programme_idx
  ON programme_policy_source_programmes (programme_id, source_id);

CREATE TABLE IF NOT EXISTS programme_policy_retrieval_chunks (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES programme_policy_sources(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES editorial_source_assets(id) ON DELETE CASCADE,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  embedding vector(1536),
  embedding_model TEXT,
  embedded_at TIMESTAMPTZ,
  UNIQUE (source_id, page_number, chunk_index)
);

CREATE INDEX IF NOT EXISTS programme_policy_retrieval_search_idx
  ON programme_policy_retrieval_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS programme_policy_retrieval_scope_idx
  ON programme_policy_retrieval_chunks (source_id, page_number, chunk_index);

CREATE INDEX IF NOT EXISTS programme_policy_retrieval_embedding_idx
  ON programme_policy_retrieval_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
