-- ============================================
-- ACCOUNT DELETION FUNCTIONS
-- Run this in the Supabase SQL Editor after the initial schema
-- ============================================

-- ============================================
-- Function to delete user's cloud data only
-- (keeps account and profile intact)
-- ============================================
CREATE OR REPLACE FUNCTION delete_own_cloud_data()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  -- Verify user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete cloud data (order matters for foreign keys)
  DELETE FROM cloud_match_players WHERE owner_id = current_user_id;
  DELETE FROM cloud_matches WHERE owner_id = current_user_id;
  DELETE FROM cloud_players WHERE owner_id = current_user_id;

  -- Clear sync logs
  DELETE FROM sync_log WHERE user_id = current_user_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_own_cloud_data() TO authenticated;

-- ============================================
-- Function to completely delete user account
-- This deletes from auth.users which cascades to all other tables
-- ============================================
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  -- Verify user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete cloud data first (these reference profiles)
  DELETE FROM cloud_match_players WHERE owner_id = current_user_id;
  DELETE FROM cloud_matches WHERE owner_id = current_user_id;
  DELETE FROM cloud_players WHERE owner_id = current_user_id;
  DELETE FROM sync_log WHERE user_id = current_user_id;

  -- Delete friend relationships (these reference profiles)
  DELETE FROM friends WHERE user_id = current_user_id OR friend_id = current_user_id;

  -- Delete friend requests (these reference profiles)
  DELETE FROM friend_requests WHERE from_user_id = current_user_id OR to_user_id = current_user_id;

  -- Delete the profile explicitly (before auth.users to avoid FK issues)
  DELETE FROM profiles WHERE id = current_user_id;

  -- Delete the auth user - this is the key step that requires SECURITY DEFINER
  -- This will also invalidate all sessions for this user
  DELETE FROM auth.users WHERE id = current_user_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

-- ============================================
-- Verify the functions are created correctly
-- ============================================
-- You can test by running:
-- SELECT delete_own_cloud_data();  -- Deletes only cloud data
-- SELECT delete_own_account();     -- Deletes entire account (BE CAREFUL!)
