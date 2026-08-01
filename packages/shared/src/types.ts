export type Side = "home" | "away";

export interface GameScore {
  readonly home: number;
  readonly away: number;
}

export interface ScoringState {
  readonly initialServer: Side;
  readonly servingSide: Side;
  readonly games: readonly GameScore[];
  readonly pointHistory: readonly Side[];
}

export interface MatchState {
  id: string;
  homePlayer: string;
  awayPlayer: string;
  games: readonly GameScore[];
  status: "in_progress" | "complete";
  winner: Side | null;
}
