-- Up Migration

CREATE FUNCTION validate_match_composition(target_match_id uuid)
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
    SELECT count(*)
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

CREATE FUNCTION enforce_match_composition_from_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM validate_match_composition(NEW.id);
  RETURN NULL;
END;
$$;

CREATE FUNCTION enforce_match_composition_from_match_side()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM validate_match_composition(OLD.match_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM validate_match_composition(NEW.match_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION enforce_match_composition_from_match_side_player()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_match_id uuid;
  new_match_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT match_id
      INTO old_match_id
      FROM match_sides
      WHERE id = OLD.match_side_id;
    IF old_match_id IS NOT NULL THEN
      PERFORM validate_match_composition(old_match_id);
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT match_id
      INTO new_match_id
      FROM match_sides
      WHERE id = NEW.match_side_id;
    IF new_match_id IS NOT NULL THEN
      PERFORM validate_match_composition(new_match_id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER matches_require_complete_composition
  AFTER INSERT ON matches
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_match_composition_from_match();

CREATE CONSTRAINT TRIGGER match_sides_require_complete_composition
  AFTER INSERT OR UPDATE OR DELETE ON match_sides
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_match_composition_from_match_side();

CREATE CONSTRAINT TRIGGER match_side_players_require_complete_composition
  AFTER INSERT OR UPDATE OR DELETE ON match_side_players
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_match_composition_from_match_side_player();

CREATE UNIQUE INDEX games_one_in_progress_game_per_match
  ON games (match_id)
  WHERE status = 'in_progress';

CREATE FUNCTION enforce_game_projection_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM games
      WHERE match_id = NEW.match_id
        AND game_number < NEW.game_number
        AND status <> 'complete'
  ) THEN
    RAISE EXCEPTION 'A game cannot follow an incomplete earlier game';
  END IF;

  IF NEW.status <> 'complete' AND EXISTS (
    SELECT 1
      FROM games
      WHERE match_id = NEW.match_id
        AND game_number > NEW.game_number
        AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'An incomplete game cannot precede an in-progress game';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER games_projection_order_check
  BEFORE INSERT OR UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION enforce_game_projection_order();

CREATE OR REPLACE FUNCTION score_event_reversal_targets_award()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_event score_events%ROWTYPE;
BEGIN
  IF NEW.event_type = 'rally_reversed' THEN
    SELECT *
      INTO target_event
      FROM score_events
      WHERE id = NEW.reversed_event_id AND match_id = NEW.match_id;

    IF target_event.event_type IS DISTINCT FROM 'rally_awarded' THEN
      RAISE EXCEPTION 'A rally reversal must reference an awarded rally';
    END IF;

    IF target_event.game_id IS DISTINCT FROM NEW.game_id THEN
      RAISE EXCEPTION 'A rally reversal must reference an awarded rally in the same game';
    END IF;

    IF target_event.event_sequence >= NEW.event_sequence THEN
      RAISE EXCEPTION 'A rally reversal must reference an earlier event';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Down Migration
