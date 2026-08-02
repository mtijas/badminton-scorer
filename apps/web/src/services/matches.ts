import type { MatchState, ScoringSystem, Side } from "@badminton-scorer/shared";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function createMatch(
  homePlayer: string,
  awayPlayer: string,
  initialServer: Side,
  scoringSystem: ScoringSystem,
): Promise<MatchState> {
  return request("/matches", {
    method: "POST",
    body: JSON.stringify({
      homePlayer,
      awayPlayer,
      initialServer,
      scoringSystem,
    }),
  });
}

export async function recordPoint(id: string, side: Side): Promise<MatchState> {
  return request(`/matches/${id}/points`, {
    method: "POST",
    body: JSON.stringify({ side }),
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
}

export async function undoPoint(id: string): Promise<MatchState> {
  return request(`/matches/${id}/undo`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
}

async function request(
  path: string,
  init: MatchRequestInit,
): Promise<MatchState> {
  const headers = { ...init.headers };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: Object.keys(headers).length === 0 ? undefined : headers,
    });
  } catch {
    throw new Error(
      "Cannot reach the scoring API. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }
  return response.json() as Promise<MatchState>;
}

type MatchRequestInit = Omit<RequestInit, "headers"> & {
  readonly headers?: Readonly<Record<string, string>>;
};

async function apiErrorMessage(response: Response): Promise<string> {
  const fallback = `The scoring API returned an error (${response.status}).`;

  try {
    const payload: unknown = await response.json();
    if (isErrorPayload(payload)) return payload.error;
  } catch {
    return fallback;
  }

  return fallback;
}

function isErrorPayload(payload: unknown): payload is { error: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  );
}
