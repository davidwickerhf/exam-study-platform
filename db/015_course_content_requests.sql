-- Student requests for courses that do not yet have maintained editorial
-- content. Source files remain private intake material until an administrator
-- completes the review and publication workflow.

CREATE TABLE IF NOT EXISTS course_content_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  requester_email TEXT,
  programme_id TEXT,
  academic_course_id TEXT NOT NULL,
  course_code TEXT NOT NULL DEFAULT '',
  course_name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'in-progress', 'review', 'published', 'declined')),
  pipeline_stage TEXT NOT NULL DEFAULT 'collection'
    CHECK (pipeline_stage IN ('collection', 'extraction', 'mapping', 'retrieval', 'authoring', 'exercises', 'quality', 'publication')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_content_requests_user_idx
  ON course_content_requests (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS course_content_requests_admin_idx
  ON course_content_requests (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS course_content_request_files (
  request_id TEXT NOT NULL REFERENCES course_content_requests(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL,
  expected_chunks INTEGER NOT NULL DEFAULT 1 CHECK (expected_chunks > 0),
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, id),
  UNIQUE (request_id, sha256)
);

CREATE TABLE IF NOT EXISTS course_content_request_file_chunks (
  request_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  data BYTEA NOT NULL,
  PRIMARY KEY (request_id, file_id, chunk_index),
  FOREIGN KEY (request_id, file_id)
    REFERENCES course_content_request_files(request_id, id) ON DELETE CASCADE
);
