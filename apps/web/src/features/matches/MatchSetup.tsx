import { type FormEvent, type ReactElement, useState } from "react";
import { RequestError } from "../../components/RequestError.js";

interface MatchSetupProps {
  readonly error: string | null;
  readonly onStart: (homePlayer: string, awayPlayer: string) => Promise<void>;
}

export function MatchSetup({ error, onStart }: MatchSetupProps): ReactElement {
  const [homePlayer, setHomePlayer] = useState("Player one");
  const [awayPlayer, setAwayPlayer] = useState("Player two");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!hasPlayerName(homePlayer) || !hasPlayerName(awayPlayer)) {
      setValidationError("Enter a name for both players.");
      return;
    }

    setValidationError(null);
    void onStart(homePlayer, awayPlayer);
  }

  return (
    <main className="setup">
      <h1>Badminton Scorer</h1>
      <form onSubmit={handleSubmit}>
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
