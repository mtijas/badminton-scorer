import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatchState } from "@badminton-scorer/shared";
import { createMatch, recordPoint, undoPoint } from "./matches.js";

const match: MatchState = {
  id: "match-1",
  homePlayer: "Aino",
  awayPlayer: "Kai",
  initialServer: "home",
  scoringSystem: "3x21",
  servingSide: "home",
  endsChangeDue: false,
  games: [{ home: 0, away: 0 }],
  pointHistory: [],
  status: "in_progress",
  winner: null,
};

describe("match service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the toss-selected first server when creating a match", async () => {
    // Arrange
    const awayServerMatch: MatchState = {
      ...match,
      initialServer: "away",
      scoringSystem: "3x15",
      servingSide: "away",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(awayServerMatch), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const result = await createMatch("Aino", "Kai", "away", "3x15");

    // Assert
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homePlayer: "Aino",
        awayPlayer: "Kai",
        initialServer: "away",
        scoringSystem: "3x15",
      }),
    });
    expect(result).toEqual(awayServerMatch);
  });

  it("sends an idempotency key with a bodyless undo request", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(match), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const result = await undoPoint(match.id);

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/matches/match-1/undo",
      {
        method: "POST",
        headers: { "Idempotency-Key": expect.any(String) },
      },
    );
    expect(result).toEqual(match);
  });

  it("sends an idempotency key when recording a point", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(match), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act
    await recordPoint(match.id, "home");

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/matches/match-1/points",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": expect.any(String),
        },
        body: JSON.stringify({ side: "home" }),
      },
    );
  });

  it("reports a clear message when the scoring API cannot be reached", async () => {
    // Arrange
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    // Act
    const request = undoPoint(match.id);

    // Assert
    await expect(request).rejects.toThrow(
      "Cannot reach the scoring API. Check your connection and try again.",
    );
  });

  it("reports a clear fallback when an API error has no JSON payload", async () => {
    // Arrange
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })),
    );

    // Act
    const request = undoPoint(match.id);

    // Assert
    await expect(request).rejects.toThrow(
      "The scoring API returned an error (503).",
    );
  });
});
