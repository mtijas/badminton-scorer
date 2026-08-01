# Database Agent Guide

- Store forward-only migrations in `migrations/`.
- Keep representative non-production data in `seeds/`.
- Document the intended logical schema in `schema/`.
- Preserve match history and score events; do not overwrite historical results without an explicit product rule.
