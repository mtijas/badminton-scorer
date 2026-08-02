-- Up Migration
DROP INDEX games_one_in_progress_game_per_match;

CREATE UNIQUE INDEX games_one_in_progress_game_per_match
  ON games (match_id)
  WHERE status = 'in_progress' AND NOT is_removed;

-- Down Migration
