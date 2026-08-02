# Badminton Scorer

React and Node.js badminton scoring service.

The initial product scope is players, matches, point recording, game/match winner calculation, and live match state.

## Stack

- React + Vite web client
- Fastify API
- TypeScript shared scoring domain
- PostgreSQL schema with forward-only migrations; the API still uses in-memory storage until the repository migration

## Getting started

Requires Node.js 22.13 or later and pnpm 11. Install the pinned pnpm version directly:

```sh
npm install --global pnpm@11.9.0
```

Docker uses the same direct installation because the Corepack version bundled with the Node image can have outdated npm signing-key metadata.

```sh
pnpm install
pnpm dev
```

The web client runs at `http://localhost:5173` and the API at `http://localhost:3000`.

## Commands

```sh
pnpm dev     # start API and web client together
pnpm check   # required completion gate: format, typecheck, lint, test, and build
pnpm format  # format project files with Prettier
pnpm typecheck # type-check all workspaces without generating output
pnpm build   # type-check and build deployable apps
pnpm test    # run shared scoring-rule tests
pnpm test:e2e # run the Playwright browser scoring smoke test
pnpm lint    # lint all JavaScript and TypeScript files
pnpm db:migrate # apply forward-only PostgreSQL migrations (requires DATABASE_URL)
```

Install the Chromium browser once before running the browser test locally:

```sh
pnpm exec playwright install chromium
```

Copy `.env.example` to `.env` only when overriding the local defaults.

Start PostgreSQL with `docker compose up -d database`, then run `pnpm db:migrate`
to initialise a local database. The API continues using in-memory storage until
the PostgreSQL repository is introduced.
