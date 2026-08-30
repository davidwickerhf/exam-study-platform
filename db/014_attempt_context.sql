-- Preserve the course identity and placement that applied to each sitting.
-- A later curriculum can rename, re-code, or move the canonical course
-- without rewriting the student's historical record.
ALTER TABLE academic_attempts ADD COLUMN IF NOT EXISTS course_code TEXT NOT NULL DEFAULT '';
ALTER TABLE academic_attempts ADD COLUMN IF NOT EXISTS course_name TEXT NOT NULL DEFAULT '';
ALTER TABLE academic_attempts ADD COLUMN IF NOT EXISTS ects NUMERIC(6, 2);
ALTER TABLE academic_attempts ADD COLUMN IF NOT EXISTS year_level TEXT NOT NULL DEFAULT '';
ALTER TABLE academic_attempts ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT '';
ALTER TABLE academic_attempts ADD COLUMN IF NOT EXISTS curriculum_version TEXT NOT NULL DEFAULT '';
