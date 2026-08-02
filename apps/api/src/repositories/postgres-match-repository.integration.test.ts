import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import type { MatchState } from "@badminton-scorer/shared";
import { buildApp } from "../app.js";
import { PostgresMatchRepository } from "./postgres-match-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

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
});
