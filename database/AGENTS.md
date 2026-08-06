# Database Agent Guide

- Store forward-only migrations in `migrations/`.
- Always create migrations with `pnpm db:migration:create -- <name>` so their
  filenames use the required UTC timestamp format.
- Keep representative non-production data in `seeds/`.
- Document the intended logical schema in `schema/`.
- Preserve match history and score events; do not overwrite historical results without an explicit product rule.
