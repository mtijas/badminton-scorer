import {
  matchWinner,
  recordRally,
  undoRally,
  type MatchState,
  type Side,
} from "@badminton-scorer/shared";
import type { MatchRepository } from "./match-repository.js";

export class InMemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, MatchState>();

  async findById(id: string): Promise<MatchState | undefined> {
    return this.matches.get(id);
  }

  async create(match: MatchState): Promise<void> {
    this.matches.set(match.id, match);
  }

  async recordPoint(id: string, side: Side): Promise<MatchState | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;
    if (match.status === "complete") {
      throw new Error("Match is already complete.");
    }

    const scoringState = recordRally(match, side);
    const winner = matchWinner(scoringState.games, scoringState.scoringSystem);
    const updated: MatchState = {
      ...match,
      ...scoringState,
      winner,
      status: winner ? "complete" : "in_progress",
    };
    this.matches.set(id, updated);
    return updated;
  }

  async undoLatestRally(id: string): Promise<MatchState | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;

    const scoringState = undoRally(match);
    const winner = matchWinner(scoringState.games, scoringState.scoringSystem);
    const updated: MatchState = {
      ...match,
      ...scoringState,
      winner,
      status: winner ? "complete" : "in_progress",
    };
    this.matches.set(id, updated);
    return updated;
  }
}
