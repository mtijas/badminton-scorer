import { describe, expect, it } from "vitest";
import {
  createScoringState,
  gameWinner,
  isEndsChangeDue,
  recordPoint,
  recordRally,
  undoRally,
} from "./scoring.js";
import type { Side } from "./types.js";

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

  it("requires an ends change after the first completed game", () => {
    // Arrange
    const games = [
      { home: 15, away: 12 },
      { home: 0, away: 0 },
    ];

    // Act
    const endsChangeDue = isEndsChangeDue(games, scoringSystem);

    // Assert
    expect(endsChangeDue).toBe(true);
  });

  it("requires an ends change after the second game only when a third game starts", () => {
    // Arrange
    const thirdGameStarts = [
      { home: 15, away: 12 },
      { home: 12, away: 15 },
      { home: 0, away: 0 },
    ];
    const matchIsComplete = [
      { home: 15, away: 12 },
      { home: 15, away: 12 },
    ];

    // Act
    const endsChangeBeforeThirdGame = isEndsChangeDue(
      thirdGameStarts,
      scoringSystem,
    );
    const endsChangeAfterCompleteMatch = isEndsChangeDue(
      matchIsComplete,
      scoringSystem,
    );

    // Assert
    expect(endsChangeBeforeThirdGame).toBe(true);
    expect(endsChangeAfterCompleteMatch).toBe(false);
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

  it("clears the deciding-game ends-change state when its triggering rally is undone", () => {
    // Arrange
    const stateWithEndsChangeDue = [
      ...Array<Side>(15).fill("home"),
      ...Array<Side>(15).fill("away"),
      ...Array<Side>(8).fill("home"),
    ].reduce(recordRally, createScoringState("home", scoringSystem));

    // Act
    const revertedState = undoRally(stateWithEndsChangeDue);

    // Assert
    expect(stateWithEndsChangeDue.endsChangeDue).toBe(true);
    expect(revertedState.endsChangeDue).toBe(false);
    expect(revertedState.games).toEqual([
      { home: 15, away: 0 },
      { home: 0, away: 15 },
      { home: 7, away: 0 },
    ]);
  });
});
