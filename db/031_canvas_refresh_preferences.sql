-- Scheduling is an account preference, independent from collection/sharing consent.
ALTER TABLE canvas_corpus_permissions
  ADD COLUMN IF NOT EXISTS refresh_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS refresh_updates_minutes integer NOT NULL DEFAULT 30 CHECK (refresh_updates_minutes IN (15,30,60,180,360,1440)),
  ADD COLUMN IF NOT EXISTS refresh_materials_minutes integer NOT NULL DEFAULT 360 CHECK (refresh_materials_minutes IN (60,360,720,1440,10080)),
  ADD COLUMN IF NOT EXISTS study_status text NOT NULL DEFAULT 'studying' CHECK (study_status IN ('studying','completed')),
  ADD COLUMN IF NOT EXISTS updates_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_policy jsonb NOT NULL DEFAULT '{}'::jsonb;
