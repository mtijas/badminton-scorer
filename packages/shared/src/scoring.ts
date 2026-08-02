import type {
  GameScore,
  GamesWon,
  ScoringState,
  ScoringSystem,
  Side,
} from "./types.js";

export const GAMES_TO_WIN_MATCH = 2;

const scoringRules = {
  "3x21": { pointsToWin: 21, maxGamePoints: 30, endsChangePoint: 11 },
  "3x15": { pointsToWin: 15, maxGamePoints: 21, endsChangePoint: 8 },
} as const;

export function gameWinner(
  score: GameScore,
  scoringSystem: ScoringSystem,
): Side | null {
  const leader: Side = score.home > score.away ? "home" : "away";
  const leaderPoints = score[leader];
  const trailingPoints = score[leader === "home" ? "away" : "home"];
  const rules = scoringRules[scoringSystem];

  if (leaderPoints === rules.maxGamePoints) return leader;
  if (leaderPoints < rules.pointsToWin) return null;
  return leaderPoints - trailingPoints >= 2 ? leader : null;
}

export function matchWinner(
  games: readonly GameScore[],
  scoringSystem: ScoringSystem,
): Side | null {
  const won = gamesWon(games, scoringSystem);
  if (won.home >= GAMES_TO_WIN_MATCH) return "home";
  if (won.away >= GAMES_TO_WIN_MATCH) return "away";
  return null;
}

export function gamesWon(
  games: readonly GameScore[],
  scoringSystem: ScoringSystem,
): GamesWon {
  const won = { home: 0, away: 0 };
  for (const game of games) {
    const winner = gameWinner(game, scoringSystem);
    if (winner) won[winner] += 1;
  }
  return won;
}

export function previousCompletedGames(
  games: readonly GameScore[],
  scoringSystem: ScoringSystem,
): GameScore[] {
  return games
    .slice(0, -1)
    .filter((game) => gameWinner(game, scoringSystem) !== null);
}

export function isEndsChangeDue(
  games: readonly GameScore[],
  scoringSystem: ScoringSystem,
): boolean {
  const currentGame = games.at(-1);
  if (!currentGame) return false;

  const completedGames = previousCompletedGames(games, scoringSystem);
  if (
    currentGame.home === 0 &&
    currentGame.away === 0 &&
    (completedGames.length === 1 ||
      (completedGames.length === 2 && !matchWinner(games, scoringSystem)))
  ) {
    return true;
  }

  const isDecidingGame = completedGames.length === 2;
  const { endsChangePoint } = scoringRules[scoringSystem];
  return (
    isDecidingGame &&
    (currentGame.home === endsChangePoint ||
      currentGame.away === endsChangePoint)
  );
}

export function recordPoint(
  games: readonly GameScore[],
  side: Side,
  scoringSystem: ScoringSystem,
): GameScore[] {
  const winner = matchWinner(games, scoringSystem);
  if (winner) throw new Error("A completed match cannot receive more points.");

  const current = games.at(-1) ?? { home: 0, away: 0 };
  if (gameWinner(current, scoringSystem)) {
    return [
      ...games,
      { home: side === "home" ? 1 : 0, away: side === "away" ? 1 : 0 },
    ];
  }

  const updatedGames = [
    ...games.slice(0, -1),
    { ...current, [side]: current[side] + 1 },
  ];
  const updatedCurrentGame = updatedGames.at(-1);

  if (
    updatedCurrentGame &&
    gameWinner(updatedCurrentGame, scoringSystem) &&
    !matchWinner(updatedGames, scoringSystem)
  ) {
    return [...updatedGames, { home: 0, away: 0 }];
  }

  return updatedGames;
}

export function createScoringState(
  initialServer: Side,
  scoringSystem: ScoringSystem,
): ScoringState {
  return {
    initialServer,
    scoringSystem,
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
    scoringSystem: state.scoringSystem,
    servingSide: rallyWinner,
    games: recordPoint(state.games, rallyWinner, state.scoringSystem),
    pointHistory: [...state.pointHistory, rallyWinner],
  };
}

export function undoRally(state: ScoringState): ScoringState {
  if (state.pointHistory.length === 0) {
    throw new Error("There is no point to undo.");
  }

  return replayRallies(
    state.initialServer,
    state.scoringSystem,
    state.pointHistory.slice(0, -1),
  );
}

function replayRallies(
  initialServer: Side,
  scoringSystem: ScoringSystem,
  pointHistory: readonly Side[],
): ScoringState {
  return pointHistory.reduce(
    recordRally,
    createScoringState(initialServer, scoringSystem),
  );
}
