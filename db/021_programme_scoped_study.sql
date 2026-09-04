-- Personal learning state belongs to one academic programme workspace. Shared
-- editorial material and account connections intentionally remain global.

ALTER TABLE course_settings ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE item_progress ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE personal_exercises ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE sr_cards ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE mock_session_answers ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE browser_state ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS programme_id TEXT;
ALTER TABLE academic_snapshots ADD COLUMN IF NOT EXISTS programme_id TEXT;

UPDATE course_settings t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE item_progress t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE personal_exercises t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE flashcards t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE sr_cards t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE mistakes t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE mock_sessions t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE mock_session_answers a SET programme_id = coalesce((SELECT s.programme_id FROM mock_sessions s WHERE s.user_id=a.user_id AND s.id=a.session_id LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE browser_state t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE activity_events t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;
UPDATE academic_snapshots t SET programme_id = coalesce((SELECT p.id FROM academic_programmes p WHERE p.user_id=t.user_id ORDER BY p.is_active DESC, p.updated_at DESC LIMIT 1), 'default') WHERE programme_id IS NULL;

ALTER TABLE course_settings ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE item_progress ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE personal_exercises ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE flashcards ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE sr_cards ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE mistakes ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE mock_sessions ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE mock_session_answers ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE browser_state ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE activity_events ALTER COLUMN programme_id SET NOT NULL;
ALTER TABLE academic_snapshots ALTER COLUMN programme_id SET NOT NULL;

ALTER TABLE mock_session_answers DROP CONSTRAINT IF EXISTS mock_session_answers_user_id_session_id_fkey;
ALTER TABLE mock_session_answers DROP CONSTRAINT IF EXISTS mock_session_answers_programme_session_fkey;
ALTER TABLE course_settings DROP CONSTRAINT IF EXISTS course_settings_pkey;
ALTER TABLE item_progress DROP CONSTRAINT IF EXISTS item_progress_pkey;
ALTER TABLE personal_exercises DROP CONSTRAINT IF EXISTS personal_exercises_pkey;
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_pkey;
ALTER TABLE sr_cards DROP CONSTRAINT IF EXISTS sr_cards_pkey;
ALTER TABLE mistakes DROP CONSTRAINT IF EXISTS mistakes_pkey;
ALTER TABLE mock_session_answers DROP CONSTRAINT IF EXISTS mock_session_answers_pkey;
ALTER TABLE mock_sessions DROP CONSTRAINT IF EXISTS mock_sessions_pkey;
ALTER TABLE browser_state DROP CONSTRAINT IF EXISTS browser_state_pkey;

ALTER TABLE course_settings ADD PRIMARY KEY (user_id, programme_id, course_id);
ALTER TABLE item_progress ADD PRIMARY KEY (user_id, programme_id, item_id);
ALTER TABLE personal_exercises ADD PRIMARY KEY (user_id, programme_id, id);
ALTER TABLE flashcards ADD PRIMARY KEY (user_id, programme_id, id);
ALTER TABLE sr_cards ADD PRIMARY KEY (user_id, programme_id, question_id);
ALTER TABLE mistakes ADD PRIMARY KEY (user_id, programme_id, id);
ALTER TABLE mock_sessions ADD PRIMARY KEY (user_id, programme_id, id);
ALTER TABLE mock_session_answers ADD PRIMARY KEY (user_id, programme_id, session_id, position);
ALTER TABLE mock_session_answers ADD CONSTRAINT mock_session_answers_programme_session_fkey FOREIGN KEY (user_id, programme_id, session_id) REFERENCES mock_sessions (user_id, programme_id, id) ON DELETE CASCADE;
ALTER TABLE browser_state ADD PRIMARY KEY (user_id, programme_id, key);

DROP INDEX IF EXISTS academic_snapshots_user_hash_idx;
CREATE UNIQUE INDEX IF NOT EXISTS academic_snapshots_user_programme_hash_idx ON academic_snapshots (user_id, programme_id, content_hash);
CREATE INDEX IF NOT EXISTS activity_events_user_programme_created_idx ON activity_events (user_id, programme_id, created_at DESC);
CREATE INDEX IF NOT EXISTS academic_snapshots_user_programme_created_idx ON academic_snapshots (user_id, programme_id, created_at DESC);
