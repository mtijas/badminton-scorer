# API Agent Guide

- Keep request handling thin: routes, controllers, domain services, and repositories have separate responsibilities.
- Put badminton scoring rules in `src/domain/scoring/` and test rule changes carefully.
- Validate all external input at the API boundary.
- Use consistent error responses and avoid leaking internal implementation details.
- Do not add tournament endpoints or models unless explicitly requested.
