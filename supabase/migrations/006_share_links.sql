-- Migration: Public Share Links
-- Allows users to create shareable URLs that let anyone view their stats

-- Create share_links table
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

-- Index for fast token lookups (only active links)
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(share_token) WHERE is_active = true;

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_id);

-- Enable RLS
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own share link
CREATE POLICY "Users can view own share link"
  ON share_links FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Authenticated users can create their own share link
CREATE POLICY "Users can insert own share link"
  ON share_links FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Authenticated users can update their own share link
CREATE POLICY "Users can update own share link"
  ON share_links FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Authenticated users can delete their own share link
CREATE POLICY "Users can delete own share link"
  ON share_links FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Anonymous users can validate share tokens (needed for loading shared data)
CREATE POLICY "Anyone can validate active tokens"
  ON share_links FOR SELECT TO anon
  USING (is_active = true);

-- Anonymous read policies for data tables (only when user has active share link)

-- Allow anonymous to view players via active share link
CREATE POLICY "Anon view players via share"
  ON cloud_players FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.owner_id = cloud_players.owner_id
      AND sl.is_active = true
    )
  );

-- Allow anonymous to view matches via active share link
CREATE POLICY "Anon view matches via share"
  ON cloud_matches FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.owner_id = cloud_matches.owner_id
      AND sl.is_active = true
    )
  );

-- Allow anonymous to view match players via active share link
CREATE POLICY "Anon view match_players via share"
  ON cloud_match_players FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.owner_id = cloud_match_players.owner_id
      AND sl.is_active = true
    )
  );

-- Allow anonymous to view profile display name via active share link
CREATE POLICY "Anon view profile via share"
  ON profiles FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.owner_id = profiles.id
      AND sl.is_active = true
    )
  );

-- Function to fetch all shared data in one call (optimized for anonymous viewers)
CREATE OR REPLACE FUNCTION get_shared_data(p_share_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link share_links;
  v_result JSON;
BEGIN
  -- Find the active share link
  SELECT * INTO v_link
  FROM share_links
  WHERE share_token = p_share_token
    AND is_active = true;

  -- Return error if link not found or inactive
  IF v_link IS NULL THEN
    RETURN json_build_object('error', 'Share link not found or inactive');
  END IF;

  -- Update view count and last viewed timestamp
  UPDATE share_links
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE id = v_link.id;

  -- Build and return the complete data object
  SELECT json_build_object(
    'owner_id', v_link.owner_id,
    'display_name', COALESCE(p.display_name, p.username),
    'players', COALESCE(
      (SELECT json_agg(row_to_json(cp))
       FROM cloud_players cp
       WHERE cp.owner_id = v_link.owner_id),
      '[]'::json
    ),
    'matches', COALESCE(
      (SELECT json_agg(row_to_json(cm))
       FROM cloud_matches cm
       WHERE cm.owner_id = v_link.owner_id),
      '[]'::json
    ),
    'match_players', COALESCE(
      (SELECT json_agg(row_to_json(cmp))
       FROM cloud_match_players cmp
       WHERE cmp.owner_id = v_link.owner_id),
      '[]'::json
    )
  ) INTO v_result
  FROM profiles p
  WHERE p.id = v_link.owner_id;

  RETURN v_result;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION get_shared_data(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_shared_data(TEXT) TO authenticated;
