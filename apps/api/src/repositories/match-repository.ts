import type { MatchState } from "@badminton-scorer/shared";

export interface MatchRepository {
  findById(id: string): MatchState | undefined;
  save(match: MatchState): void;
}
