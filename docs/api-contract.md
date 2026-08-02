# API Contract

Base URL: `http://localhost:3000`

All payloads are JSON. Validation errors use `{ "error": "…" }`.

## `GET /health`

Returns `200 { "status": "ok" }`.

## `POST /matches`

Creates an in-progress match.

Request:

```json
{
  "homePlayer": "Aino",
  "awayPlayer": "Kai",
  "initialServer": "home",
  "scoringSystem": "3x21"
}
```

Returns `201` with a match object. Player names must contain at least one non-whitespace character and have a maximum length of 80 characters. `initialServer` must be `home` or `away` and records the serving side selected after the toss. `scoringSystem` must be `3x21` or `3x15`.

## `GET /matches/:id`

Returns the current match object, or `404` when no match exists.

## `POST /matches/:id/points`

Records a point and returns the updated match object.

Request:

```json
{ "side": "home" }
```

`side` must be `home` or `away`. A completed match returns `409`.

## `POST /matches/:id/undo`

Removes the latest recorded point and returns the updated match object. This endpoint has no request body. It returns `404` when no match exists and `409` when there is no point to undo.

### Match object

```json
{
  "id": "uuid",
  "homePlayer": "Aino",
  "awayPlayer": "Kai",
  "initialServer": "home",
  "scoringSystem": "3x21",
  "servingSide": "away",
  "endsChangeDue": false,
  "games": [{ "home": 21, "away": 18 }],
  "pointHistory": ["home", "away", "away"],
  "status": "in_progress",
  "winner": null
}
```

`servingSide` is the side that serves the next rally. `endsChangeDue` is true immediately after a required change of ends: after game 1, at the start of a deciding third game, or when a side first reaches 11 points in a 3x21 deciding game (8 points in 3x15). `pointHistory` lists the side that won each recorded rally in order; together with `initialServer` and `scoringSystem`, it supports deterministic score replay and undo.
