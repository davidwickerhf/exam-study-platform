-- Policies distributed through institution-wide course shells may support all
-- signed-in university students without republishing the original document.
-- `public` remains reserved for reviewed, externally published originals.

ALTER TABLE programme_policy_sources
  DROP CONSTRAINT IF EXISTS programme_policy_sources_visibility_check;

ALTER TABLE programme_policy_sources
  ADD CONSTRAINT programme_policy_sources_visibility_check
  CHECK (visibility IN ('programme', 'university', 'public'));
