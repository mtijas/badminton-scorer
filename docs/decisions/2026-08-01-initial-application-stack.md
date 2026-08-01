# ADR: Initial application stack

- Status: Accepted
- Date: 2026-08-01

## Context

The project needs a small, runnable baseline for recording badminton matches and showing live scores, while keeping scoring rules reusable and isolated from delivery concerns.

## Decision

- Use React and Vite for the browser client.
- Use Fastify for the Node.js HTTP API.
- Use pnpm 11 workspaces for dependency management and scripts.
- Use Node.js 22.13 Alpine images in Docker so the pinned pnpm version is supported.
- Install the pinned pnpm version directly in Docker images instead of relying on the Corepack version bundled with the base image.
- Keep match state in an in-memory `Map` for the initial vertical slice. Score history must move to durable storage behind repositories before production use.

## Consequences

The client and API can be developed and built independently while sharing scoring contracts. The API is the source of truth for match state, but a restart discards all matches. Introducing persistence requires a documented schema, forward-only migration, and repository layer; it must preserve historical score events.
