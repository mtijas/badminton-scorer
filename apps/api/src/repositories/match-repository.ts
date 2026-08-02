import type { MatchState, Side } from "@badminton-scorer/shared";

export interface MatchRepository {
  create(match: MatchState): Promise<void>;
  findById(id: string): Promise<MatchState | undefined>;
  recordPoint(
    id: string,
    side: Side,
    commandId: string,
  ): Promise<MatchState | undefined>;
  undoLatestRally(
    id: string,
    commandId: string,
  ): Promise<MatchState | undefined>;
}
