CREATE TABLE IF NOT EXISTS editorial_retrieval_chunks (
  id BIGSERIAL PRIMARY KEY,
  material_id BIGINT NOT NULL REFERENCES editorial_materials(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  UNIQUE (material_id, page_number, chunk_index)
);

CREATE INDEX IF NOT EXISTS editorial_retrieval_chunks_search_idx
  ON editorial_retrieval_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS editorial_retrieval_chunks_scope_idx
  ON editorial_retrieval_chunks (course_id, source_path, page_number);

UPDATE editorial_materials
SET extracted_pages = (extracted_pages #>> '{}')::jsonb
WHERE jsonb_typeof(extracted_pages) = 'string'
  AND jsonb_typeof((extracted_pages #>> '{}')::jsonb) = 'array';
