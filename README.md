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

## Git workflow

Before every new task, update the local `main` branch:

```sh
git switch main
git pull --ff-only origin main
```

Create a dedicated `feature/<issue-number>-<task>` branch from the updated
`main`. When the task is complete, open a pull request from that feature branch
to `main` after the required checks pass, and mark it ready for review. If the
same task continues, push its additional commits to the same feature branch so
that its existing pull request is updated instead of opening a new one.

## Task tracking

Track work in GitHub Issues, not Linear. Create or identify the issue before
starting implementation. Add `Closes #<issue-number>` to the PR description so
that merging the PR closes its issue automatically.

A human reviewer must approve every pull request into `main`; automated agents
must not approve or merge it.

Install the Chromium browser once before running the browser test locally:

```sh
pnpm exec playwright install chromium
```

Copy `.env.example` to `.env` only when overriding the local defaults.

The API requires PostgreSQL. Start it with `docker compose up -d database`, then
run `pnpm db:migrate` before `pnpm dev`. `pnpm test:e2e` applies pending migrations
to its database automatically; set `E2E_DATABASE_URL` to target a different one.

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
