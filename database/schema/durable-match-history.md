# Durable match history schema

The first migration stores core match and scoring data relationally. No core
scoring data is stored in `jsonb`.

`players` contains display names. `matches` owns the scoring system, initial
server, and lifecycle status. Each match has one `home` and one `away`
`match_sides` row; `match_side_players` uses a `player_order` of one or two,
so the repository can create singles now and add doubles without a schema
change.

`games` is a match-owned score projection. It records game order, lifecycle,
and bounded scores, but does not decide winners or calculate points.

`score_events` is the authoritative scoring history. An `rally_awarded` event
contains its awarded side. An undo is a later `rally_reversed` event that
references exactly one earlier award in the same match. Events are ordered by a
unique match-local sequence number, may not be updated or deleted, and are
replayed by application code using the shared scoring domain.

The schema enforces references, payload shape, score bounds, one reversal per
award, and game/match status consistency. The future PostgreSQL repository is
responsible for atomically inserting an event and updating the `games` and
`matches` projections.
