import { describe, expect, it } from "vitest";
import { replayScoreEvents } from "./score-history.js";

describe("replayScoreEvents", () => {
  it("keeps awards and reversals in order with their resulting scores", () => {
    // Arrange
    const events = [
      {
        id: "event-1",
        type: "rally_awarded" as const,
        awardedSide: "home" as const,
        reversedEventId: null,
        occurredAt: "2026-08-02T17:00:00.000Z",
      },
      {
        id: "event-2",
        type: "rally_awarded" as const,
        awardedSide: "away" as const,
        reversedEventId: null,
        occurredAt: "2026-08-02T17:01:00.000Z",
      },
      {
        id: "event-3",
        type: "rally_reversed" as const,
        awardedSide: null,
        reversedEventId: "event-2",
        occurredAt: "2026-08-02T17:02:00.000Z",
      },
    ];

    // Act
    const replayed = replayScoreEvents("home", "3x21", events);

    // Assert
    expect(replayed.scoringState.games).toEqual([{ home: 1, away: 0 }]);
    expect(replayed.scoreHistory).toEqual([
      {
        eventNumber: 1,
        type: "rally_awarded",
        awardedSide: "home",
        gameNumber: 1,
        score: { home: 1, away: 0 },
        occurredAt: "2026-08-02T17:00:00.000Z",
      },
      {
        eventNumber: 2,
        type: "rally_awarded",
        awardedSide: "away",
        gameNumber: 1,
        score: { home: 1, away: 1 },
        occurredAt: "2026-08-02T17:01:00.000Z",
      },
      {
        eventNumber: 3,
        type: "rally_reversed",
        awardedSide: null,
        gameNumber: 1,
        score: { home: 1, away: 0 },
        occurredAt: "2026-08-02T17:02:00.000Z",
      },
    ]);
  });
});
