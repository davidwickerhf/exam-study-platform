-- Programme organisations: who belongs to which editorial programme, and in
-- which role. Students are placed automatically from their email domain.
CREATE TABLE IF NOT EXISTS programme_memberships (
  user_id TEXT NOT NULL,
  programme_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, programme_id)
);
CREATE INDEX IF NOT EXISTS programme_memberships_programme_idx ON programme_memberships (programme_id, role);
