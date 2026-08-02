import {
  gameWinner,
  matchWinner,
  recordRally,
  replayScoreEvents,
  undoRally,
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
  readonly created_at: Date;
}

type ScoreCommandType = "point" | "undo";

interface ScoreCommandRow {
  readonly command_type: ScoreCommandType;
  readonly awarded_side: Side | null;
  readonly result_event_sequence: number;
}

interface WriteCommandResult {
  readonly match: MatchState;
  readonly eventSequence: number;
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

  public async create(match: MatchState): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await insertMatch(client, match);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async recordPoint(
    id: string,
    side: Side,
    commandId: string,
  ): Promise<MatchState | undefined> {
    return this.runWriteCommand(
      id,
      commandId,
      "point",
      side,
      async (client, match) => {
        if (match.status === "complete") {
          throw new Error("Match is already complete.");
        }

        const scoringState = recordRally(match, side);
        const updated = withScoringState(match, scoringState);
        const eventSequence = await appendAwardEvent(client, match, side);
        await syncProjection(client, updated);
        return { match: updated, eventSequence };
      },
    );
  }

  public async undoLatestRally(
    id: string,
    commandId: string,
  ): Promise<MatchState | undefined> {
    return this.runWriteCommand(
      id,
      commandId,
      "undo",
      null,
      async (client, match) => {
        const scoringState = undoRally(match);
        const updated = withScoringState(match, scoringState);
        const eventSequence = await appendReversalEvent(client, match.id);
        await syncProjection(client, updated);
        return { match: updated, eventSequence };
      },
    );
  }

  private async runWriteCommand(
    id: string,
    commandId: string,
    commandType: ScoreCommandType,
    awardedSide: Side | null,
    command: (
      client: PoolClient,
      match: MatchState,
    ) => Promise<WriteCommandResult>,
  ): Promise<MatchState | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const match = await loadMatch(client, id, true);
      if (!match) {
        await client.query("COMMIT");
        return undefined;
      }

      const previousCommand = await findCommand(client, id, commandId);
      if (previousCommand) {
        assertSameCommand(previousCommand, commandType, awardedSide);
        const originalResult = await loadMatch(
          client,
          id,
          false,
          previousCommand.result_event_sequence,
        );
        await client.query("COMMIT");
        return originalResult;
      }

      const result = await command(client, match);
      await insertCommand(
        client,
        id,
        commandId,
        commandType,
        awardedSide,
        result.eventSequence,
      );
      const updatedMatch = await loadMatch(client, id);
      if (!updatedMatch)
        throw new Error("Stored match disappeared after update.");
      await client.query("COMMIT");
      return updatedMatch;
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
  eventSequence?: number,
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
    eventSequence === undefined
      ? client.query<ScoreEventRow>(
          `SELECT id, event_type, awarded_side, reversed_event_id, created_at
           FROM score_events
           WHERE match_id = $1
           ORDER BY event_sequence`,
          [id],
        )
      : client.query<ScoreEventRow>(
          `SELECT id, event_type, awarded_side, reversed_event_id, created_at
           FROM score_events
           WHERE match_id = $1 AND event_sequence <= $2
           ORDER BY event_sequence`,
          [id, eventSequence],
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

  const { scoringState, scoreHistory } = replayScoreEvents(
    match.initial_server,
    match.scoring_system,
    eventsResult.rows.map((event) => ({
      id: event.id,
      type: event.event_type,
      awardedSide: event.awarded_side,
      reversedEventId: event.reversed_event_id,
      occurredAt: event.created_at.toISOString(),
    })),
  );
  const winner = matchWinner(scoringState.games, scoringState.scoringSystem);
  return {
    id: match.id,
    homePlayer: homePlayer.display_name,
    awayPlayer: awayPlayer.display_name,
    ...scoringState,
    status: winner ? "complete" : "in_progress",
    winner,
    scoreHistory,
  };
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

function withScoringState(
  match: MatchState,
  scoringState: ScoringState,
): MatchState {
  const winner = matchWinner(scoringState.games, scoringState.scoringSystem);
  return {
    ...match,
    ...scoringState,
    winner,
    status: winner ? "complete" : "in_progress",
  };
}

async function appendAwardEvent(
  client: PoolClient,
  match: MatchState,
  awardedSide: Side,
): Promise<number> {
  const eventSequence = await nextEventSequence(client, match.id);
  const game = await findGame(client, match.id, match.games.length);
  await client.query(
    `INSERT INTO score_events (match_id, game_id, event_sequence, event_type, awarded_side)
     VALUES ($1, $2, $3, 'rally_awarded', $4)`,
    [match.id, game.id, eventSequence, awardedSide],
  );
  return eventSequence;
}

async function appendReversalEvent(
  client: PoolClient,
  matchId: string,
): Promise<number> {
  const eventSequence = await nextEventSequence(client, matchId);
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
    [matchId],
  );
  const award = awardResult.rows[0];
  if (!award) throw new Error("There is no stored rally to undo.");
  const game = await findGameForEvent(client, matchId, award.id);
  await client.query(
    `INSERT INTO score_events (match_id, game_id, event_sequence, event_type, reversed_event_id)
     VALUES ($1, $2, $3, 'rally_reversed', $4)`,
    [matchId, game.id, eventSequence, award.id],
  );
  return eventSequence;
}

async function findCommand(
  client: PoolClient,
  matchId: string,
  commandId: string,
): Promise<ScoreCommandRow | undefined> {
  const result = await client.query<ScoreCommandRow>(
    `SELECT command_type, awarded_side, result_event_sequence
     FROM score_commands
     WHERE match_id = $1 AND command_id = $2`,
    [matchId, commandId],
  );
  return result.rows[0];
}

function assertSameCommand(
  command: ScoreCommandRow,
  commandType: ScoreCommandType,
  awardedSide: Side | null,
): void {
  if (
    command.command_type !== commandType ||
    command.awarded_side !== awardedSide
  ) {
    throw new Error("Idempotency key is already used for a different command.");
  }
}

async function insertCommand(
  client: PoolClient,
  matchId: string,
  commandId: string,
  commandType: ScoreCommandType,
  awardedSide: Side | null,
  eventSequence: number,
): Promise<void> {
  await client.query(
    `INSERT INTO score_commands (
       match_id,
       command_id,
       command_type,
       awarded_side,
       result_event_sequence
     ) VALUES ($1, $2, $3, $4, $5)`,
    [matchId, commandId, commandType, awardedSide, eventSequence],
  );
}

async function nextEventSequence(
  client: PoolClient,
  matchId: string,
): Promise<number> {
  const sequenceResult = await client.query<{ event_sequence: number }>(
    `SELECT COALESCE(MAX(event_sequence), 0) + 1 AS event_sequence
     FROM score_events
     WHERE match_id = $1`,
    [matchId],
  );
  const eventSequence = sequenceResult.rows[0]?.event_sequence;
  if (eventSequence === undefined) {
    throw new Error("Unable to sequence score event.");
  }
  return eventSequence;
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
