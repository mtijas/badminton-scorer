-- Up Migration

CREATE TYPE score_command_type AS ENUM ('point', 'undo');

CREATE TABLE score_commands (
  match_id uuid NOT NULL REFERENCES matches(id),
  command_id uuid NOT NULL,
  command_type score_command_type NOT NULL,
  awarded_side match_side,
  result_event_sequence integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY (match_id, command_id),
  FOREIGN KEY (match_id, result_event_sequence)
    REFERENCES score_events(match_id, event_sequence),
  CHECK (
    (command_type = 'point' AND awarded_side IS NOT NULL)
    OR (command_type = 'undo' AND awarded_side IS NULL)
  )
);

-- Down Migration
