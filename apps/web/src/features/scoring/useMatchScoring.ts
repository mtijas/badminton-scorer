import { useRef, useState } from "react";
import type { MatchState, Side } from "@badminton-scorer/shared";
import { createMatch, recordPoint, undoPoint } from "../../services/matches.js";

export interface MatchScoringController {
  readonly match: MatchState | null;
  readonly error: string | null;
  readonly isUpdatingScore: boolean;
  startMatch(homePlayer: string, awayPlayer: string): Promise<void>;
  addPoint(side: Side): Promise<void>;
  undoLastPoint(): Promise<void>;
  newMatch(): void;
}

export function useMatchScoring(): MatchScoringController {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);
  const scoreUpdateInFlight = useRef(false);

  async function startMatch(
    homePlayer: string,
    awayPlayer: string,
  ): Promise<void> {
    try {
      setError(null);
      setMatch(await createMatch(homePlayer, awayPlayer));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function addPoint(side: Side): Promise<void> {
    if (!match) return;
    await updateScore(() => recordPoint(match.id, side));
  }

  async function undoLastPoint(): Promise<void> {
    if (!match) return;
    await updateScore(() => undoPoint(match.id));
  }

  function newMatch(): void {
    setError(null);
    setMatch(null);
  }

  async function updateScore(
    operation: () => Promise<MatchState>,
  ): Promise<void> {
    if (scoreUpdateInFlight.current) return;
    scoreUpdateInFlight.current = true;
    setIsUpdatingScore(true);

    try {
      setError(null);
      setMatch(await operation());
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      scoreUpdateInFlight.current = false;
      setIsUpdatingScore(false);
    }
  }

  return {
    match,
    error,
    isUpdatingScore,
    startMatch,
    addPoint,
    undoLastPoint,
    newMatch,
  };
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : "Something went wrong.";
}
