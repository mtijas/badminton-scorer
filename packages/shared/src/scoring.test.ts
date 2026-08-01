import { describe, expect, it } from "vitest";
import { createScoringState, gameWinner, matchWinner, recordPoint, recordRally, undoRally } from "./scoring.js";

describe("badminton scoring", () => {
  it("requires a two-point lead after 20-all", () => {
    // Arrange
    const onePointLead = { home: 21, away: 20 };
    const twoPointLead = { home: 22, away: 20 };

    // Act
    const winnerWithOnePointLead = gameWinner(onePointLead);
    const winnerWithTwoPointLead = gameWinner(twoPointLead);

    // Assert
    expect(winnerWithOnePointLead).toBeNull();
    expect(winnerWithTwoPointLead).toBe("home");
  });

  it("ends a deuce game at 30 points", () => {
    // Arrange
    const score = { home: 30, away: 29 };

    // Act
    const winner = gameWinner(score);

    // Assert
    expect(winner).toBe("home");
  });

  it("starts the next game after a completed game", () => {
    // Arrange
    const completedGame = [{ home: 21, away: 15 }];

    // Act
    const games = recordPoint(completedGame, "away");

    // Assert
    expect(games).toEqual([
      { home: 21, away: 15 },
      { home: 0, away: 1 }
    ]);
  });

  it("declares a best-of-three match winner", () => {
    // Arrange
    const games = [{ home: 21, away: 18 }, { home: 15, away: 21 }, { home: 21, away: 19 }];

    // Act
    const winner = matchWinner(games);

    // Assert
    expect(winner).toBe("home");
  });

  it("rejects points after match completion", () => {
    // Arrange
    const completedMatch = [{ home: 21, away: 18 }, { home: 21, away: 16 }];

    // Act
    const recordCompletedMatchPoint = () => recordPoint(completedMatch, "away");

    // Assert
    expect(recordCompletedMatchPoint).toThrow(
      "A completed match cannot receive more points."
    );
  });

  it("changes service to the rally winner", () => {
    // Arrange
    const state = createScoringState("home");

    // Act
    const updatedState = recordRally(state, "away");

    // Assert
    expect(updatedState.servingSide).toBe("away");
    expect(updatedState.games).toEqual([{ home: 0, away: 1 }]);
  });

  it("undoes the latest rally and restores the prior server", () => {
    // Arrange
    const initialState = createScoringState("home");
    const stateAfterRally = recordRally(initialState, "away");

    // Act
    const revertedState = undoRally(stateAfterRally);

    // Assert
    expect(revertedState).toEqual(initialState);
  });

  it("rejects undo when no rallies have been recorded", () => {
    // Arrange
    const state = createScoringState("home");

    // Act
    const undoWithoutRallies = () => undoRally(state);

    // Assert
    expect(undoWithoutRallies).toThrow("There is no point to undo.");
  });
});
