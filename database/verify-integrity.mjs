import assert from "node:assert/strict";
import { Client } from "pg";

const connectionString = globalThis.process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to verify database integrity.");
}

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query("BEGIN");

  const homePlayerId = await insertPlayer("Home player");
  const awayPlayerId = await insertPlayer("Away player");
  const matchId = await insertMatch();
  const homeSideId = await insertMatchSide(matchId, "home");
  const awaySideId = await insertMatchSide(matchId, "away");
  await insertMatchSidePlayer(homeSideId, homePlayerId, 1);
  await insertMatchSidePlayer(awaySideId, awayPlayerId, 1);
  const firstGameId = await insertGame(matchId, 1);
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");

  await client.query("SET CONSTRAINTS ALL DEFERRED");
  await expectRejected(async () => {
    await insertMatch();
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  }, "exactly one home side and one away side");

  await client.query("SET CONSTRAINTS ALL DEFERRED");
  await expectRejected(async () => {
    const incompleteMatchId = await insertMatch();
    await insertMatchSide(incompleteMatchId, "home");
    await insertMatchSide(incompleteMatchId, "away");
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  }, "Each match side must have one or two players");

  await expectRejected(
    () => insertMatchSidePlayer(homeSideId, homePlayerId, 3),
    "match_side_players_player_order_check",
  );

  await expectRejected(
    () => insertGame(matchId, 2),
    "A game cannot follow an incomplete earlier game",
  );

  await client.query(
    "UPDATE games SET status = 'complete', winner = 'home', completed_at = current_timestamp WHERE id = $1",
    [firstGameId],
  );
  const secondGameId = await insertGame(matchId, 2);
  await expectRejected(
    () =>
      client.query(
        "UPDATE games SET status = 'in_progress', winner = NULL, completed_at = NULL WHERE id = $1",
        [firstGameId],
      ),
    "An incomplete game cannot precede an in-progress game",
  );

  const firstAwardId = await insertAward(matchId, firstGameId, 1);
  const secondAwardId = await insertAward(matchId, firstGameId, 2);
  await expectRejected(
    () => insertReversal(matchId, secondGameId, 3, secondAwardId),
    "same game",
  );

  const reversalId = await insertReversal(
    matchId,
    firstGameId,
    3,
    firstAwardId,
  );
  await expectRejected(
    () => insertReversal(matchId, firstGameId, 4, firstAwardId),
    "score_events_one_reversal_per_event",
  );
  await expectRejected(
    () => insertReversal(matchId, firstGameId, 4, reversalId),
    "must reference an awarded rally",
  );

  const futureAwardId = await insertAward(matchId, firstGameId, 5);
  await expectRejected(
    () => insertReversal(matchId, firstGameId, 4, futureAwardId),
    "must reference an earlier event",
  );
} finally {
  await client.query("ROLLBACK");
  await client.end();
}

async function expectRejected(run, expectedMessage) {
  await client.query("SAVEPOINT expected_rejection");
  try {
    await assert.rejects(run, new RegExp(expectedMessage));
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_rejection");
  }
}

async function insertPlayer(displayName) {
  const result = await client.query(
    "INSERT INTO players (display_name) VALUES ($1) RETURNING id",
    [displayName],
  );
  return result.rows[0].id;
}

async function insertMatch() {
  const result = await client.query(
    "INSERT INTO matches (scoring_system, initial_server) VALUES ('3x21', 'home') RETURNING id",
  );
  return result.rows[0].id;
}

async function insertMatchSide(matchId, side) {
  const result = await client.query(
    "INSERT INTO match_sides (match_id, side) VALUES ($1, $2) RETURNING id",
    [matchId, side],
  );
  return result.rows[0].id;
}

async function insertMatchSidePlayer(matchSideId, playerId, playerOrder) {
  await client.query(
    "INSERT INTO match_side_players (match_side_id, player_id, player_order) VALUES ($1, $2, $3)",
    [matchSideId, playerId, playerOrder],
  );
}

async function insertGame(matchId, gameNumber) {
  const result = await client.query(
    "INSERT INTO games (match_id, game_number) VALUES ($1, $2) RETURNING id",
    [matchId, gameNumber],
  );
  return result.rows[0].id;
}

async function insertAward(matchId, gameId, eventSequence) {
  const result = await client.query(
    "INSERT INTO score_events (match_id, game_id, event_sequence, event_type, awarded_side) VALUES ($1, $2, $3, 'rally_awarded', 'home') RETURNING id",
    [matchId, gameId, eventSequence],
  );
  return result.rows[0].id;
}

async function insertReversal(matchId, gameId, eventSequence, reversedEventId) {
  const result = await client.query(
    "INSERT INTO score_events (match_id, game_id, event_sequence, event_type, reversed_event_id) VALUES ($1, $2, $3, 'rally_reversed', $4) RETURNING id",
    [matchId, gameId, eventSequence, reversedEventId],
  );
  return result.rows[0].id;
}
