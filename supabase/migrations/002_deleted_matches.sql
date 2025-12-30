-- Migration: Create deleted_matches tombstone table
-- Purpose: Track deleted matches to prevent "zombie matches" during multi-device sync
-- Run this in Supabase SQL Editor

-- Create the tombstone table
CREATE TABLE IF NOT EXISTS deleted_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  UNIQUE(owner_id, match_id)
);

-- Index for efficient lookup by owner
CREATE INDEX IF NOT EXISTS idx_deleted_matches_owner ON deleted_matches(owner_id);

-- Enable Row Level Security
ALTER TABLE deleted_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own tombstones
CREATE POLICY "Users can view own tombstones"
  ON deleted_matches FOR SELECT
  USING (auth.uid() = owner_id);

-- RLS Policy: Users can insert their own tombstones
CREATE POLICY "Users can insert own tombstones"
  ON deleted_matches FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- RLS Policy: Users can delete their own tombstones (for potential future "undelete" feature)
CREATE POLICY "Users can delete own tombstones"
  ON deleted_matches FOR DELETE
  USING (auth.uid() = owner_id);

-- Grant permissions
GRANT ALL ON deleted_matches TO authenticated;
