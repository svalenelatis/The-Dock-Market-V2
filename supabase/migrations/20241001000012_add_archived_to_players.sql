-- Migration: Add archived column to players table
-- Required by admin panel player management (archive/unarchive functionality)

ALTER TABLE players
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering archived players efficiently
CREATE INDEX IF NOT EXISTS idx_players_archived ON players (archived);
