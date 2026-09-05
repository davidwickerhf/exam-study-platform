-- Preserve the printed award separately from attempted and catalogue credits.
ALTER TABLE academic_attempts ADD COLUMN IF NOT EXISTS credits_earned NUMERIC(6, 2);

-- A stopped edition stays paused until the student explicitly retries it.
ALTER TABLE canvas_corpus_access ADD COLUMN IF NOT EXISTS sync_paused BOOLEAN NOT NULL DEFAULT false;
