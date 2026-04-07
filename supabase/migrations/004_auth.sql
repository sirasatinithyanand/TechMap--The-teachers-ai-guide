-- Add password auth to professors
ALTER TABLE professors ADD COLUMN IF NOT EXISTS password_hash TEXT;
