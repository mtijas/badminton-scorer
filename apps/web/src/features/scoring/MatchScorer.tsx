import { type ReactElement } from "react";
import type { MatchState, Side } from "@badminton-scorer/shared";
import { MatchSetup } from "../matches/MatchSetup.js";
import { useMatchScoring } from "./useMatchScoring.js";

export function MatchScorer(): ReactElement {
  const { match, error, startMatch, addPoint } = useMatchScoring();

  if (!match) return <MatchSetup error={error} onStart={startMatch} />;
  return <LiveMatch error={error} match={match} onAddPoint={addPoint} />;
}

interface LiveMatchProps {
  readonly error: string | null;
  readonly match: MatchState;
  readonly onAddPoint: (side: Side) => Promise<void>;
}

function LiveMatch({ error, match, onAddPoint }: LiveMatchProps): ReactElement {
  const score = match.games.at(-1);
  if (!score) return <main className="scoreboard"><p role="alert">Match score is unavailable.</p></main>;

  const winnerName = match.winner === "home" ? match.homePlayer : match.awayPlayer;
  return <main className="scoreboard"><p>Game {match.games.length} · Best of 3</p><h1>{match.status === "complete" ? `${winnerName} wins` : "Live match"}</h1><section>{(["home", "away"] as Side[]).map((side) => <article key={side}><h2>{match[`${side}Player`]}</h2><strong>{score[side]}</strong><button aria-label={`Add point for ${match[`${side}Player`]}`} disabled={match.status === "complete"} onClick={() => onAddPoint(side)}>Add point</button></article>)}</section>{error && <p role="alert">{error}</p>}</main>;
}
