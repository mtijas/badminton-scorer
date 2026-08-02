import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  createScoringState,
  type MatchState,
  type ScoringSystem,
  type Side,
} from "@badminton-scorer/shared";
import { InMemoryMatchRepository } from "./repositories/in-memory-match-repository.js";
import type { MatchRepository } from "./repositories/match-repository.js";

export interface BuildAppOptions {
  matchRepository?: MatchRepository;
}

export async function buildApp({
  matchRepository = new InMemoryMatchRepository(),
}: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{
    Body: {
      homePlayer: string;
      awayPlayer: string;
      initialServer: Side;
      scoringSystem: ScoringSystem;
    };
  }>("/matches", async (request, reply) => {
    const { homePlayer, awayPlayer, initialServer, scoringSystem } =
      request.body ?? {};
    if (!isPlayerName(homePlayer) || !isPlayerName(awayPlayer)) {
      return reply.code(400).send({ error: "Both player names are required." });
    }
    if (initialServer !== "home" && initialServer !== "away") {
      return reply
        .code(400)
        .send({ error: "initialServer must be home or away." });
    }
    if (scoringSystem !== "3x21" && scoringSystem !== "3x15") {
      return reply
        .code(400)
        .send({ error: "scoringSystem must be 3x21 or 3x15." });
    }

    const scoringState = createScoringState(initialServer, scoringSystem);
    const match: MatchState = {
      id: crypto.randomUUID(),
      homePlayer: homePlayer.trim(),
      awayPlayer: awayPlayer.trim(),
      ...scoringState,
      status: "in_progress",
      winner: null,
    };
    await matchRepository.create(match);
    return reply.code(201).send(match);
  });

  app.get<{ Params: { id: string } }>(
    "/matches/:id",
    async (request, reply) => {
      const match = await matchRepository.findById(request.params.id);
      return match
        ? match
        : reply.code(404).send({ error: "Match not found." });
    },
  );

  app.post<{ Params: { id: string }; Body: { side: Side } }>(
    "/matches/:id/points",
    async (request, reply) => {
      if (request.body?.side !== "home" && request.body?.side !== "away") {
        return reply.code(400).send({ error: "side must be home or away." });
      }
      try {
        const updated = await matchRepository.recordPoint(
          request.params.id,
          request.body.side,
        );
        return updated
          ? updated
          : reply.code(404).send({ error: "Match not found." });
      } catch (caught) {
        const error =
          caught instanceof Error
            ? caught.message
            : "Unable to record the point.";
        return reply.code(409).send({ error });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/matches/:id/undo",
    async (request, reply) => {
      try {
        const updated = await matchRepository.undoLatestRally(
          request.params.id,
        );
        return updated
          ? updated
          : reply.code(404).send({ error: "Match not found." });
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
