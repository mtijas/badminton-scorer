# Badminton Scorer — Agent Guide

## Scope

This repository contains a React web client and Node.js API for recording badminton matches and presenting their live score.

## Working agreements

- Keep scoring rules in the domain/shared layers; do not duplicate them in UI components.
- Keep API contracts documented in `docs/api-contract.md` when endpoints change.
- Add migrations for persistent data changes; do not edit applied migrations.
- Prefer small, independently testable changes.
- Run the root ESLint command for changed JavaScript or TypeScript files before handoff.
- Do not introduce tournament functionality unless it is explicitly requested.

## Commands

Document the canonical development, test, lint, and Docker commands in `README.md` as they are introduced.
