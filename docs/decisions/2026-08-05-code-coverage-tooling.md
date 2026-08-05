# ADR: Code coverage tooling

- **Status:** Accepted
- **Date:** 2026-08-05

## Context

The project requires a consistent approach to measuring and tracking test coverage during development and code review.

The solution should:

- Provide fast feedback while developing locally.
- Integrate naturally with the existing Vitest test suite.
- Produce standard coverage reports for CI.
- Show coverage changes on GitHub pull requests.
- Help prevent accidental reductions in coverage over time.

The project already uses Vitest for unit and integration testing, making it desirable to avoid introducing additional testing frameworks solely for coverage reporting.

## Decision

Use **Vitest's built-in V8 coverage provider** for local development.

Generate:

- Terminal coverage summary.
- HTML coverage reports.
- LCOV reports for CI integration.

Use **Codecov** in GitHub Actions to publish coverage reports and track coverage over time.

Codecov will be used to:

- Display coverage changes on pull requests.
- Track project coverage history.
- Report per-file coverage.
- Report patch coverage for new changes.
- Provide GitHub status checks based on uploaded coverage reports.

## Consequences

### Positive

- No additional test framework is required.
- Coverage generation remains fast because it is integrated with Vitest.
- Developers can inspect uncovered code locally using HTML reports.
- Coverage information is visible during pull request reviews.
- Historical coverage trends are preserved.
- Standard LCOV output allows future integration with other tooling if needed.

### Negative

- Codecov introduces an external service dependency for pull request reporting.
- Local coverage percentages and GitHub-reported coverage depend on the same uploaded LCOV report, so CI failures may prevent coverage publication.

## Alternatives considered

### Istanbul (nyc)

Rejected because Vitest already provides native V8 coverage without requiring a separate coverage runner.

### c8

Rejected because Vitest's built-in coverage provider offers the same functionality with simpler configuration.

### SonarCloud

Rejected for now because the project currently requires coverage reporting rather than broader static analysis and maintainability metrics.

## Implementation notes

- Configure Vitest to use the V8 coverage provider.
- Generate HTML and LCOV coverage reports.
- Upload the LCOV report from GitHub Actions to Codecov.
- Make coverage reporting part of the pull request workflow.

## References

- Vitest documentation
- Codecov documentation
