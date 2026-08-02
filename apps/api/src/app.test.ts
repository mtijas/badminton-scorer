import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { MatchState, Side } from "@badminton-scorer/shared";
import { buildApp as buildApplication, type BuildAppOptions } from "./app.js";
import { InMemoryMatchRepository } from "./repositories/in-memory-match-repository.js";
import type { MatchRepository } from "./repositories/match-repository.js";

const whitespaceOnlyNameCases = [
  {
    player: "home",
    homePlayer: " \t ",
    awayPlayer: "Kai",
    initialServer: "home",
    scoringSystem: "3x21",
  },
  {
    player: "away",
    homePlayer: "Aino",
    awayPlayer: "\n ",
    initialServer: "home",
    scoringSystem: "3x21",
  },
] as const;

const validMatchRequest = {
  homePlayer: "Aino",
  awayPlayer: "Kai",
  initialServer: "home",
  scoringSystem: "3x21",
} as const;

const homeGameWinningRallies = [
  ...Array<Side>(20).fill("home"),
  ...Array<Side>(15).fill("away"),
  "home" as const,
];

function buildApp({
  matchRepository,
}: BuildAppOptions = {}): Promise<FastifyInstance> {
  return buildApplication({
    matchRepository: matchRepository ?? new InMemoryMatchRepository(),
  });
}

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
      payload: {
        homePlayer: " Aino ",
        awayPlayer: "Kai ",
        initialServer: "away",
        scoringSystem: "3x15",
      },
    });

    // Assert
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String),
      homePlayer: "Aino",
      awayPlayer: "Kai",
      initialServer: "away",
      scoringSystem: "3x15",
      servingSide: "away",
      endsChangeDue: false,
      games: [{ home: 0, away: 0 }],
      pointHistory: [],
      status: "in_progress",
      winner: null,
    });
  });

  it("uses an injected match repository to store and retrieve matches", async () => {
    // Arrange
    const storedMatches = new Map<string, MatchState>();
    const matchRepository: MatchRepository = {
      create: async (match) => {
        storedMatches.set(match.id, match);
      },
      findById: async (id) => storedMatches.get(id),
      recordPoint: async () => undefined,
      undoLatestRally: async () => undefined,
    };
    const app = await buildApp({ matchRepository });
    apps.push(app);

    // Act
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: validMatchRequest,
    });
    const match = createResponse.json<MatchState>();
    const getResponse = await app.inject({
      method: "GET",
      url: `/matches/${match.id}`,
    });

    // Assert
    expect(createResponse.statusCode).toBe(201);
    expect(storedMatches.get(match.id)).toEqual(match);
    expect(getResponse.json()).toEqual(match);
  });

  it("returns serving side and point history after recording a point", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: validMatchRequest,
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
    expect(updatedMatch.endsChangeDue).toBe(false);
    expect(updatedMatch.games).toEqual([{ home: 0, away: 1 }]);
    expect(updatedMatch.pointHistory).toEqual(["away"]);
  });

  it("returns an ends-change state after a game-winning point", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { ...validMatchRequest, scoringSystem: "3x15" },
    });
    const match = createResponse.json<MatchState>();
    await recordRallies(app, match.id, Array<Side>(14).fill("home"));

    // Act
    const response = await app.inject({
      method: "POST",
      url: `/matches/${match.id}/points`,
      payload: { side: "home" },
    });
    const updatedMatch = response.json<MatchState>();

    // Assert
    expect(response.statusCode).toBe(200);
    expect(updatedMatch.endsChangeDue).toBe(true);
  });

  it.each(whitespaceOnlyNameCases)(
    "rejects a whitespace-only $player player name",
    async ({ homePlayer, awayPlayer, initialServer, scoringSystem }) => {
      // Arrange
      const app = await buildApp();
      apps.push(app);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/matches",
        payload: { homePlayer, awayPlayer, initialServer, scoringSystem },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Both player names are required.",
      });
    },
  );

  it.each([undefined, "visitor"] as const)(
    "rejects an invalid initial server",
    async (initialServer) => {
      // Arrange
      const app = await buildApp();
      apps.push(app);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/matches",
        payload: {
          homePlayer: "Aino",
          awayPlayer: "Kai",
          initialServer,
          scoringSystem: "3x21",
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "initialServer must be home or away.",
      });
    },
  );

  it.each([undefined, "5x11"] as const)(
    "rejects an invalid scoring system",
    async (scoringSystem) => {
      // Arrange
      const app = await buildApp();
      apps.push(app);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/matches",
        payload: {
          homePlayer: "Aino",
          awayPlayer: "Kai",
          initialServer: "home",
          scoringSystem,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "scoringSystem must be 3x21 or 3x15.",
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
      payload: validMatchRequest,
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
      payload: validMatchRequest,
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
      payload: validMatchRequest,
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
      payload: validMatchRequest,
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
      payload: validMatchRequest,
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
      payload: validMatchRequest,
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
      payload: validMatchRequest,
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
