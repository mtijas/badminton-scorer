import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { MatchState } from "@badminton-scorer/shared";
import { buildApp } from "./app.js";

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

  it("rejects empty or whitespace-only player names", async () => {
    // Arrange
    const app = await buildApp();
    apps.push(app);

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/matches",
      payload: { homePlayer: "   ", awayPlayer: "Kai" },
    });

    // Assert
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Both player names are required.",
    });
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
