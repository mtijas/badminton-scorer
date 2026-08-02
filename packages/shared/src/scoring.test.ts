import { describe, expect, it } from "vitest";
import {
  createScoringState,
  gameWinner,
  gamesWon,
  isEndsChangeDue,
  matchWinner,
  previousCompletedGames,
  recordPoint,
  recordRally,
  undoRally,
} from "./scoring.js";
import type { Side } from "./types.js";

const scoringSystem = "3x21" as const;

describe("badminton scoring", () => {
  it("requires a two-point lead after 20-all", () => {
    // Arrange
    const onePointLead = { home: 21, away: 20 };
    const twoPointLead = { home: 22, away: 20 };

    // Act
    const winnerWithOnePointLead = gameWinner(onePointLead, scoringSystem);
    const winnerWithTwoPointLead = gameWinner(twoPointLead, scoringSystem);

    // Assert
    expect(winnerWithOnePointLead).toBeNull();
    expect(winnerWithTwoPointLead).toBe("home");
  });

  it("ends a deuce game at 30 points", () => {
    // Arrange
    const score = { home: 30, away: 29 };

    // Act
    const winner = gameWinner(score, scoringSystem);

    // Assert
    expect(winner).toBe("home");
  });

  it("uses 15 points with a 21-point cap for the 3x15 system", () => {
    // Arrange
    const onePointLead = { home: 15, away: 14 };
    const twoPointLead = { home: 16, away: 14 };
    const cappedGame = { home: 21, away: 20 };

    // Act
    const winnerWithOnePointLead = gameWinner(onePointLead, "3x15");
    const winnerWithTwoPointLead = gameWinner(twoPointLead, "3x15");
    const winnerAtCap = gameWinner(cappedGame, "3x15");

    // Assert
    expect(winnerWithOnePointLead).toBeNull();
    expect(winnerWithTwoPointLead).toBe("home");
    expect(winnerAtCap).toBe("home");
  });

  it("starts the next 3x15 game after the fifteenth point", () => {
    // Arrange
    const gamePoint = [{ home: 14, away: 9 }];

    // Act
    const games = recordPoint(gamePoint, "home", "3x15");

    // Assert
    expect(games).toEqual([
      { home: 15, away: 9 },
      { home: 0, away: 0 },
    ]);
  });

  it("starts the next game as soon as the game-winning point is recorded", () => {
    // Arrange
    const gamePoint = [{ home: 20, away: 15 }];

    // Act
    const games = recordPoint(gamePoint, "home", scoringSystem);

    // Assert
    expect(games).toEqual([
      { home: 21, away: 15 },
      { home: 0, away: 0 },
    ]);
  });

  it("declares a best-of-three match winner", () => {
    // Arrange
    const games = [
      { home: 21, away: 18 },
      { home: 15, away: 21 },
      { home: 21, away: 19 },
    ];

    // Act
    const winner = matchWinner(games, scoringSystem);

    // Assert
    expect(winner).toBe("home");
  });

  it("counts completed games won by each side", () => {
    // Arrange
    const games = [
      { home: 21, away: 18 },
      { home: 15, away: 21 },
      { home: 8, away: 6 },
    ];

    // Act
    const won = gamesWon(games, scoringSystem);

    // Assert
    expect(won).toEqual({ home: 1, away: 1 });
  });

  it("returns completed games that preceded the current game", () => {
    // Arrange
    const games = [
      { home: 21, away: 18 },
      { home: 15, away: 21 },
      { home: 4, away: 3 },
    ];

    // Act
    const completedGames = previousCompletedGames(games, scoringSystem);

    // Assert
    expect(completedGames).toEqual([
      { home: 21, away: 18 },
      { home: 15, away: 21 },
    ]);
  });

  it("requires an ends change after the first completed game", () => {
    // Arrange
    const games = [
      { home: 21, away: 18 },
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
      { home: 21, away: 18 },
      { home: 18, away: 21 },
      { home: 0, away: 0 },
    ];
    const matchIsComplete = [
      { home: 21, away: 18 },
      { home: 21, away: 18 },
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

  it.each([
    ["3x21", 11],
    ["3x15", 8],
  ] as const)(
    "requires an ends change in the deciding %s game after %i points",
    (format, endsChangePoint) => {
      // Arrange
      const games = [
        { home: format === "3x21" ? 21 : 15, away: 12 },
        { home: 12, away: format === "3x21" ? 21 : 15 },
        { home: endsChangePoint, away: 6 },
      ];

      // Act
      const endsChangeDue = isEndsChangeDue(games, format);

      // Assert
      expect(endsChangeDue).toBe(true);
    },
  );

  it("does not require an ends change before the deciding-game threshold", () => {
    // Arrange
    const games = [
      { home: 21, away: 18 },
      { home: 18, away: 21 },
      { home: 10, away: 9 },
    ];

    // Act
    const endsChangeDue = isEndsChangeDue(games, scoringSystem);

    // Assert
    expect(endsChangeDue).toBe(false);
  });

  it("rejects points after match completion", () => {
    // Arrange
    const completedMatch = [
      { home: 21, away: 18 },
      { home: 21, away: 16 },
    ];

    // Act
    const recordCompletedMatchPoint = () =>
      recordPoint(completedMatch, "away", scoringSystem);

    // Assert
    expect(recordCompletedMatchPoint).toThrow(
      "A completed match cannot receive more points.",
    );
  });

  it("changes service to the rally winner", () => {
    // Arrange
    const state = createScoringState("home", scoringSystem);

    // Act
    const updatedState = recordRally(state, "away");

    // Assert
    expect(updatedState.servingSide).toBe("away");
    expect(updatedState.games).toEqual([{ home: 0, away: 1 }]);
  });

  it("undoes the latest rally and restores the prior server", () => {
    // Arrange
    const initialState = createScoringState("home", scoringSystem);
    const stateAfterRally = recordRally(initialState, "away");

    // Act
    const revertedState = undoRally(stateAfterRally);

    // Assert
    expect(revertedState).toEqual(initialState);
  });

  it("undoes a game-winning rally and restores the completed game's prior score", () => {
    // Arrange
    const gamePointRallies = [
      ...Array<Side>(20).fill("home"),
      ...Array<Side>(15).fill("away"),
      "home" as const,
    ];
    const completedGame = gamePointRallies.reduce(
      recordRally,
      createScoringState("home", scoringSystem),
    );

    // Act
    const revertedState = undoRally(completedGame);

    // Assert
    expect(revertedState.games).toEqual([{ home: 20, away: 15 }]);
    expect(revertedState.servingSide).toBe("away");
    expect(revertedState.pointHistory).toHaveLength(35);
  });

  it("undoes a match-winning rally and restores an in-progress final game", () => {
    // Arrange
    const gameWinningRallies = [
      ...Array<Side>(20).fill("home"),
      ...Array<Side>(15).fill("away"),
      "home" as const,
    ];
    const completedMatch = [
      ...gameWinningRallies,
      ...gameWinningRallies,
    ].reduce(recordRally, createScoringState("home", scoringSystem));

    // Act
    const revertedState = undoRally(completedMatch);

    // Assert
    expect(revertedState.games).toEqual([
      { home: 21, away: 15 },
      { home: 20, away: 15 },
    ]);
    expect(matchWinner(revertedState.games, scoringSystem)).toBeNull();
    expect(revertedState.servingSide).toBe("away");
  });

  it("rejects undo when no rallies have been recorded", () => {
    // Arrange
    const state = createScoringState("home", scoringSystem);

    // Act
    const undoWithoutRallies = () => undoRally(state);

    // Assert
    expect(undoWithoutRallies).toThrow("There is no point to undo.");
  });
});
