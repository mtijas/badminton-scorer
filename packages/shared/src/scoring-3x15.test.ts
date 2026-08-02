import { describe, expect, it } from "vitest";
import { gameWinner, isEndsChangeDue, recordPoint } from "./scoring.js";

const scoringSystem = "3x15" as const;

describe("3x15 badminton scoring", () => {
  it("requires a two-point lead after 14-all and ends at 21 points", () => {
    // Arrange
    const onePointLead = { home: 15, away: 14 };
    const twoPointLead = { home: 16, away: 14 };
    const cappedGame = { home: 21, away: 20 };

    // Act
    const winnerWithOnePointLead = gameWinner(onePointLead, scoringSystem);
    const winnerWithTwoPointLead = gameWinner(twoPointLead, scoringSystem);
    const winnerAtCap = gameWinner(cappedGame, scoringSystem);

    // Assert
    expect(winnerWithOnePointLead).toBeNull();
    expect(winnerWithTwoPointLead).toBe("home");
    expect(winnerAtCap).toBe("home");
  });

  it("starts the next game after the fifteenth point", () => {
    // Arrange
    const gamePoint = [{ home: 14, away: 9 }];

    // Act
    const games = recordPoint(gamePoint, "home", scoringSystem);

    // Assert
    expect(games).toEqual([
      { home: 15, away: 9 },
      { home: 0, away: 0 },
    ]);
  });

  it("requires an ends change after 8 points in the deciding game", () => {
    // Arrange
    const games = [
      { home: 15, away: 12 },
      { home: 12, away: 15 },
      { home: 8, away: 6 },
    ];

    // Act
    const endsChangeDue = isEndsChangeDue(games, scoringSystem);

    // Assert
    expect(endsChangeDue).toBe(true);
  });

  it("does not require another ends change when the second side reaches 8", () => {
    // Arrange
    const games = [
      { home: 15, away: 12 },
      { home: 12, away: 15 },
      { home: 8, away: 8 },
    ];

    // Act
    const endsChangeDue = isEndsChangeDue(games, scoringSystem);

    // Assert
    expect(endsChangeDue).toBe(false);
  });

  it("does not require another ends change when the second side reaches 8 after the first side passes it", () => {
    // Arrange
    const games = [
      { home: 15, away: 12 },
      { home: 12, away: 15 },
      { home: 9, away: 8 },
    ];

    // Act
    const endsChangeDue = isEndsChangeDue(games, scoringSystem);

    // Assert
    expect(endsChangeDue).toBe(false);
  });

  it("does not require another ends change when home reaches 8 after away passes it", () => {
    // Arrange
    const games = [
      { home: 15, away: 12 },
      { home: 12, away: 15 },
      { home: 8, away: 9 },
    ];

    // Act
    const endsChangeDue = isEndsChangeDue(games, scoringSystem);

    // Assert
    expect(endsChangeDue).toBe(false);
  });
});
