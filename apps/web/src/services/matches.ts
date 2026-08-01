import type { MatchState, Side } from "@badminton-scorer/shared";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function createMatch(homePlayer: string, awayPlayer: string): Promise<MatchState> {
  return request("/matches", { method: "POST", body: JSON.stringify({ homePlayer, awayPlayer }) });
}

export async function recordPoint(id: string, side: Side): Promise<MatchState> {
  return request(`/matches/${id}/points`, { method: "POST", body: JSON.stringify({ side }) });
}

async function request(path: string, init: RequestInit): Promise<MatchState> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "The request failed.");
  }
  return response.json() as Promise<MatchState>;
}
