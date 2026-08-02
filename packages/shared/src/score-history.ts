import { recordRally, undoRally } from "./scoring.js";
import type {
  ScoreEvent,
  ScoreHistoryEntry,
  ScoringState,
  Side,
} from "./types.js";

export interface ReplayedScoreEvents {
  readonly scoringState: ScoringState;
  readonly scoreHistory: readonly ScoreHistoryEntry[];
}

export function replayScoreEvents(
  initialServer: Side,
  scoringSystem: ScoringState["scoringSystem"],
  events: readonly ScoreEvent[],
): ReplayedScoreEvents {
  let scoringState = createInitialState(initialServer, scoringSystem);
  const awardGameNumbers = new Map<string, number>();
  const scoreHistory: ScoreHistoryEntry[] = [];

  for (const [index, event] of events.entries()) {
    if (event.type === "rally_awarded" && event.awardedSide) {
      const gameNumber = scoringState.games.length;
      scoringState = recordRally(scoringState, event.awardedSide);
      awardGameNumbers.set(event.id, gameNumber);
      scoreHistory.push({
        eventNumber: index + 1,
        type: event.type,
        awardedSide: event.awardedSide,
        gameNumber,
        score: scoreForGame(scoringState, gameNumber),
        occurredAt: event.occurredAt,
      });
      continue;
    }

    if (event.type === "rally_reversed" && event.reversedEventId) {
      const gameNumber = awardGameNumbers.get(event.reversedEventId);
      if (gameNumber === undefined) {
        throw new Error("A score reversal references an unknown rally.");
      }
      scoringState = undoRally(scoringState);
      scoreHistory.push({
        eventNumber: index + 1,
        type: event.type,
        awardedSide: null,
        gameNumber,
        score: scoreForGame(scoringState, gameNumber),
        occurredAt: event.occurredAt,
      });
      continue;
    }

    throw new Error("Stored score event is invalid.");
  }

  return { scoringState, scoreHistory };
}

function createInitialState(
  initialServer: Side,
  scoringSystem: ScoringState["scoringSystem"],
): ScoringState {
  return {
    initialServer,
    scoringSystem,
    servingSide: initialServer,
    endsChangeDue: false,
    games: [{ home: 0, away: 0 }],
    pointHistory: [],
  };
}

function scoreForGame(
  scoringState: ScoringState,
  gameNumber: number,
): ScoreHistoryEntry["score"] {
  const score = scoringState.games[gameNumber - 1];
  if (!score) throw new Error("A score event references a missing game.");
  return score;
}
