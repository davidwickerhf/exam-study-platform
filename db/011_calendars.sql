-- Saved calendar links (timetables, exam schedules) per academic programme.
ALTER TABLE academic_programmes ADD COLUMN IF NOT EXISTS calendars JSONB NOT NULL DEFAULT '[]'::jsonb;
