# Badminton Scorer

React and Node.js badminton scoring service.

The initial product scope is players, matches, point recording, game/match winner calculation, and live match state.

## Stack

- React + Vite web client
- Fastify API
- TypeScript shared scoring domain
- In-memory match store for the first vertical slice (persistence is deliberately not selected yet)

## Getting started

Requires Node.js 22.13 or later and pnpm 11 (Corepack can provide it with `corepack enable`).

```sh
pnpm install
pnpm dev
```

The web client runs at `http://localhost:5173` and the API at `http://localhost:3000`.

## Commands

```sh
pnpm dev     # start API and web client together
pnpm typecheck # type-check all workspaces without generating output
pnpm build   # type-check and build deployable apps
pnpm test    # run shared scoring-rule tests
pnpm lint    # lint all JavaScript and TypeScript files
```

Copy `.env.example` to `.env` only when overriding the local defaults.
