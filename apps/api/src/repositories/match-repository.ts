import type { MatchState } from "@badminton-scorer/shared";

export interface MatchRepository {
  findById(id: string): Promise<MatchState | undefined>;
  save(match: MatchState): Promise<void>;
}
