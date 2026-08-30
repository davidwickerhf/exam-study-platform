-- Personal study data, one table per entity. Replaces the JSON blobs that
-- lived in user_documents (progress, exercises, learning, mistakes,
-- mock-sessions, browser, academics). user_documents remains only for the
-- local-mode migration marker.

CREATE TABLE IF NOT EXISTS course_settings (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS item_progress (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  mastery SMALLINT CHECK (mastery IS NULL OR (mastery >= 0 AND mastery <= 4)),
  mastery_updated_at TIMESTAMPTZ,
  notes TEXT,
  priority TEXT,
  review_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS item_progress_user_course_idx ON item_progress (user_id, course_id);

CREATE TABLE IF NOT EXISTS personal_exercises (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  type TEXT,
  difficulty TEXT,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS personal_exercises_user_chapter_idx ON personal_exercises (user_id, course_id, chapter_id);

CREATE TABLE IF NOT EXISTS flashcards (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  chapter_id TEXT,
  front TEXT NOT NULL DEFAULT '',
  back TEXT NOT NULL DEFAULT '',
  source TEXT,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS flashcards_user_course_idx ON flashcards (user_id, course_id, chapter_id);

CREATE TABLE IF NOT EXISTS sr_cards (
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS sr_cards_user_due_idx ON sr_cards (user_id, due_at);

CREATE TABLE IF NOT EXISTS mistakes (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  chapter_id TEXT,
  question_id TEXT,
  type TEXT,
  difficulty TEXT,
  question TEXT,
  options JSONB,
  expected JSONB,
  source TEXT,
  attempt TEXT,
  correction TEXT,
  score NUMERIC(4, 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS mistakes_user_course_idx ON mistakes (user_id, course_id, chapter_id);
CREATE INDEX IF NOT EXISTS mistakes_user_open_idx ON mistakes (user_id, created_at DESC) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS mock_sessions (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  chapter_id TEXT,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  total_score NUMERIC(8, 1),
  total_max NUMERIC(8, 1),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS mock_sessions_user_course_idx ON mock_sessions (user_id, course_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS mock_session_answers (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  question_id TEXT,
  question JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt TEXT,
  attempt_images JSONB,
  correction TEXT,
  score NUMERIC(4, 1),
  PRIMARY KEY (user_id, session_id, position),
  FOREIGN KEY (user_id, session_id) REFERENCES mock_sessions (user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS browser_state (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS academic_programmes (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  university TEXT NOT NULL DEFAULT '',
  programme TEXT NOT NULL DEFAULT '',
  academic_year TEXT NOT NULL DEFAULT '',
  current_year_key TEXT NOT NULL DEFAULT '',
  gpa_includes_failed BOOLEAN NOT NULL DEFAULT FALSE,
  template_programme_id TEXT,
  template_version_id TEXT,
  template_current_study_year TEXT,
  template_pathway_id TEXT,
  template_selected_choices JSONB NOT NULL DEFAULT '{}'::jsonb,
  planning_objectives JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS academic_courses (
  user_id TEXT NOT NULL,
  programme_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  editorial_course_id TEXT,
  template_course_id TEXT,
  programme_requirement TEXT,
  choice_group_id TEXT,
  pathway_id TEXT,
  ects NUMERIC(6, 2) NOT NULL DEFAULT 0,
  year_level TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  pass_mark NUMERIC(5, 2) NOT NULL DEFAULT 5.5,
  notes TEXT NOT NULL DEFAULT '',
  hidden_from_stats BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, programme_id, id),
  FOREIGN KEY (user_id, programme_id) REFERENCES academic_programmes (user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academic_attempts (
  user_id TEXT NOT NULL,
  programme_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'first',
  exam_date DATE,
  grade NUMERIC(5, 2),
  status TEXT NOT NULL DEFAULT 'upcoming',
  course_code TEXT NOT NULL DEFAULT '',
  course_name TEXT NOT NULL DEFAULT '',
  ects NUMERIC(6, 2),
  year_level TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  curriculum_version TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, programme_id, course_id, id),
  FOREIGN KEY (user_id, programme_id, course_id) REFERENCES academic_courses (user_id, programme_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academic_events (
  user_id TEXT NOT NULL,
  programme_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  date DATE,
  end_date DATE,
  type TEXT NOT NULL DEFAULT 'other',
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, programme_id, id),
  FOREIGN KEY (user_id, programme_id) REFERENCES academic_programmes (user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academic_gates (
  user_id TEXT NOT NULL,
  programme_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'progression',
  type TEXT NOT NULL DEFAULT 'course',
  course_id TEXT,
  level TEXT,
  target NUMERIC(8, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, programme_id, id),
  FOREIGN KEY (user_id, programme_id) REFERENCES academic_programmes (user_id, id) ON DELETE CASCADE
);

-- ── One-off backfill from user_documents ─────────────────────────────────

INSERT INTO course_settings (user_id, course_id, archived, sort_order, updated_at)
SELECT d.user_id, c->>'id', coalesce((c->>'archived')::boolean, false), (c->>'order')::integer, d.updated_at
FROM user_documents d, jsonb_array_elements(d.value->'courses') c
WHERE d.namespace = 'progress' AND d.document_key = 'study-state'
  AND (c ? 'archived' OR c ? 'order')
ON CONFLICT DO NOTHING;

INSERT INTO item_progress (user_id, item_id, course_id, mastery, mastery_updated_at, notes, priority, review_log, updated_at)
SELECT d.user_id, i->>'id', c->>'id', (i->>'mastery')::smallint, NULLIF(i->>'masteryUpdatedAt', '')::timestamptz,
       i->>'notes', i->>'priority', coalesce(i->'reviewLog', '[]'::jsonb), d.updated_at
FROM user_documents d, jsonb_array_elements(d.value->'courses') c, jsonb_array_elements(c->'items') i
WHERE d.namespace = 'progress' AND d.document_key = 'study-state'
  AND (i ? 'mastery' OR i ? 'notes' OR i ? 'priority' OR i ? 'reviewLog')
ON CONFLICT DO NOTHING;

INSERT INTO personal_exercises (user_id, id, course_id, chapter_id, type, difficulty, body, created_at)
SELECT d.user_id, q->>'id', split_part(d.document_key, '-', 1), substr(d.document_key, length(split_part(d.document_key, '-', 1)) + 2),
       q->>'type', q->>'difficulty', q, coalesce(NULLIF(d.value->>'updatedAt', '')::timestamptz, d.updated_at)
FROM user_documents d, jsonb_array_elements(d.value->'questions') q
WHERE d.namespace = 'exercises' AND q ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO flashcards (user_id, id, course_id, chapter_id, front, back, source, ease, interval_days, repetitions, last_reviewed, due_at, history, extra, created_at)
SELECT d.user_id, c->>'id', coalesce(c->>'courseId', ''), c->>'chapterId', coalesce(c->>'front', ''), coalesce(c->>'back', ''), c->>'source',
       coalesce((c->'sr'->>'ease')::real, 2.5), coalesce((c->'sr'->>'interval')::real, 0), coalesce((c->'sr'->>'repetitions')::integer, 0),
       NULLIF(c->'sr'->>'lastReviewed', '')::timestamptz, NULLIF(c->'sr'->>'dueAt', '')::timestamptz, coalesce(c->'sr'->'history', '[]'::jsonb),
       c - 'id' - 'courseId' - 'chapterId' - 'front' - 'back' - 'source' - 'sr' - 'createdAt',
       coalesce(NULLIF(c->>'createdAt', '')::timestamptz, d.updated_at)
FROM user_documents d, jsonb_array_elements(d.value->'cards') c
WHERE d.namespace = 'learning' AND d.document_key = 'flashcards' AND c ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO sr_cards (user_id, question_id, ease, interval_days, repetitions, last_reviewed, due_at, history, updated_at)
SELECT d.user_id, e.key, coalesce((e.value->>'ease')::real, 2.5), coalesce((e.value->>'interval')::real, 0), coalesce((e.value->>'repetitions')::integer, 0),
       NULLIF(e.value->>'lastReviewed', '')::timestamptz, NULLIF(e.value->>'dueAt', '')::timestamptz, coalesce(e.value->'history', '[]'::jsonb), d.updated_at
FROM user_documents d, jsonb_each(d.value->'cards') e
WHERE d.namespace = 'learning' AND d.document_key = 'spaced-repetition'
ON CONFLICT DO NOTHING;

INSERT INTO mistakes (user_id, id, course_id, chapter_id, question_id, type, difficulty, question, options, expected, source, attempt, correction, score, created_at, resolved_at)
SELECT d.user_id, m->>'id', coalesce(m->>'courseId', split_part(d.document_key, '-', 1)), m->>'chapterId', m->>'questionId', m->>'type', m->>'difficulty',
       m->>'question', m->'options', m->'expected', m->>'source', m->>'attempt', m->>'correction', NULLIF(m->>'score', '')::numeric,
       coalesce(NULLIF(m->>'createdAt', '')::timestamptz, d.updated_at), NULLIF(m->>'resolvedAt', '')::timestamptz
FROM user_documents d, jsonb_array_elements(d.value) m
WHERE d.namespace = 'mistakes' AND jsonb_typeof(d.value) = 'array' AND m ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO mock_sessions (user_id, id, course_id, chapter_id, started_at, submitted_at, duration_seconds, total_score, total_max)
SELECT d.user_id, d.value->>'id', coalesce(d.value->>'courseId', ''), d.value->>'chapterId', NULLIF(d.value->>'startedAt', '')::timestamptz,
       NULLIF(d.value->>'submittedAt', '')::timestamptz, (d.value->>'duration')::integer, NULLIF(d.value->>'totalScore', '')::numeric, NULLIF(d.value->>'totalMax', '')::numeric
FROM user_documents d
WHERE d.namespace = 'mock-sessions' AND d.value ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO mock_session_answers (user_id, session_id, position, question_id, question, attempt, attempt_images, correction, score)
SELECT d.user_id, d.value->>'id', q.ordinality - 1, q.value->>'id',
       q.value - 'attempt' - 'attemptImages' - 'correction' - 'score', q.value->>'attempt', q.value->'attemptImages', q.value->>'correction', NULLIF(q.value->>'score', '')::numeric
FROM user_documents d, jsonb_array_elements(d.value->'questions') WITH ORDINALITY q
WHERE d.namespace = 'mock-sessions' AND d.value ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO browser_state (user_id, key, value, updated_at)
SELECT d.user_id, e.key, e.value, d.updated_at
FROM user_documents d, jsonb_each_text(d.value) e
WHERE d.namespace = 'browser' AND d.document_key = 'local-storage' AND e.key NOT LIKE '\_\_clerk%'
ON CONFLICT DO NOTHING;

INSERT INTO academic_programmes (user_id, id, revision, is_active, university, programme, academic_year, current_year_key, gpa_includes_failed,
  template_programme_id, template_version_id, template_current_study_year, template_pathway_id, template_selected_choices, planning_objectives, created_at, updated_at)
SELECT d.user_id, substr(d.document_key, 11), coalesce((d.value->>'revision')::integer, 0),
       coalesce(idx.value->>'activeProgrammeId', 'default') = substr(d.document_key, 11),
       coalesce(d.value->'profile'->>'university', ''), coalesce(d.value->'profile'->>'programme', ''), coalesce(d.value->'profile'->>'academicYear', ''),
       coalesce(d.value->'profile'->>'currentYearKey', ''), coalesce((d.value->'profile'->>'gpaIncludesFailedCourses')::boolean, false),
       d.value->'programmeTemplate'->>'programmeId', d.value->'programmeTemplate'->>'versionId', d.value->'programmeTemplate'->>'currentStudyYear',
       d.value->'programmeTemplate'->>'pathwayId', coalesce(d.value->'programmeTemplate'->'selectedChoices', '{}'::jsonb),
       coalesce(d.value->'planning'->'objectives', '{}'::jsonb), d.created_at, d.updated_at
FROM user_documents d
LEFT JOIN user_documents idx ON idx.user_id = d.user_id AND idx.namespace = 'academics' AND idx.document_key = 'index'
WHERE d.namespace = 'academics' AND d.document_key LIKE 'programme:%'
ON CONFLICT DO NOTHING;

INSERT INTO academic_courses (user_id, programme_id, id, position, code, name, editorial_course_id, template_course_id, programme_requirement, choice_group_id, pathway_id, ects, year_level, period, pass_mark, notes, hidden_from_stats)
SELECT d.user_id, substr(d.document_key, 11), c.value->>'id', c.ordinality - 1, coalesce(c.value->>'code', ''), coalesce(c.value->>'name', ''),
       c.value->>'editorialCourseId', c.value->>'templateCourseId', c.value->>'programmeRequirement', c.value->>'choiceGroupId', c.value->>'pathwayId',
       coalesce(NULLIF(c.value->>'ects', '')::numeric, 0), coalesce(c.value->>'yearLevel', ''), coalesce(c.value->>'period', ''),
       coalesce(NULLIF(c.value->>'passMark', '')::numeric, 5.5), coalesce(c.value->>'notes', ''), coalesce((c.value->>'hiddenFromStats')::boolean, false)
FROM user_documents d, jsonb_array_elements(d.value->'courses') WITH ORDINALITY c
WHERE d.namespace = 'academics' AND d.document_key LIKE 'programme:%' AND c.value ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO academic_attempts (user_id, programme_id, course_id, id, position, academic_year, type, exam_date, grade, status)
SELECT d.user_id, substr(d.document_key, 11), c.value->>'id', a.value->>'id', a.ordinality - 1, coalesce(a.value->>'academicYear', ''),
       coalesce(a.value->>'type', 'first'), NULLIF(a.value->>'examDate', '')::date, NULLIF(a.value->>'grade', '')::numeric, coalesce(a.value->>'status', 'upcoming')
FROM user_documents d, jsonb_array_elements(d.value->'courses') WITH ORDINALITY c, jsonb_array_elements(c.value->'attempts') WITH ORDINALITY a
WHERE d.namespace = 'academics' AND d.document_key LIKE 'programme:%' AND c.value ? 'id' AND a.value ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO academic_events (user_id, programme_id, id, position, title, date, end_date, type, notes)
SELECT d.user_id, substr(d.document_key, 11), e.value->>'id', e.ordinality - 1, coalesce(e.value->>'title', ''), NULLIF(e.value->>'date', '')::date,
       NULLIF(e.value->>'endDate', '')::date, coalesce(e.value->>'type', 'other'), coalesce(e.value->>'notes', '')
FROM user_documents d, jsonb_array_elements(d.value->'events') WITH ORDINALITY e
WHERE d.namespace = 'academics' AND d.document_key LIKE 'programme:%' AND e.value ? 'id'
ON CONFLICT DO NOTHING;

INSERT INTO academic_gates (user_id, programme_id, id, position, label, section, type, course_id, level, target)
SELECT d.user_id, substr(d.document_key, 11), g.value->>'id', g.ordinality - 1, coalesce(g.value->>'label', ''), coalesce(g.value->>'section', 'progression'),
       coalesce(g.value->>'type', 'course'), g.value->>'courseId', g.value->>'level', coalesce(NULLIF(g.value->>'target', '')::numeric, 0)
FROM user_documents d, jsonb_array_elements(d.value->'gates') WITH ORDINALITY g
WHERE d.namespace = 'academics' AND d.document_key LIKE 'programme:%' AND g.value ? 'id'
ON CONFLICT DO NOTHING;

DELETE FROM user_documents WHERE namespace IN ('progress', 'exercises', 'learning', 'mistakes', 'mock-sessions', 'browser', 'academics');
