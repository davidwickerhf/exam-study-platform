-- Published question banks and the programme catalogue move from repository
-- files into the database so administrators and agents can edit them live.

CREATE TABLE IF NOT EXISTS editorial_questions (
  release_id BIGINT NOT NULL,
  course_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  definition JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, course_id, chapter_id, question_id),
  FOREIGN KEY (release_id, course_id)
    REFERENCES editorial_courses(release_id, course_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS editorial_questions_chapter_idx
  ON editorial_questions (release_id, course_id, chapter_id, position);

CREATE TABLE IF NOT EXISTS editorial_programmes (
  id TEXT PRIMARY KEY,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
