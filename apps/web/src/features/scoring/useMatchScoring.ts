import { useState } from "react";
import type { MatchState, Side } from "@badminton-scorer/shared";
import { createMatch, recordPoint } from "../../services/matches.js";

export interface MatchScoringController {
  readonly match: MatchState | null;
  readonly error: string | null;
  startMatch(homePlayer: string, awayPlayer: string): Promise<void>;
  addPoint(side: Side): Promise<void>;
}

export function useMatchScoring(): MatchScoringController {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startMatch(homePlayer: string, awayPlayer: string): Promise<void> {
    try {
      setError(null);
      setMatch(await createMatch(homePlayer, awayPlayer));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function addPoint(side: Side): Promise<void> {
    if (!match) return;

    try {
      setError(null);
      setMatch(await recordPoint(match.id, side));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return { match, error, startMatch, addPoint };
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : "Something went wrong.";
}
