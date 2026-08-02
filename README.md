# Badminton Scorer

React and Node.js badminton scoring service.

The initial product scope is players, matches, point recording, game/match winner calculation, and live match state.

## Stack

- React + Vite web client
- Fastify API
- TypeScript shared scoring domain
- PostgreSQL persistence with forward-only migrations and append-only rally history

## Getting started

Requires Node.js 22.13 or later and pnpm 11. Install the pinned pnpm version directly:

```sh
npm install --global pnpm@11.9.0
```

Docker uses the same direct installation because the Corepack version bundled with the Node image can have outdated npm signing-key metadata.

```sh
docker compose up -d database
pnpm install
pnpm db:migrate
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
pnpm test    # run fast unit and application tests with in-memory storage (no PostgreSQL required)
pnpm test:integration # migrate and run PostgreSQL repository integration tests (uses TEST_DATABASE_URL)
pnpm test:e2e # run the Playwright browser scoring smoke test
pnpm lint    # lint all JavaScript and TypeScript files
pnpm db:migrate # apply forward-only PostgreSQL migrations (requires DATABASE_URL)
pnpm db:verify # verify PostgreSQL integrity constraints (requires DATABASE_URL)
```

Install the Chromium browser once before running the browser test locally:

```sh
pnpm exec playwright install chromium
```

Copy `.env.example` to `.env` only when overriding the local defaults.

The API requires PostgreSQL. Start it with `docker compose up -d database`, then
run `pnpm db:migrate` before `pnpm dev`, `pnpm test:e2e`, or `pnpm check`.

## PostgreSQL integration tests

Fast unit and application tests use `InMemoryMatchRepository` and run through
`pnpm test` without a PostgreSQL connection. The PostgreSQL integration suite
continues to verify migrations, transactions, constraints, event ordering, and
repository queries against a separate database on port 5433, so it does not
truncate local development data. Start the isolated service and run the
canonical command below; it applies migrations before executing the tests.

```sh
docker compose -f docker-compose.test.yml up -d
pnpm test:integration
```

Set `TEST_DATABASE_URL` to use another PostgreSQL instance. Stop the test
database when finished with `docker compose -f docker-compose.test.yml down`.
