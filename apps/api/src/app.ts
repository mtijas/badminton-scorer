import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  createScoringState,
  matchWinner,
  recordRally,
  undoRally,
  type MatchState,
  type Side,
} from "@badminton-scorer/shared";

const matches = new Map<string, MatchState>();

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: { homePlayer: string; awayPlayer: string } }>(
    "/matches",
    async (request, reply) => {
      const { homePlayer, awayPlayer } = request.body ?? {};
      if (!isPlayerName(homePlayer) || !isPlayerName(awayPlayer)) {
        return reply
          .code(400)
          .send({ error: "Both player names are required." });
      }

      const scoringState = createScoringState("home");
      const match: MatchState = {
        id: crypto.randomUUID(),
        homePlayer: homePlayer.trim(),
        awayPlayer: awayPlayer.trim(),
        ...scoringState,
        status: "in_progress",
        winner: null,
      };
      matches.set(match.id, match);
      return reply.code(201).send(match);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/matches/:id",
    async (request, reply) => {
      const match = matches.get(request.params.id);
      return match
        ? match
        : reply.code(404).send({ error: "Match not found." });
    },
  );

  app.post<{ Params: { id: string }; Body: { side: Side } }>(
    "/matches/:id/points",
    async (request, reply) => {
      const match = matches.get(request.params.id);
      if (!match) return reply.code(404).send({ error: "Match not found." });
      if (request.body?.side !== "home" && request.body?.side !== "away") {
        return reply.code(400).send({ error: "side must be home or away." });
      }
      if (match.status === "complete")
        return reply.code(409).send({ error: "Match is already complete." });

      const scoringState = recordRally(match, request.body.side);
      const winner = matchWinner(scoringState.games);
      const updated: MatchState = {
        ...match,
        ...scoringState,
        winner,
        status: winner ? "complete" : "in_progress",
      };
      matches.set(match.id, updated);
      return updated;
    },
  );

  app.post<{ Params: { id: string } }>(
    "/matches/:id/undo",
    async (request, reply) => {
      const match = matches.get(request.params.id);
      if (!match) return reply.code(404).send({ error: "Match not found." });

      try {
        const scoringState = undoRally(match);
        const winner = matchWinner(scoringState.games);
        const updated: MatchState = {
          ...match,
          ...scoringState,
          winner,
          status: winner ? "complete" : "in_progress",
        };
        matches.set(match.id, updated);
        return updated;
      } catch (caught) {
        const error =
          caught instanceof Error
            ? caught.message
            : "Unable to undo the latest point.";
        return reply.code(409).send({ error });
      }
    },
  );

  return app;
}

function isPlayerName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 80
  );
}
