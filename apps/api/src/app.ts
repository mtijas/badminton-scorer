import cors from "@fastify/cors";
import Fastify from "fastify";
import { matchWinner, recordPoint, type MatchState, type Side } from "@badminton-scorer/shared";

const matches = new Map<string, MatchState>();

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: { homePlayer: string; awayPlayer: string } }>("/matches", async (request, reply) => {
    const { homePlayer, awayPlayer } = request.body ?? {};
    if (!isPlayerName(homePlayer) || !isPlayerName(awayPlayer)) {
      return reply.code(400).send({ error: "Both player names are required." });
    }

    const match: MatchState = {
      id: crypto.randomUUID(),
      homePlayer: homePlayer.trim(),
      awayPlayer: awayPlayer.trim(),
      games: [{ home: 0, away: 0 }],
      status: "in_progress",
      winner: null
    };
    matches.set(match.id, match);
    return reply.code(201).send(match);
  });

  app.get<{ Params: { id: string } }>("/matches/:id", async (request, reply) => {
    const match = matches.get(request.params.id);
    return match ? match : reply.code(404).send({ error: "Match not found." });
  });

  app.post<{ Params: { id: string }; Body: { side: Side } }>("/matches/:id/points", async (request, reply) => {
    const match = matches.get(request.params.id);
    if (!match) return reply.code(404).send({ error: "Match not found." });
    if (request.body?.side !== "home" && request.body?.side !== "away") {
      return reply.code(400).send({ error: "side must be home or away." });
    }
    if (match.status === "complete") return reply.code(409).send({ error: "Match is already complete." });

    const games = recordPoint(match.games, request.body.side);
    const winner = matchWinner(games);
    const updated: MatchState = { ...match, games, winner, status: winner ? "complete" : "in_progress" };
    matches.set(match.id, updated);
    return updated;
  });

  return app;
}

function isPlayerName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80;
}
