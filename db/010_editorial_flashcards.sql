-- Editorial flashcards move from data/flashcards.template.json into the
-- database so administrators and agents can maintain them per chapter.
CREATE TABLE IF NOT EXISTS editorial_flashcards (
  release_id BIGINT NOT NULL,
  course_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  source TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, course_id, card_id),
  FOREIGN KEY (release_id, course_id)
    REFERENCES editorial_courses(release_id, course_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS editorial_flashcards_chapter_idx
  ON editorial_flashcards (release_id, course_id, chapter_id, position);
