import type { MatchState, Side } from "@badminton-scorer/shared";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function createMatch(
  homePlayer: string,
  awayPlayer: string,
): Promise<MatchState> {
  return request("/matches", {
    method: "POST",
    body: JSON.stringify({ homePlayer, awayPlayer }),
  });
}

export async function recordPoint(id: string, side: Side): Promise<MatchState> {
  return request(`/matches/${id}/points`, {
    method: "POST",
    body: JSON.stringify({ side }),
  });
}

export async function undoPoint(id: string): Promise<MatchState> {
  return request(`/matches/${id}/undo`, { method: "POST" });
}

async function request(path: string, init: RequestInit): Promise<MatchState> {
  const headers =
    init.body === undefined
      ? undefined
      : { "Content-Type": "application/json" };
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
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
