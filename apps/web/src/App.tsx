import { type ReactElement, useState } from "react";
import type { MatchState, Side } from "@badminton-scorer/shared";
import { createMatch, recordPoint } from "./services/matches.js";

export function App(): ReactElement {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [names, setNames] = useState({ home: "Player one", away: "Player two" });
  const [error, setError] = useState<string | null>(null);

  async function startMatch() {
    try {
      setError(null);
      setMatch(await createMatch(names.home, names.away));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function addPoint(side: Side) {
    if (!match) return;
    try {
      setError(null);
      setMatch(await recordPoint(match.id, side));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  if (!match) return <main className="setup"><h1>Badminton Scorer</h1><label>Home player<input value={names.home} onChange={(event) => setNames({ ...names, home: event.target.value })} /></label><label>Away player<input value={names.away} onChange={(event) => setNames({ ...names, away: event.target.value })} /></label><button onClick={startMatch}>Start match</button>{error && <p role="alert">{error}</p>}</main>;
  const score = match.games.at(-1);
  if (!score) return <main className="scoreboard"><p role="alert">Match score is unavailable.</p></main>;
  const winnerName = match.winner === "home" ? match.homePlayer : match.awayPlayer;
  return <main className="scoreboard"><p>Game {match.games.length} · Best of 3</p><h1>{match.status === "complete" ? `${winnerName} wins` : "Live match"}</h1><section>{(["home", "away"] as Side[]).map((side) => <article key={side}><h2>{match[`${side}Player`]}</h2><strong>{score[side]}</strong><button disabled={match.status === "complete"} onClick={() => addPoint(side)}>Add point</button></article>)}</section>{error && <p role="alert">{error}</p>}</main>;
}

function messageOf(value: unknown): string { return value instanceof Error ? value.message : "Something went wrong."; }
