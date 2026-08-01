import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { MatchState, Side } from "@badminton-scorer/shared";
import { buildApp } from "./app.js";

const whitespaceOnlyNameCases = [
  { player: "home", homePlayer: " \t ", awayPlayer: "Kai" },
  { player: "away", homePlayer: "Aino", awayPlayer: "\n " },
] as const;

const homeGameWinningRallies = [
  ...Array<Side>(20).fill("home"),
  ...Array<Side>(15).fill("away"),
  "home" as const,
];

describe("match API", () => {
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates a match with trimmed player names and an initial scoring state", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: " Aino ", awayPlayer: "Kai " },
    });

    // Assert
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String),
      homePlayer: "Aino",
      awayPlayer: "Kai",
      initialServer: "home",
      servingSide: "home",
      games: [{ home: 0, away: 0 }],
      pointHistory: [],
      status: "in_progress",
      winner: null,
    });
  });

  it("returns serving side and point history after recording a point", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();

    // Act
    const pointResponse = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "away" },
    });
    const updatedMatch = pointResponse.json<MatchState>();

    // Assert
    expect(createResponse.statusCode).toBe(201);
    expect(updatedMatch.initialServer).toBe("home");
    expect(updatedMatch.servingSide).toBe("away");
    expect(updatedMatch.games).toEqual([{ home: 0, away: 1 }]);
    expect(updatedMatch.pointHistory).toEqual(["away"]);
  });

  it.each(whitespaceOnlyNameCases)(
    "rejects a whitespace-only $player player name",
    async ({ homePlayer, awayPlayer }) => {
      // Arrange
      const app = await buildApp();
      apps.push(app);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/matches",
        payload: { homePlayer, awayPlayer },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Both player names are required.",
      });
    },
  );

  it("returns not found for an unknown match ID", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/matches/does-not-exist",
    });

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Match not found." });
  });

  it("rejects an invalid side when recording a point", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();

    // Act
    const response = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "visitor" },
    });

    // Assert
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "side must be home or away." });
  });

  it("rejects points recorded after match completion", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();
    await recordRallies(app, match.id, [
      ...homeGameWinningRallies,
      ...homeGameWinningRallies,
    ]);

    // Act
    const response = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "away" },
    });

    // Assert
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Match is already complete." });
  });

  it("rejects undo when no rallies have been recorded", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();

    // Act
    const response = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/undo`,
    });

    // Assert
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "There is no point to undo." });
  });

  it("starts the next game when the game-winning point is recorded", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();
    await recordRallies(app, match.id, homeGameWinningRallies.slice(0, -1));

    // Act
    const response = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "home" },
    });
    const updatedMatch = response.json<MatchState>();

    // Assert
    expect(response.statusCode).toBe(200);
    expect(updatedMatch.games).toEqual([
      { home: 21, away: 15 },
      { home: 0, away: 0 },
    ]);
    expect(updatedMatch.status).toBe("in_progress");
    expect(updatedMatch.winner).toBeNull();
  });

  it("marks the match complete when a side wins its second game", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();
    const matchWinningRallies = [
      ...homeGameWinningRallies,
      ...homeGameWinningRallies,
    ];
    await recordRallies(app, match.id, matchWinningRallies.slice(0, -1));

    // Act
    const response = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "home" },
    });
    const updatedMatch = response.json<MatchState>();

    // Assert
    expect(response.statusCode).toBe(200);
    expect(updatedMatch.games).toEqual([
      { home: 21, away: 15 },
      { home: 21, away: 15 },
    ]);
    expect(updatedMatch.status).toBe("complete");
    expect(updatedMatch.winner).toBe("home");
  });

  it("returns JSON error objects from different endpoints", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();

    // Act
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/matches/does-not-exist" }),
      app.inject({
        method: "POST",
        url: `/matches/${match.id}/points`,
        payload: { side: "visitor" },
      }),
    ]);

    // Assert
    for (const response of responses) {
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ error: expect.any(String) });
    }
  });

  it("undoes the latest point and restores the previous scoring state", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "Aino", awayPlayer: "Kai" },
    });
    const match = createResponse.json<MatchState>();
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
    const updatedMatch = undoResponse.json<MatchState>();

    // Assert
    expect(undoResponse.statusCode).toBe(200);
    expect(updatedMatch.servingSide).toBe("home");
    expect(updatedMatch.games).toEqual([{ home: 0, away: 0 }]);
    expect(updatedMatch.pointHistory).toEqual([]);
  });
});

async function recordRallies(
  app: FastifyInstance,
  matchId: string,
  rallyWinners: readonly Side[],
): Promise<void> {
  for (const side of rallyWinners) {
    const response = await app.inject({
      method: "POST",
      url: `/matches/${matchId}/points`,
      payload: { side },
    });
    expect(response.statusCode).toBe(200);
  }
}
