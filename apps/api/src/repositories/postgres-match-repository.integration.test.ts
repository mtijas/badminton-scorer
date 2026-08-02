import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import type { MatchState } from "@badminton-scorer/shared";
import { buildApp as buildApplication, type BuildAppOptions } from "../app.js";
import { PostgresMatchRepository } from "./postgres-match-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = await buildApplication(options);
  app.addHook("onRequest", async (request) => {
    if (
      request.method === "POST" &&
      (/\/points$/.test(request.url) || /\/undo$/.test(request.url)) &&
      request.headers["idempotency-key"] === undefined
    ) {
      request.headers["idempotency-key"] = crypto.randomUUID();
    }
  });
  return app;
}

describeWithDatabase("PostgresMatchRepository", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const apps: FastifyInstance[] = [];

  beforeAll(async () => {
    await pool.query(
      "TRUNCATE score_events, games, match_side_players, match_sides, matches, players CASCADE",
    );
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    await pool.query(
      "TRUNCATE score_events, games, match_side_players, match_sides, matches, players CASCADE",
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists replayable rally history and records undo as a reversal event", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x21",
      },
    });
    const match = createResponse.json<MatchState>();

    await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "home" },
    });
    await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "away" },
    });

    // Act
    const undoResponse = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
    });
    const reloaded = await new PostgresMatchRepository(pool).findById(match.id);
    const events = await pool.query<{
      readonly event_type: string;
      readonly awarded_side: string | null;
    }>(
      `SELECT event_type, awarded_side
       FROM score_events
       WHERE match_id = $1
       ORDER BY event_sequence`,
      [match.id],
    );

    // Assert
    expect(undoResponse.statusCode).toBe(200);
    expect(reloaded?.pointHistory).toEqual(["home"]);
    expect(reloaded?.games).toEqual([{ home: 1, away: 0 }]);
    expect(events.rows).toEqual([
      { event_type: "rally_awarded", awarded_side: "home" },
      { event_type: "rally_awarded", awarded_side: "away" },
      { event_type: "rally_reversed", awarded_side: null },
    ]);
  });

  it("restores a completed game projection when its winning rally is undone", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x15",
      },
    });
    const match = createResponse.json<MatchState>();
    for (let rally = 0; rally < 15; rally += 1) {
      const response = await app.inject({
        method: "POST",
        url: `/matches/${match.id}/points`,
        payload: { side: "home" },
      });
      expect(response.statusCode).toBe(200);
    }

    // Act
    const undoResponse = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
    });
    const games = await pool.query<{
      readonly game_number: number;
      readonly home_score: number;
      readonly away_score: number;
      readonly status: string;
    }>(
      `SELECT game_number, home_score, away_score, status
       FROM games
       WHERE match_id = $1
       ORDER BY game_number`,
      [match.id],
    );

    // Assert
    expect(undoResponse.statusCode).toBe(200);
    expect(undoResponse.json<MatchState>().games).toEqual([
      { home: 14, away: 0 },
    ]);
    expect(games.rows).toEqual([
      {
        game_number: 1,
        home_score: 14,
        away_score: 0,
        status: "in_progress",
      },
    ]);
  });

  it("undoes across a game boundary after the next game's point is undone", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x15",
      },
    });
    const match = createResponse.json<MatchState>();
    for (let rally = 0; rally < 15; rally += 1) {
      const response = await app.inject({
        method: "POST",
        url: `/matches/${match.id}/points`,
        payload: { side: "home" },
      });
      expect(response.statusCode).toBe(200);
    }
    const nextGamePoint = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "away" },
    });
    expect(nextGamePoint.statusCode).toBe(200);
    const undoNextGamePoint = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
    });
    expect(undoNextGamePoint.json<MatchState>().games).toEqual([
      { home: 15, away: 0 },
      { home: 0, away: 0 },
    ]);

    // Act
    const undoWinningPoint = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
    });
    const eventReferences = await pool.query<{
      readonly invalid_count: string;
    }>(
      `SELECT count(*) AS invalid_count
       FROM score_events
       LEFT JOIN games ON games.id = score_events.game_id
       WHERE score_events.match_id = $1 AND games.id IS NULL`,
      [match.id],
    );
    const retiredGame = await pool.query<{ readonly is_removed: boolean }>(
      `SELECT is_removed
       FROM games
       WHERE match_id = $1 AND game_number = 2`,
      [match.id],
    );

    // Assert
    expect(undoWinningPoint.statusCode).toBe(200);
    expect(undoWinningPoint.json<MatchState>()).toMatchObject({
      games: [{ home: 14, away: 0 }],
      status: "in_progress",
      winner: null,
    });
    expect(eventReferences.rows).toEqual([{ invalid_count: "0" }]);
    expect(retiredGame.rows).toEqual([{ is_removed: true }]);
  });

  it("serializes concurrent point commands without losing either rally", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x21",
      },
    });
    const match = createResponse.json<MatchState>();

    // Act
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/matches/${match.id}/points`,
        payload: { side: "home" },
      }),
      app.inject({
        method: "POST",
        url: `/matches/${match.id}/points`,
        payload: { side: "away" },
      }),
    ]);
    const reloaded = await new PostgresMatchRepository(pool).findById(match.id);
    const events = await pool.query<{
      readonly event_sequence: number;
      readonly awarded_side: "home" | "away";
    }>(
      `SELECT event_sequence, awarded_side
       FROM score_events
       WHERE match_id = $1
       ORDER BY event_sequence`,
      [match.id],
    );

    // Assert
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 200,
    ]);
    expect(reloaded?.pointHistory).toHaveLength(2);
    expect(reloaded?.games).toEqual([{ home: 1, away: 1 }]);
    expect(events.rows).toEqual([
      { event_sequence: 1, awarded_side: expect.any(String) },
      { event_sequence: 2, awarded_side: expect.any(String) },
    ]);
    expect(events.rows.map((event) => event.awarded_side).sort()).toEqual([
      "away",
      "home",
    ]);
  });

  it("replays a completed match and restores it when the winning rally is undone", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x15",
      },
    });
    const match = createResponse.json<MatchState>();
    for (let rally = 0; rally < 30; rally += 1) {
      const response = await app.inject({
        method: "POST",
        url: `/matches/${match.id}/points`,
        payload: { side: "home" },
      });
      expect(response.statusCode).toBe(200);
    }

    // Act
    const undoResponse = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
    });
    const reloaded = await new PostgresMatchRepository(pool).findById(match.id);
    const events = await pool.query<{
      readonly event_type: string;
    }>(
      `SELECT event_type
       FROM score_events
       WHERE match_id = $1
       ORDER BY event_sequence`,
      [match.id],
    );

    // Assert
    expect(undoResponse.statusCode).toBe(200);
    expect(reloaded).toMatchObject({
      status: "in_progress",
      winner: null,
      games: [
        { home: 15, away: 0 },
        { home: 14, away: 0 },
      ],
    });
    expect(events.rows).toHaveLength(31);
    expect(events.rows.at(-1)).toEqual({ event_type: "rally_reversed" });
  });

  it("rejects reversing the same awarded rally twice", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x21",
      },
    });
    const match = createResponse.json<MatchState>();
    await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "home" },
    });
    await app.inject({ method: "POST", url: `/matches/${match.id}/undo` });
    const reversal = await pool.query<{
      readonly game_id: string;
      readonly reversed_event_id: string;
    }>(
      `SELECT game_id, reversed_event_id
       FROM score_events
       WHERE match_id = $1 AND event_type = 'rally_reversed'`,
      [match.id],
    );
    const originalReversal = reversal.rows[0];
    if (!originalReversal) throw new Error("Expected a stored rally reversal.");

    // Act
    const insertDuplicateReversal = pool.query(
      `INSERT INTO score_events (match_id, game_id, event_sequence, event_type, reversed_event_id)
       VALUES ($1, $2, 3, 'rally_reversed', $3)`,
      [match.id, originalReversal.game_id, originalReversal.reversed_event_id],
    );

    // Assert
    await expect(insertDuplicateReversal).rejects.toThrow(/duplicate key/i);
  });

  it("returns the original point result when a command is retried", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x21",
      },
    });
    const match = createResponse.json<MatchState>();
    const commandId = "11111111-1111-4111-8111-111111111111";

    // Act
    const firstResponse = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      headers: { "Idempotency-Key": commandId },
      payload: { side: "home" },
    });
    const restartedApp = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(restartedApp);
    const retryResponse = await restartedApp.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      headers: { "Idempotency-Key": commandId },
      payload: { side: "home" },
    });
    const laterResponse = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      headers: {
        "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
      },
      payload: { side: "home" },
    });
    const events = await pool.query<{ readonly event_sequence: number }>(
      `SELECT event_sequence
       FROM score_events
       WHERE match_id = $1
       ORDER BY event_sequence`,
      [match.id],
    );
    const reloaded = await new PostgresMatchRepository(pool).findById(match.id);

    // Assert
    expect(firstResponse.statusCode).toBe(200);
    expect(retryResponse.json()).toEqual(firstResponse.json());
    expect(laterResponse.json<MatchState>().games).toEqual([
      { home: 2, away: 0 },
    ]);
    expect(events.rows).toEqual([{ event_sequence: 1 }, { event_sequence: 2 }]);
    expect(reloaded?.pointHistory).toEqual(["home", "home"]);
  });

  it("returns the original undo result when a command is retried", async () => {
    // Arrange
    const app = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: {
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "home",
        scoringSystem: "3x21",
      },
    });
    const match = createResponse.json<MatchState>();
    await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      headers: {
        "Idempotency-Key": "33333333-3333-4333-8333-333333333333",
      },
      payload: { side: "home" },
    });
    const commandId = "44444444-4444-4444-8444-444444444444";

    // Act
    const firstResponse = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
      headers: { "Idempotency-Key": commandId },
    });
    const restartedApp = await buildApp({
      matchRepository: new PostgresMatchRepository(pool),
    });
    apps.push(restartedApp);
    const retryResponse = await restartedApp.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
      headers: { "Idempotency-Key": commandId },
    });
    const events = await pool.query<{ readonly event_type: string }>(
      `SELECT event_type
       FROM score_events
       WHERE match_id = $1
       ORDER BY event_sequence`,
      [match.id],
    );
    const reloaded = await new PostgresMatchRepository(pool).findById(match.id);

    // Assert
    expect(firstResponse.statusCode).toBe(200);
    expect(retryResponse.json()).toEqual(firstResponse.json());
    expect(events.rows).toEqual([
      { event_type: "rally_awarded" },
      { event_type: "rally_reversed" },
    ]);
    expect(reloaded?.pointHistory).toEqual([]);
  });
});
