-- Up Migration

ALTER TABLE games ADD COLUMN is_removed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION enforce_game_projection_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_removed AND EXISTS (
    SELECT 1
    FROM games
    WHERE match_id = NEW.match_id
      AND game_number < NEW.game_number
      AND status <> 'complete'
      AND NOT is_removed
  ) THEN
    RAISE EXCEPTION 'A game cannot follow an incomplete earlier game';
  END IF;

  IF NOT NEW.is_removed AND NEW.status <> 'complete' AND EXISTS (
    SELECT 1
    FROM games
    WHERE match_id = NEW.match_id
      AND game_number > NEW.game_number
      AND status = 'in_progress'
      AND NOT is_removed
  ) THEN
    RAISE EXCEPTION 'An incomplete game cannot precede an in-progress game';
  END IF;

  RETURN NEW;
END;
$$;

-- Down Migration
