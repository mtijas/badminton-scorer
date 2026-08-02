import type { MatchState } from "@badminton-scorer/shared";
import type { MatchRepository } from "./match-repository.js";

export class InMemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, MatchState>();

  async findById(id: string): Promise<MatchState | undefined> {
    return this.matches.get(id);
  }

  async save(match: MatchState): Promise<void> {
    this.matches.set(match.id, match);
  }
}
