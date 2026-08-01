export type Side = "home" | "away";

export interface GameScore {
  home: number;
  away: number;
}

export interface ScoringState {
  initialServer: Side;
  servingSide: Side;
  games: GameScore[];
  pointHistory: Side[];
}

export interface MatchState {
  id: string;
  homePlayer: string;
  awayPlayer: string;
  games: GameScore[];
  status: "in_progress" | "complete";
  winner: Side | null;
}
