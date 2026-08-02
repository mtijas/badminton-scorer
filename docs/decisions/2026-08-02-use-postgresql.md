# ADR: Select PostgreSQL as the application database

* Status: Accepted
* Date: 2026-08-02

## Context

The application needs durable storage for badminton matches, players, games, score events, courts, tournaments, and user roles.

The data is strongly relational. Matches reference players or teams, games belong to matches, and score events belong to games. The application must preserve historical score events, support corrections, and prevent invalid or orphaned records.

Future requirements are also expected to include reporting and queries across multiple entities, such as player match history, tournament results, court schedules, match duration, and live match status.

The database must support transactional updates so that recording a point, updating the current score, and completing a game or match can be handled consistently.

## Decision

* Use PostgreSQL as the primary application database.
* Store core application entities in relational tables with explicit foreign-key relationships.
* Use database constraints to enforce data integrity where practical, including foreign keys, unique constraints, non-null constraints, and check constraints.
* Store individual scoring actions as immutable or append-only score events instead of storing only the latest score.
* Treat score events as the authoritative match history.
* Allow corrections through explicit correction or reversal events rather than silently deleting historical events.
* Use database transactions when a command changes multiple related records.
* Access PostgreSQL through repository interfaces so scoring rules and application services do not depend directly on database-specific implementation details.
* Manage schema changes through version-controlled, forward-only migrations.
* Use PostgreSQL `jsonb` only for genuinely flexible metadata or configuration. Core match and scoring data must remain relational.
* Replace the initial in-memory match repository with PostgreSQL persistence before production use.

## Consequences

PostgreSQL provides durable storage, transactional consistency, and strong support for relational queries and reporting.

Foreign keys and constraints reduce the risk of invalid match, game, player, and score-event relationships. The score-event history provides an audit trail and supports score reconstruction, corrections, and later analysis.

The repository layer allows PostgreSQL-specific code to remain outside the scoring domain and makes application-level tests possible without requiring every test to connect to a database.

The project must maintain migrations, database configuration, backups, and restore procedures. Local development and automated tests require a PostgreSQL instance, typically provided through Docker Compose.

Relational schema changes require deliberate migrations and may be less flexible than storing complete matches as unvalidated documents. New flexible fields may require either a schema migration or carefully limited use of `jsonb`.

PostgreSQL becomes a required production dependency and must be monitored, backed up, and upgraded as part of application operations.
