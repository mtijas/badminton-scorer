# Badminton Scorer — Agent Guide

## Scope

This repository contains a React web client and Node.js API for recording badminton matches and presenting their live score.

Correct scoring behaviour is more important than UI convenience.

## Working agreements

- Keep scoring rules in the domain/shared layers; do not duplicate them in UI components.
- Keep API contracts documented in `docs/api-contract.md` when endpoints change.
- Add migrations for persistent data changes; do not edit applied migrations.
- Prefer small, independently testable changes.
- Run the root ESLint command for changed JavaScript or TypeScript files before handoff.
- Do not introduce tournament functionality unless it is explicitly requested.

## Required workflow

Before changing code:

1. Read `docs/architecture.md`.
2. Read `docs/scoring-rules.md` for scoring-related changes.
3. Inspect existing tests for the affected feature.
4. Do not change unrelated files.

After changing code, run:

```bash
pnpm check
```

`pnpm check` is the required completion gate. It validates formatting, type checking, linting, tests, and builds; it must pass before the task is considered complete.

## Commands

Document the canonical development, test, lint, and Docker commands in `README.md` as they are introduced.

## TypeScript

- TypeScript strict mode is required.
- Do not use any.
- Use unknown for untrusted input and narrow it explicitly.
- Add explicit return types to exported functions.
- Prefer immutable values and readonly types.
- Do not use non-null assertions unless justified.

## React

- Use functional components.
- Keep business logic outside React components.
- Components should primarily render state and handle user interaction.
- Put reusable state logic in custom hooks.
- Custom hook names must begin with use.
- Do not introduce state management libraries without a clear need.
- Test user-visible behaviour, not implementation details.

## Scoring domain

- Keep pure badminton scoring rules in `packages/shared`.
- Neither `apps/web` nor `apps/api` may duplicate score calculations.
- `packages/shared` must not depend on React, Fastify, browser APIs, or persistence.
- Represent scoring transitions as pure functions where practical.
- Every scoring-rule change must include unit tests.
- Cover games at 20–20, the 30-point cap, service changes, undo and match completion.
- Invalid score transitions must fail explicitly.

## Architecture

Dependencies should flow in this direction:

- UI
  - application services
    - scoring domain
    - persistence

The scoring domain must not depend on UI or persistence.

Before making architectural changes, read every ADR under `/docs/adr`.

The ADRs are authoritative.

If a requested change conflicts with an accepted ADR:

1. Explain the conflict.
2. Do not silently ignore the ADR.
3. Recommend creating a new ADR if the architecture should change.

## Naming

- React components: PascalCase
- Hooks: useCamelCase
- Functions and variables: camelCase
- Constants: descriptive names; avoid unexplained literals
- Test files: `*.test.ts` or `*.test.tsx`

## Files

- Prefer small, focused files.
- Avoid unrelated refactoring during feature work.
- Do not duplicate scoring logic.
- Do not place API calls directly inside presentational components.

## Testing

- Use Arrange–Act–Assert.

Tests must cover:

- the normal path;
- relevant boundaries;
- invalid inputs;
- regressions fixed by the change.

## Documentation

Update documentation when changing:

- scoring behaviour;
- public APIs;
- architecture;
- development commands;
- persistent data formats.

## Git

Before starting each new task, update the local `main` branch from Git:

```sh
git switch main
git pull --ff-only origin main
```

Create a dedicated `feature/<task>` branch from that updated `main`. When the
task is complete, open a pull request from that feature branch to `main` and
mark it ready for review. If more work is done for the same task, push it to
the same feature branch so that its existing pull request is updated; do not
create a second pull request for that task.

Pull requests into `main` require human approval; do not merge or approve them
on behalf of a human reviewer.

Use Conventional Commit prefixes:

- feat:
- fix:
- refactor:
- test:
- docs:
- chore:

Do not commit generated build output.
