-- Add RPC function for edge function to fetch match data

CREATE OR REPLACE FUNCTION get_hero_skill_match_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(d))
  INTO result
  FROM hero_skill_match_data d;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_hero_skill_match_data TO service_role;
