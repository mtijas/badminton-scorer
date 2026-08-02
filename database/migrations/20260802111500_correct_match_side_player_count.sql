-- Up Migration

CREATE OR REPLACE FUNCTION validate_match_composition(target_match_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  side_count integer;
  side_player_count integer;
BEGIN
  SELECT count(*)
    INTO side_count
    FROM match_sides
    WHERE match_id = target_match_id;

  IF side_count <> 2 THEN
    RAISE EXCEPTION 'A match must have exactly one home side and one away side';
  END IF;

  FOR side_player_count IN
    SELECT count(match_side_players.player_id)
      FROM match_sides
      LEFT JOIN match_side_players
        ON match_side_players.match_side_id = match_sides.id
      WHERE match_sides.match_id = target_match_id
      GROUP BY match_sides.id
  LOOP
    IF side_player_count NOT BETWEEN 1 AND 2 THEN
      RAISE EXCEPTION 'Each match side must have one or two players';
    END IF;
  END LOOP;
END;
$$;

-- Down Migration
