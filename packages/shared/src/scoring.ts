import type { GameScore, ScoringState, Side } from "./types.js";

export const POINTS_TO_WIN_GAME = 21;
export const MAX_GAME_POINTS = 30;
export const GAMES_TO_WIN_MATCH = 2;

export function gameWinner(score: GameScore): Side | null {
  const leader: Side = score.home > score.away ? "home" : "away";
  const leaderPoints = score[leader];
  const trailingPoints = score[leader === "home" ? "away" : "home"];

  if (leaderPoints === MAX_GAME_POINTS) return leader;
  if (leaderPoints < POINTS_TO_WIN_GAME) return null;
  return leaderPoints - trailingPoints >= 2 ? leader : null;
}

export function matchWinner(games: readonly GameScore[]): Side | null {
  const won = { home: 0, away: 0 };
  for (const game of games) {
    const winner = gameWinner(game);
    if (winner) won[winner] += 1;
  }
  if (won.home >= GAMES_TO_WIN_MATCH) return "home";
  if (won.away >= GAMES_TO_WIN_MATCH) return "away";
  return null;
}

export function recordPoint(
  games: readonly GameScore[],
  side: Side,
): GameScore[] {
  const winner = matchWinner(games);
  if (winner) throw new Error("A completed match cannot receive more points.");

  const current = games.at(-1) ?? { home: 0, away: 0 };
  if (gameWinner(current)) {
    return [
      ...games,
      { home: side === "home" ? 1 : 0, away: side === "away" ? 1 : 0 },
    ];
  }
  return [...games.slice(0, -1), { ...current, [side]: current[side] + 1 }];
}

export function createScoringState(initialServer: Side): ScoringState {
  return {
    initialServer,
    servingSide: initialServer,
    games: [{ home: 0, away: 0 }],
    pointHistory: [],
  };
}

export function recordRally(
  state: ScoringState,
  rallyWinner: Side,
): ScoringState {
  return {
    initialServer: state.initialServer,
    servingSide: rallyWinner,
    games: recordPoint(state.games, rallyWinner),
    pointHistory: [...state.pointHistory, rallyWinner],
  };
}

export function undoRally(state: ScoringState): ScoringState {
  if (state.pointHistory.length === 0) {
    throw new Error("There is no point to undo.");
  }

  return replayRallies(state.initialServer, state.pointHistory.slice(0, -1));
}

function replayRallies(
  initialServer: Side,
  pointHistory: readonly Side[],
): ScoringState {
  return pointHistory.reduce(recordRally, createScoringState(initialServer));
}
