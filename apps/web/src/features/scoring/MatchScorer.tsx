import { type ReactElement, useEffect, useRef, useState } from "react";
import {
  gameWinner,
  gamesWon,
  previousCompletedGames,
  type MatchState,
  type ScoreHistoryEntry,
  type Side,
} from "@badminton-scorer/shared";
import { RequestError } from "../../components/RequestError.js";
import { MatchSetup } from "../matches/MatchSetup.js";
import { useMatchScoring } from "./useMatchScoring.js";

export function MatchScorer(): ReactElement {
  const {
    match,
    error,
    isUpdatingScore,
    startMatch,
    addPoint,
    undoLastPoint,
    newMatch,
  } = useMatchScoring();

  if (!match) return <MatchSetup error={error} onStart={startMatch} />;
  return (
    <LiveMatch
      error={error}
      match={match}
      onAddPoint={addPoint}
      onUndoLastPoint={undoLastPoint}
      isUpdatingScore={isUpdatingScore}
      onNewMatch={newMatch}
    />
  );
}

interface LiveMatchProps {
  readonly error: string | null;
  readonly match: MatchState;
  readonly onAddPoint: (side: Side) => Promise<void>;
  readonly onUndoLastPoint: () => Promise<void>;
  readonly isUpdatingScore: boolean;
  readonly onNewMatch: () => void;
}

