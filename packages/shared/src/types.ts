export type Side = "home" | "away";

export type ScoringSystem = "3x21" | "3x15";

export interface GameScore {
  readonly home: number;
  readonly away: number;
}

export interface GamesWon {
  readonly home: number;
  readonly away: number;
}

export interface ScoringState {
  readonly initialServer: Side;
  readonly scoringSystem: ScoringSystem;
  readonly servingSide: Side;
  readonly games: readonly GameScore[];
  readonly pointHistory: readonly Side[];
}

export interface MatchState extends ScoringState {
  id: string;
  homePlayer: string;
  awayPlayer: string;
  status: "in_progress" | "complete";
  winner: Side | null;
}
