# Architecture

The application is a TypeScript npm-workspace monorepo.

- `apps/web` is a React/Vite single-page client. UI workflows live in `src/features` as they grow; backend communication remains under `src/services`.
- `apps/api` is a Fastify HTTP API. Its routes validate input and coordinate domain logic; its production server uses a PostgreSQL repository behind that boundary.
- `packages/shared` contains API-facing types and the pure badminton scoring rules. Neither application duplicates rule calculations.

The production API uses PostgreSQL transactions to persist matches, players, game projections, and append-only score events. Match state is reconstructed by replaying active score events through the shared scoring domain. An in-memory repository remains available only as an injected test double.

The API is the source of truth for live match state. The browser submits a point and renders the returned match state, which keeps rules and match completion behavior out of UI components.
