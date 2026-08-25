CREATE TABLE IF NOT EXISTS editorial_releases (
  id BIGSERIAL PRIMARY KEY,
  source_hash TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS editorial_releases_one_active_idx
  ON editorial_releases (active) WHERE active;

CREATE TABLE IF NOT EXISTS editorial_courses (
  release_id BIGINT NOT NULL REFERENCES editorial_releases(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  position INTEGER NOT NULL,
  exam TEXT,
  role TEXT,
  accent TEXT,
  knowledge_base TEXT NOT NULL,
  visual_style TEXT,
  exam_profile TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (release_id, course_id)
);

CREATE TABLE IF NOT EXISTS editorial_chapters (
  release_id BIGINT NOT NULL,
  course_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_path TEXT NOT NULL,
  position INTEGER NOT NULL,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (release_id, course_id, chapter_id),
  FOREIGN KEY (release_id, course_id)
    REFERENCES editorial_courses(release_id, course_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS editorial_items (
  release_id BIGINT NOT NULL,
  course_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  definition JSONB NOT NULL,
  PRIMARY KEY (release_id, course_id, item_id),
  FOREIGN KEY (release_id, course_id)
    REFERENCES editorial_courses(release_id, course_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS editorial_papers (
  release_id BIGINT NOT NULL,
  course_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  paper_type TEXT NOT NULL CHECK (paper_type IN ('mock-exam', 'tutorial')),
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  question_path TEXT,
  solutions_path TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (release_id, course_id, paper_type, paper_id),
  FOREIGN KEY (release_id, course_id)
    REFERENCES editorial_courses(release_id, course_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS editorial_materials (
  id BIGSERIAL PRIMARY KEY,
  release_id BIGINT NOT NULL,
  course_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL,
  text_content TEXT,
  extracted_text TEXT,
  extracted_pages JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (release_id, course_id, source_path),
  FOREIGN KEY (release_id, course_id)
    REFERENCES editorial_courses(release_id, course_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS editorial_materials_lookup_idx
  ON editorial_materials (release_id, course_id, source_path);

CREATE INDEX IF NOT EXISTS editorial_materials_kind_idx
  ON editorial_materials (release_id, course_id, kind);

CREATE TABLE IF NOT EXISTS editorial_material_chunks (
  material_id BIGINT NOT NULL REFERENCES editorial_materials(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  data BYTEA NOT NULL,
  PRIMARY KEY (material_id, chunk_index)
);

