-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE match_side AS ENUM ('home', 'away');
CREATE TYPE scoring_system AS ENUM ('3x21', '3x15');
CREATE TYPE match_status AS ENUM ('in_progress', 'complete');
CREATE TYPE game_status AS ENUM ('in_progress', 'complete');
CREATE TYPE score_event_type AS ENUM ('rally_awarded', 'rally_reversed');

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(80) NOT NULL CHECK (btrim(display_name) <> ''),
  created_at timestamptz NOT NULL DEFAULT current_timestamp
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoring_system scoring_system NOT NULL,
  initial_server match_side NOT NULL,
  status match_status NOT NULL DEFAULT 'in_progress',
  winner match_side,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  completed_at timestamptz,
  CHECK (
    (status = 'in_progress' AND winner IS NULL AND completed_at IS NULL)
    OR (status = 'complete' AND winner IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE TABLE match_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id),
  side match_side NOT NULL,
  UNIQUE (id, match_id),
  UNIQUE (match_id, side)
);

CREATE TABLE match_side_players (
  match_side_id uuid NOT NULL REFERENCES match_sides(id),
  player_id uuid NOT NULL REFERENCES players(id),
  player_order smallint NOT NULL CHECK (player_order BETWEEN 1 AND 2),
  PRIMARY KEY (match_side_id, player_id),
  UNIQUE (match_side_id, player_order)
);

CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id),
  game_number smallint NOT NULL CHECK (game_number BETWEEN 1 AND 3),
  status game_status NOT NULL DEFAULT 'in_progress',
  home_score smallint NOT NULL DEFAULT 0 CHECK (home_score BETWEEN 0 AND 30),
  away_score smallint NOT NULL DEFAULT 0 CHECK (away_score BETWEEN 0 AND 30),
  winner match_side,
  completed_at timestamptz,
  UNIQUE (id, match_id),
  UNIQUE (match_id, game_number),
  CHECK (
    (status = 'in_progress' AND winner IS NULL AND completed_at IS NULL)
    OR (status = 'complete' AND winner IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE TABLE score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id),
  game_id uuid NOT NULL,
  event_sequence integer NOT NULL CHECK (event_sequence > 0),
  event_type score_event_type NOT NULL,
  awarded_side match_side,
  reversed_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE (id, match_id),
  UNIQUE (match_id, event_sequence),
  FOREIGN KEY (game_id, match_id) REFERENCES games(id, match_id),
  FOREIGN KEY (reversed_event_id, match_id) REFERENCES score_events(id, match_id),
  CHECK (
    (event_type = 'rally_awarded' AND awarded_side IS NOT NULL AND reversed_event_id IS NULL)
    OR (
      event_type = 'rally_reversed'
      AND awarded_side IS NULL
      AND reversed_event_id IS NOT NULL
      AND reversed_event_id <> id
    )
  )
);

CREATE UNIQUE INDEX score_events_one_reversal_per_event
  ON score_events (reversed_event_id)
  WHERE reversed_event_id IS NOT NULL;

CREATE INDEX score_events_match_replay_index
  ON score_events (match_id, event_sequence);

CREATE INDEX match_side_players_player_history_index
  ON match_side_players (player_id, match_side_id);

CREATE FUNCTION score_event_reversal_targets_award()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_event_type score_event_type;
BEGIN
  IF NEW.event_type = 'rally_reversed' THEN
    SELECT event_type
      INTO target_event_type
      FROM score_events
      WHERE id = NEW.reversed_event_id AND match_id = NEW.match_id;

    IF target_event_type IS DISTINCT FROM 'rally_awarded' THEN
      RAISE EXCEPTION 'A rally reversal must reference an awarded rally in the same match';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER score_events_reversal_target_check
  BEFORE INSERT ON score_events
  FOR EACH ROW
  EXECUTE FUNCTION score_event_reversal_targets_award();

CREATE FUNCTION prevent_score_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Score events are append-only';
END;
$$;

CREATE TRIGGER score_events_append_only
  BEFORE UPDATE OR DELETE ON score_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_score_event_mutation();

-- Down Migration
