# Badminton Scorer Constitution

> A reliable web app for recording badminton matches and showing live scores.

---

## Context Detection

**Ralph Loop Mode** (started by `scripts/ralph-loop*.sh`):

- Read this constitution and the repository's `AGENTS.md` before choosing work.
- Pick the highest-priority incomplete spec in `specs/` (lower number = higher priority).
- Implement and test one work item at a time. Leave commits and pushes for
  human review.
- Output `<promise>DONE</promise>` only when a work item is 100% complete; output `<promise>ALL_DONE</promise>` only when no work remains.

**Interactive Mode** (normal conversation):

- Help make decisions and turn requested features into clear specifications with testable acceptance criteria.

---

## Core Principles

- Scoring correctness comes before UI convenience.
- Keep scoring rules pure, shared, and independently testable.
- Validate every change with the repository's required test and verification gates.

---

## Technical Stack

- pnpm workspace with TypeScript
- React and Vite web client
- Fastify API
- Shared scoring domain and PostgreSQL persistence

---

## Autonomy

YOLO Mode: DISABLED

Git Autonomy: DISABLED

---

## Specs

Specs live in `specs/` as root-level, numbered Markdown files. Choose the lowest-numbered incomplete spec. A spec is complete only when it contains `## Status: COMPLETE` (or an equivalent `Status: COMPLETE` heading).

Each spec must state concrete, testable acceptance criteria. Re-check a random completed spec before outputting `<promise>ALL_DONE</promise>`.

---

## NR_OF_TRIES

Track attempts using `<!-- NR_OF_TRIES: N -->` at the bottom of each spec and increment it for every attempt. At 10 or more attempts, split the work into smaller specs instead of continuing unchanged.

---

## History and Completion Logs

After each completed spec or issue, append a one-line summary to `history.md`. Create a detailed entry in `history/YYYY-MM-DD--work-item.md` when useful.

Create `completion_log/YYYY-MM-DD--HH-MM-SS--work-item.md` after each completion with the summary and verification performed. Check prior history before starting a work item.

---

## Completion Signal

Run all required verification, including `pnpm check` for code changes, before
outputting `<promise>DONE</promise>`. Never create commits or push changes;
leave the completed working tree for human review.

## Ralph Wiggum Version

Upstream: `fstandhartinger/ralph-wiggum` at commit `3f15f0fb83b8c2e0ac8d11abdae0e83ab8204981`.
