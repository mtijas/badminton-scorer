import type { MatchState } from "@badminton-scorer/shared";
import type { MatchRepository } from "./match-repository.js";

export class InMemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, MatchState>();

  findById(id: string): MatchState | undefined {
    return this.matches.get(id);
  }

  save(match: MatchState): void {
    this.matches.set(match.id, match);
  }
}
