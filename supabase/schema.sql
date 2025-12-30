-- ============================================
-- GUARDS OF ATLANTIS II TIMER - CLOUD SYNC SCHEMA
-- Run this in the Supabase SQL Editor
-- ============================================

-- ============================================
-- USER PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  share_stats_with_friends BOOLEAN DEFAULT true,
  share_match_history_with_friends BOOLEAN DEFAULT true,
  device_id TEXT,
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_username_lower ON profiles(LOWER(username));

-- ============================================
-- FRIENDS TABLE
-- ============================================
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_friendship UNIQUE (user_id, friend_id),
  CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);

-- ============================================
-- FRIEND REQUESTS TABLE
-- ============================================
CREATE TABLE friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT unique_pending_request UNIQUE (from_user_id, to_user_id),
  CONSTRAINT no_self_request CHECK (from_user_id != to_user_id)
);

CREATE INDEX idx_friend_requests_to_user ON friend_requests(to_user_id) WHERE status = 'pending';
CREATE INDEX idx_friend_requests_from_user ON friend_requests(from_user_id);

-- ============================================
-- CLOUD PLAYERS TABLE
-- ============================================
CREATE TABLE cloud_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  name TEXT NOT NULL,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  elo INTEGER DEFAULT 1200,
  mu DECIMAL,
  sigma DECIMAL,
  ordinal DECIMAL,
  last_played TIMESTAMPTZ,
  date_created TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  level INTEGER,
  sync_source TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_per_owner UNIQUE (owner_id, local_id)
);

CREATE INDEX idx_cloud_players_owner ON cloud_players(owner_id);
CREATE INDEX idx_cloud_players_name ON cloud_players(name);
CREATE INDEX idx_cloud_players_sync_source ON cloud_players(sync_source);

-- ============================================
-- CLOUD MATCHES TABLE
-- ============================================
CREATE TABLE cloud_matches (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  winning_team TEXT NOT NULL CHECK (winning_team IN ('titans', 'atlanteans')),
  game_length TEXT NOT NULL CHECK (game_length IN ('quick', 'long')),
  double_lanes BOOLEAN DEFAULT false,
  titan_players INTEGER NOT NULL,
  atlantean_players INTEGER NOT NULL,
  device_id TEXT,
  sync_source TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_match_per_owner UNIQUE (owner_id, id)
);

CREATE INDEX idx_cloud_matches_owner ON cloud_matches(owner_id);
CREATE INDEX idx_cloud_matches_date ON cloud_matches(date DESC);
CREATE INDEX idx_cloud_matches_sync_source ON cloud_matches(sync_source);

-- ============================================
-- CLOUD MATCH PLAYERS TABLE
-- ============================================
CREATE TABLE cloud_match_players (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('titans', 'atlanteans')),
  hero_id INTEGER NOT NULL,
  hero_name TEXT NOT NULL,
  hero_roles TEXT[] NOT NULL,
  kills INTEGER,
  deaths INTEGER,
  assists INTEGER,
  gold_earned INTEGER,
  minion_kills INTEGER,
  level INTEGER,
  device_id TEXT,
  sync_source TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (owner_id, match_id) REFERENCES cloud_matches(owner_id, id) ON DELETE CASCADE,
  CONSTRAINT unique_match_player_per_owner UNIQUE (owner_id, id)
);

CREATE INDEX idx_cloud_match_players_owner ON cloud_match_players(owner_id);
CREATE INDEX idx_cloud_match_players_match ON cloud_match_players(match_id);
CREATE INDEX idx_cloud_match_players_player ON cloud_match_players(player_id);

-- ============================================
-- SYNC LOG TABLE
-- ============================================
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  source TEXT,
  records_processed INTEGER DEFAULT 0,
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_log_user ON sync_log(user_id);
CREATE INDEX idx_sync_log_created ON sync_log(started_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- PROFILES RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view friend profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friends
      WHERE (user_id = auth.uid() AND friend_id = profiles.id)
         OR (friend_id = auth.uid() AND user_id = profiles.id)
    )
  );

CREATE POLICY "Users can search profiles by username"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- FRIENDS RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
  ON friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friendships"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- FRIEND REQUESTS RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friend requests"
  ON friend_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can respond to friend requests"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = to_user_id);

CREATE POLICY "Users can cancel own requests"
  ON friend_requests FOR DELETE
  USING (auth.uid() = from_user_id);

-- CLOUD PLAYERS RLS
ALTER TABLE cloud_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own players"
  ON cloud_players FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view friend players"
  ON cloud_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friends f
      JOIN profiles p ON p.id = cloud_players.owner_id
      WHERE ((f.user_id = auth.uid() AND f.friend_id = cloud_players.owner_id)
         OR (f.friend_id = auth.uid() AND f.user_id = cloud_players.owner_id))
        AND p.share_stats_with_friends = true
    )
  );

CREATE POLICY "Users can insert own players"
  ON cloud_players FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own players"
  ON cloud_players FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own players"
  ON cloud_players FOR DELETE
  USING (auth.uid() = owner_id);

-- CLOUD MATCHES RLS
ALTER TABLE cloud_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matches"
  ON cloud_matches FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view friend matches"
  ON cloud_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friends f
      JOIN profiles p ON p.id = cloud_matches.owner_id
      WHERE ((f.user_id = auth.uid() AND f.friend_id = cloud_matches.owner_id)
         OR (f.friend_id = auth.uid() AND f.user_id = cloud_matches.owner_id))
        AND p.share_match_history_with_friends = true
    )
  );

CREATE POLICY "Users can insert own matches"
  ON cloud_matches FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own matches"
  ON cloud_matches FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own matches"
  ON cloud_matches FOR DELETE
  USING (auth.uid() = owner_id);

-- CLOUD MATCH PLAYERS RLS
ALTER TABLE cloud_match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own match players"
  ON cloud_match_players FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view friend match players"
  ON cloud_match_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friends f
      JOIN profiles p ON p.id = cloud_match_players.owner_id
      WHERE ((f.user_id = auth.uid() AND f.friend_id = cloud_match_players.owner_id)
         OR (f.friend_id = auth.uid() AND f.user_id = cloud_match_players.owner_id))
        AND p.share_match_history_with_friends = true
    )
  );

CREATE POLICY "Users can insert own match players"
  ON cloud_match_players FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own match players"
  ON cloud_match_players FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own match players"
  ON cloud_match_players FOR DELETE
  USING (auth.uid() = owner_id);

-- SYNC LOG RLS
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync logs"
  ON sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync logs"
  ON sync_log FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Function to accept friend request and create bidirectional friendship
CREATE OR REPLACE FUNCTION accept_friend_request(request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_from_user UUID;
  v_to_user UUID;
BEGIN
  SELECT from_user_id, to_user_id INTO v_from_user, v_to_user
  FROM friend_requests
  WHERE id = request_id AND to_user_id = auth.uid() AND status = 'pending';

  IF v_from_user IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE friend_requests
  SET status = 'accepted', responded_at = NOW()
  WHERE id = request_id;

  INSERT INTO friends (user_id, friend_id)
  VALUES (v_from_user, v_to_user)
  ON CONFLICT DO NOTHING;

  INSERT INTO friends (user_id, friend_id)
  VALUES (v_to_user, v_from_user)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check username availability
CREATE OR REPLACE FUNCTION check_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles WHERE LOWER(username) = LOWER(check_username)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users by username (limited fields for privacy)
CREATE OR REPLACE FUNCTION search_users(search_query TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM profiles p
  WHERE LOWER(p.username) LIKE LOWER(search_query || '%')
    AND p.id != auth.uid()
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on profile changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
