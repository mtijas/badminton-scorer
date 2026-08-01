import { type ReactElement } from "react";
import {
  gamesWon,
  previousCompletedGames,
  type MatchState,
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
  const score = match.games.at(-1);
  if (!score)
    return (
      <main className="scoreboard">
        <p role="alert">Match score is unavailable.</p>
      </main>
    );

  const winnerName =
    match.winner === "home" ? match.homePlayer : match.awayPlayer;
  const won = gamesWon(match.games);
  const previousGames = previousCompletedGames(match.games);
  return (
    <main className="scoreboard">
      <p>Game {match.games.length} · Best of 3</p>
      <h1>
        {match.status === "complete" ? `${winnerName} wins` : "Live match"}
      </h1>
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
      <button
        disabled={match.pointHistory.length === 0 || isUpdatingScore}
        onClick={() => {
          void onUndoLastPoint();
        }}
      >
        Undo last point
      </button>
      {match.status === "complete" && (
        <button onClick={onNewMatch}>New match</button>
      )}
      {previousGames.length > 0 && (
        <div className="game-history">
          <h2>Previous games</h2>
          <ol>
            {previousGames.map((game, index) => (
              <li key={index}>
                Game {index + 1}: {game.home}–{game.away}
              </li>
            ))}
          </ol>
        </div>
      )}
      {error && <RequestError message={error} />}
    </main>
  );
}
