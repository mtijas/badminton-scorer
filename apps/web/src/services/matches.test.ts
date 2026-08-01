import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatchState } from "@badminton-scorer/shared";
import { undoPoint } from "./matches.js";

const match: MatchState = {
  id: "match-1",
  homePlayer: "Aino",
  awayPlayer: "Kai",
  initialServer: "home",
  servingSide: "home",
  games: [{ home: 0, away: 0 }],
  pointHistory: [],
  status: "in_progress",
  winner: null,
};

describe("match service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a bodyless undo request without a JSON content type", async () => {
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
      { method: "POST", headers: undefined },
    );
    expect(result).toEqual(match);
  });
});
