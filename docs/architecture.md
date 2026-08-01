# Architecture

The application is a TypeScript npm-workspace monorepo.

- `apps/web` is a React/Vite single-page client. UI workflows live in `src/features` as they grow; backend communication remains under `src/services`.
- `apps/api` is a Fastify HTTP API. Its routes validate input and coordinate domain logic; persistence will be introduced behind repositories when a durable store is selected.
- `packages/shared` contains API-facing types and the pure badminton scoring rules. Neither application duplicates rule calculations.

The initial API uses an in-memory `Map` to make the first end-to-end match-scoring flow runnable. A process restart removes matches. Before production deployment, introduce a database schema, forward-only migration, and repository implementation that preserves every score event.

The API is the source of truth for live match state. The browser submits a point and renders the returned match state, which keeps rules and match completion behavior out of UI components.
