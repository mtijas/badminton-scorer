# Scoring engine instructions

These instructions apply to everything under `packages/shared/src`.

- This directory contains framework-independent domain logic.
- Do not import React, Express, database clients or browser APIs.
- Prefer pure functions and immutable state transitions.
- Every exported operation must have unit tests.
- Never silently correct invalid state.
- Changes must preserve undo and replay capabilities.
