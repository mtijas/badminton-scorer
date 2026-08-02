import { type FormEvent, type ReactElement, useState } from "react";
import type { ScoringSystem, Side } from "@badminton-scorer/shared";
import { RequestError } from "../../components/RequestError.js";

interface MatchSetupProps {
  readonly error: string | null;
  readonly onStart: (
    homePlayer: string,
    awayPlayer: string,
    initialServer: Side,
    scoringSystem: ScoringSystem,
  ) => Promise<void>;
}

export function MatchSetup({ error, onStart }: MatchSetupProps): ReactElement {
  const [homePlayer, setHomePlayer] = useState("Player one");
  const [awayPlayer, setAwayPlayer] = useState("Player two");
  const [initialServer, setInitialServer] = useState<Side>("home");
  const [scoringSystem, setScoringSystem] = useState<ScoringSystem>("3x21");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!hasPlayerName(homePlayer) || !hasPlayerName(awayPlayer)) {
      setValidationError("Enter a name for both players.");
      return;
    }

    setValidationError(null);
    void onStart(homePlayer, awayPlayer, initialServer, scoringSystem);
  }

  return (
    <main className="setup">
      <h1>Badminton Scorer</h1>
      <form className="match-setup-form" onSubmit={handleSubmit}>
        <label>
          Home player
          <input
            value={homePlayer}
            onChange={(event) => setHomePlayer(event.target.value)}
          />
        </label>
        <label>
          Away player
          <input
            value={awayPlayer}
            onChange={(event) => setAwayPlayer(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>First server (after toss)</legend>
          <label>
            <input
              checked={initialServer === "home"}
              name="initial-server"
              onChange={() => setInitialServer("home")}
              type="radio"
            />
            Home serves
          </label>
          <label>
            <input
              checked={initialServer === "away"}
              name="initial-server"
              onChange={() => setInitialServer("away")}
              type="radio"
            />
            Away serves
          </label>
        </fieldset>
        <fieldset>
          <legend>Scoring system</legend>
          <label>
            <input
              checked={scoringSystem === "3x21"}
              name="scoring-system"
              onChange={() => setScoringSystem("3x21")}
              type="radio"
            />
            Best of three, 21 points
          </label>
          <label>
            <input
              checked={scoringSystem === "3x15"}
              name="scoring-system"
              onChange={() => setScoringSystem("3x15")}
              type="radio"
            />
            Best of three, 15 points
          </label>
        </fieldset>
        <button type="submit">Start match</button>
      </form>
      {(validationError ?? error) && (
        <RequestError message={validationError ?? error ?? ""} />
      )}
    </main>
  );
}

function hasPlayerName(value: string): boolean {
  return value.trim().length > 0;
}