function LiveMatch({
  error,
  match,
  onAddPoint,
  onUndoLastPoint,
  isUpdatingScore,
  onNewMatch,
}: LiveMatchProps): ReactElement {
  const [isAbandonConfirmationOpen, setIsAbandonConfirmationOpen] =
    useState(false);
  const score = match.games.at(-1);
  if (!score)
    return (
      <main className="scoreboard">
        <p role="alert">Match score is unavailable.</p>
      </main>
    );

  const winnerName =
    match.winner === "home" ? match.homePlayer : match.awayPlayer;
  const servingPlayer = match[`${match.servingSide}Player`];
  const won = gamesWon(match.games, match.scoringSystem);
  const previousGames = previousCompletedGames(
    match.games,
    match.scoringSystem,
  );
  const completedGame = gameWinnerAnnouncement(match);
  return (
    <div className="match-screen">
      <main className="scoreboard">
        <div className="live-scorer">
          <p>
            Game {match.games.length} · Best of 3 ·{" "}
            {match.scoringSystem.slice(2)}-point games
          </p>
          <h1>
            {match.status === "complete" ? `${winnerName} wins` : "Live match"}
          </h1>
          {completedGame && (
            <aside
              aria-label="Game winner announcement"
              className="game-winner-announcement"
              role="status"
            >
              <h2>
                {match[`${completedGame.winner}Player`]} wins Game{" "}
                {completedGame.number}
              </h2>
              <p>
                Final score: {completedGame.score.home}–
                {completedGame.score.away}
              </p>
            </aside>
          )}
          {match.endsChangeDue && (
            <aside className="ends-change-prompt" role="status">
              Change ends now.
            </aside>
          )}
          <p aria-atomic="true" aria-live="polite" className="visually-hidden">
            {match.homePlayer}: {score.home}. {match.awayPlayer}: {score.away}.{" "}
            {servingPlayer} is serving.
          </p>
          <section>
            {(["home", "away"] as Side[]).map((side) => (
              <article key={side}>
                <h2>{match[`${side}Player`]}</h2>
                {match.servingSide === side ? (
                  <p
                    aria-label={`${match[`${side}Player`]} is serving`}
                    className="serving-indicator"
                  >
                    Serving
                  </p>
                ) : (
                  <p aria-hidden="true" className="serving-indicator">
                    {"\u00a0"}
                  </p>
                )}
                <strong>{score[side]}</strong>
                <p>Games won: {won[side]}</p>
                <button
                  aria-label={`Add point for ${match[`${side}Player`]}`}
                  disabled={match.status === "complete" || isUpdatingScore}
                  onClick={() => {
                    void onAddPoint(side);
                  }}
                >
                  Add point
                </button>
              </article>
            ))}
          </section>
          <div className="match-actions">
            <button
              disabled={match.pointHistory.length === 0 || isUpdatingScore}
              onClick={() => {
                void onUndoLastPoint();
              }}
            >
              Undo last point
            </button>
            <button
              disabled={match.status === "complete"}
              onClick={() => setIsAbandonConfirmationOpen(true)}
            >
              Abandon match
            </button>
            {match.status === "complete" && (
              <button onClick={onNewMatch}>New match</button>
            )}
          </div>
        </div>
        {isAbandonConfirmationOpen && (
          <div
            aria-labelledby="abandon-match-title"
            aria-modal="true"
            className="confirmation-dialog"
            role="dialog"
          >
            <h2 id="abandon-match-title">Abandon this match?</h2>
            <p>Are you sure you want to abandon this match?</p>
            <div className="match-actions">
              <button onClick={() => setIsAbandonConfirmationOpen(false)}>
                Cancel
              </button>
              <button onClick={onNewMatch}>Yes, abandon match</button>
            </div>
          </div>
        )}
        {error && <RequestError message={error} />}
      </main>
      <div className="scoring-panels">
        <ScoreHistory match={match} />
        {previousGames.length > 0 && (
          <aside aria-label="Previous games" className="game-history">
            <h2>Previous games</h2>
            <ol>
              {previousGames.map((game, index) => (
                <PreviousGame
                  key={index}
                  game={game}
                  gameNumber={index + 1}
                  homePlayer={match.homePlayer}
                  awayPlayer={match.awayPlayer}
                  scoringSystem={match.scoringSystem}
                />
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}

interface PreviousGameProps {
  readonly game: MatchState["games"][number];
  readonly gameNumber: number;
  readonly homePlayer: string;
  readonly awayPlayer: string;
  readonly scoringSystem: MatchState["scoringSystem"];
}

function PreviousGame({
  game,
  gameNumber,
  homePlayer,
  awayPlayer,
  scoringSystem,
}: PreviousGameProps): ReactElement {
  const winner = gameWinner(game, scoringSystem);
  if (!winner) {
    return (
      <li>
        Game {gameNumber}: {game.home}–{game.away}
      </li>
    );
  }

  const winnerName = winner === "home" ? homePlayer : awayPlayer;

  return (
    <li>
      Game {gameNumber}: {game.home}–{game.away} — Winner: {winnerName}
    </li>
  );
}

interface CompletedGame {
  readonly number: number;
  readonly score: MatchState["games"][number];
  readonly winner: Side;
}

function gameWinnerAnnouncement(match: MatchState): CompletedGame | null {
  const currentGameNumber = match.games.length;
  const currentGame = match.games.at(-1);
  if (!currentGame) return null;

  const currentGameWinner = gameWinner(currentGame, match.scoringSystem);
  if (currentGameWinner) {
    return {
      number: currentGameNumber,
      score: currentGame,
      winner: currentGameWinner,
    };
  }

  const currentGameHasStarted = match.scoreHistory.some(
    (entry) => entry.gameNumber === currentGameNumber,
  );
  if (currentGameHasStarted) return null;

  for (let index = match.games.length - 1; index >= 0; index -= 1) {
    const score = match.games[index];
    if (!score) continue;

    const winner = gameWinner(score, match.scoringSystem);
    if (winner) return { number: index + 1, score, winner };
  }

  return null;
}

function ScoreHistory({ match }: { readonly match: MatchState }): ReactElement {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [match.scoreHistory]);

  return (
    <aside aria-label="Scoring history" className="score-history">
      <h2>Scoring history</h2>
      <ol ref={listRef}>
        {match.scoreHistory.map((entry) => (
          <li key={entry.eventNumber}>
            <time dateTime={entry.occurredAt}>
              {formatHistoryTime(entry.occurredAt)}
            </time>
            <span>{historyDescription(entry, match)}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function formatHistoryTime(occurredAt: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(occurredAt));
}

function historyDescription(
  entry: ScoreHistoryEntry,
  match: MatchState,
): string {
  const score = `${entry.score.home}–${entry.score.away}`;
  if (entry.type === "rally_reversed") {
    return `Correction: undo — Game ${entry.gameNumber}, ${score}`;
  }
  const player = entry.awardedSide
    ? match[`${entry.awardedSide}Player`]
    : "Unknown player";
  return `${player} scored — Game ${entry.gameNumber}, ${score}`;
}
