import {
  createScoringState,
  gameWinner,
  matchWinner,
  recordRally,
  type MatchState,
  type ScoringState,
  type Side,
} from "@badminton-scorer/shared";
import type { Pool, PoolClient } from "pg";
import type { MatchRepository } from "./match-repository.js";

interface MatchRow {
  readonly id: string;
  readonly scoring_system: MatchState["scoringSystem"];
  readonly initial_server: Side;
}

interface PlayerRow {
  readonly side: Side;
  readonly display_name: string;
}

interface GameRow {
  readonly id: string;
  readonly game_number: number;
}

interface ScoreEventRow {
  readonly id: string;
  readonly event_type: "rally_awarded" | "rally_reversed";
  readonly awarded_side: Side | null;
  readonly reversed_event_id: string | null;
}

export class PostgresMatchRepository implements MatchRepository {
  public constructor(private readonly pool: Pool) {}

  public async findById(id: string): Promise<MatchState | undefined> {
    const client = await this.pool.connect();
    try {
      return await loadMatch(client, id);
    } finally {
      client.release();
    }
  }

  public async save(match: MatchState): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await loadMatch(client, match.id, true);

      if (existing) {
        await appendScoreEvent(client, existing, match);
        await syncProjection(client, match);
      } else {
        await insertMatch(client, match);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function loadMatch(
  client: PoolClient,
  id: string,
  lock = false,
): Promise<MatchState | undefined> {
  const matchResult = await client.query<MatchRow>(
    `SELECT id, scoring_system, initial_server
     FROM matches
     WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  const match = matchResult.rows[0];
  if (!match) return undefined;

  const [playersResult, eventsResult] = await Promise.all([
    client.query<PlayerRow>(
      `SELECT match_sides.side, players.display_name
       FROM match_sides
       JOIN match_side_players ON match_side_players.match_side_id = match_sides.id
       JOIN players ON players.id = match_side_players.player_id
       WHERE match_sides.match_id = $1
       ORDER BY match_sides.side, match_side_players.player_order`,
      [id],
    ),
    client.query<ScoreEventRow>(
      `SELECT id, event_type, awarded_side, reversed_event_id
       FROM score_events
       WHERE match_id = $1
       ORDER BY event_sequence`,
      [id],
    ),
  ]);

  const homePlayer = playersResult.rows.find(
    (player) => player.side === "home",
  );
  const awayPlayer = playersResult.rows.find(
    (player) => player.side === "away",
  );
  if (!homePlayer || !awayPlayer) {
    throw new Error("Stored match is missing a player.");
  }

  const scoringState = replayEvents(
    match.initial_server,
    match.scoring_system,
    eventsResult.rows,
  );
  const winner = matchWinner(scoringState.games, scoringState.scoringSystem);
  return {
    id: match.id,
    homePlayer: homePlayer.display_name,
    awayPlayer: awayPlayer.display_name,
    ...scoringState,
    status: winner ? "complete" : "in_progress",
    winner,
  };
}

function replayEvents(
  initialServer: Side,
  scoringSystem: MatchState["scoringSystem"],
  events: readonly ScoreEventRow[],
): ScoringState {
  const reversedEventIds = new Set(
    events.flatMap((event) =>
      event.event_type === "rally_reversed" && event.reversed_event_id
        ? [event.reversed_event_id]
        : [],
    ),
  );
  const rallyWinners = events.flatMap((event) =>
    event.event_type === "rally_awarded" &&
    event.awarded_side &&
    !reversedEventIds.has(event.id)
      ? [event.awarded_side]
      : [],
  );

  return rallyWinners.reduce(
    recordRally,
    createScoringState(initialServer, scoringSystem),
  );
}

async function insertMatch(
  client: PoolClient,
  match: MatchState,
): Promise<void> {
  await client.query(
    `INSERT INTO matches (id, scoring_system, initial_server, status, winner, completed_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $4::match_status = 'complete' THEN current_timestamp END)`,
    [
      match.id,
      match.scoringSystem,
      match.initialServer,
      match.status,
      match.winner,
    ],
  );
  await insertSideAndPlayer(client, match.id, "home", match.homePlayer);
  await insertSideAndPlayer(client, match.id, "away", match.awayPlayer);
  await syncProjection(client, match);
}

async function insertSideAndPlayer(
  client: PoolClient,
  matchId: string,
  side: Side,
  playerName: string,
): Promise<void> {
  const playerResult = await client.query<{ id: string }>(
    "INSERT INTO players (display_name) VALUES ($1) RETURNING id",
    [playerName],
  );
  const player = playerResult.rows[0];
  if (!player) throw new Error("Unable to create player.");

  const sideResult = await client.query<{ id: string }>(
    "INSERT INTO match_sides (match_id, side) VALUES ($1, $2) RETURNING id",
    [matchId, side],
  );
  const matchSide = sideResult.rows[0];
  if (!matchSide) throw new Error("Unable to create match side.");

  await client.query(
    `INSERT INTO match_side_players (match_side_id, player_id, player_order)
     VALUES ($1, $2, 1)`,
    [matchSide.id, player.id],
  );
}

async function appendScoreEvent(
  client: PoolClient,
  previous: MatchState,
  next: MatchState,
): Promise<void> {
  const pointDifference =
    next.pointHistory.length - previous.pointHistory.length;
  if (pointDifference === 0) return;
  if (pointDifference !== 1 && pointDifference !== -1) {
    throw new Error("Match updates must add or undo exactly one rally.");
  }

  const sequenceResult = await client.query<{ event_sequence: number }>(
    `SELECT COALESCE(MAX(event_sequence), 0) + 1 AS event_sequence
     FROM score_events
     WHERE match_id = $1`,
    [next.id],
  );
  const eventSequence = sequenceResult.rows[0]?.event_sequence;
  if (eventSequence === undefined)
    throw new Error("Unable to sequence score event.");

  if (pointDifference === 1) {
    const awardedSide = next.pointHistory.at(-1);
    if (!awardedSide) throw new Error("Missing awarded side for rally.");
    const game = await findGame(client, next.id, previous.games.length);
    await client.query(
      `INSERT INTO score_events (match_id, game_id, event_sequence, event_type, awarded_side)
       VALUES ($1, $2, $3, 'rally_awarded', $4)`,
      [next.id, game.id, eventSequence, awardedSide],
    );
    return;
  }

  const awardResult = await client.query<ScoreEventRow>(
    `SELECT awarded.id, awarded.event_type, awarded.awarded_side, awarded.reversed_event_id
     FROM score_events AS awarded
     WHERE awarded.match_id = $1
       AND awarded.event_type = 'rally_awarded'
       AND NOT EXISTS (
         SELECT 1 FROM score_events AS reversal
         WHERE reversal.reversed_event_id = awarded.id
       )
     ORDER BY awarded.event_sequence DESC
     LIMIT 1`,
    [next.id],
  );
  const award = awardResult.rows[0];
  if (!award) throw new Error("There is no stored rally to undo.");
  const game = await findGameForEvent(client, next.id, award.id);
  await client.query(
    `INSERT INTO score_events (match_id, game_id, event_sequence, event_type, reversed_event_id)
     VALUES ($1, $2, $3, 'rally_reversed', $4)`,
    [next.id, game.id, eventSequence, award.id],
  );
}

async function findGame(
  client: PoolClient,
  matchId: string,
  gameNumber: number,
): Promise<GameRow> {
  const result = await client.query<GameRow>(
    "SELECT id, game_number FROM games WHERE match_id = $1 AND game_number = $2",
    [matchId, gameNumber],
  );
  const game = result.rows[0];
  if (!game) throw new Error("Stored match is missing its current game.");
  return game;
}

async function findGameForEvent(
  client: PoolClient,
  matchId: string,
  eventId: string,
): Promise<GameRow> {
  const result = await client.query<GameRow>(
    `SELECT games.id, games.game_number
     FROM games
     JOIN score_events ON score_events.game_id = games.id
     WHERE games.match_id = $1 AND score_events.id = $2`,
    [matchId, eventId],
  );
  const game = result.rows[0];
  if (!game) throw new Error("Stored rally is missing its game.");
  return game;
}

async function syncProjection(
  client: PoolClient,
  match: MatchState,
): Promise<void> {
  await client.query(
    "DELETE FROM games WHERE match_id = $1 AND game_number > $2",
    [match.id, match.games.length],
  );

  const existingGames = await client.query<GameRow>(
    "SELECT id, game_number FROM games WHERE match_id = $1",
    [match.id],
  );
  const existingGameNumbers = new Set(
    existingGames.rows.map((game) => game.game_number),
  );

  for (const [index, score] of match.games.entries()) {
    const gameNumber = index + 1;
    const winner = gameWinner(score, match.scoringSystem);
    const status = winner ? "complete" : "in_progress";
    if (existingGameNumbers.has(gameNumber)) {
      await client.query(
        `UPDATE games
         SET home_score = $3,
             away_score = $4,
             status = $5,
             winner = $6,
             completed_at = CASE
               WHEN $5::game_status = 'complete' THEN COALESCE(completed_at, current_timestamp)
               ELSE NULL
             END
         WHERE match_id = $1 AND game_number = $2`,
        [match.id, gameNumber, score.home, score.away, status, winner],
      );
    } else {
      await client.query(
        `INSERT INTO games (match_id, game_number, home_score, away_score, status, winner, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6,
           CASE WHEN $5::game_status = 'complete' THEN current_timestamp END)`,
        [match.id, gameNumber, score.home, score.away, status, winner],
      );
    }
  }

  await client.query(
    `UPDATE matches
     SET status = $2,
         winner = $3,
         completed_at = CASE
           WHEN $2::match_status = 'complete' THEN COALESCE(completed_at, current_timestamp)
           ELSE NULL
         END
     WHERE id = $1`,
    [match.id, match.status, match.winner],
  );
}
