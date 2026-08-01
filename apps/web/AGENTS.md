# Web Client Agent Guide

- Keep UI components focused on presentation and interaction.
- Put match, player, and scoring workflows under `src/features/`.
- Access backend data through `src/services/`; avoid ad hoc HTTP calls in components.
- Maintain accessible controls for all scoring actions.
- Treat API and shared types as the source of truth for data contracts.
