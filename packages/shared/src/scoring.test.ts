import { describe, expect, it } from "vitest";
import { gameWinner, matchWinner, recordPoint } from "./scoring.js";

describe("badminton scoring", () => {
  it("requires a two-point lead after 20-all", () => {
    expect(gameWinner({ home: 21, away: 20 })).toBeNull();
    expect(gameWinner({ home: 22, away: 20 })).toBe("home");
  });

  it("ends a deuce game at 30 points", () => {
    expect(gameWinner({ home: 30, away: 29 })).toBe("home");
  });

  it("starts the next game after a completed game", () => {
    expect(recordPoint([{ home: 21, away: 15 }], "away")).toEqual([
      { home: 21, away: 15 },
      { home: 0, away: 1 }
    ]);
  });

  it("declares a best-of-three match winner", () => {
    expect(matchWinner([{ home: 21, away: 18 }, { home: 15, away: 21 }, { home: 21, away: 19 }])).toBe("home");
  });
});
