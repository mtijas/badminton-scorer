# API Contract

Base URL: `http://localhost:3000`

All payloads are JSON. Validation errors use `{ "error": "…" }`.

## `GET /health`

Returns `200 { "status": "ok" }`.

## `POST /matches`

Creates an in-progress match.

Request:

```json
{ "homePlayer": "Aino", "awayPlayer": "Kai" }
```

Returns `201` with a match object. Player names are required and have a maximum length of 80 characters.

## `GET /matches/:id`

Returns the current match object, or `404` when no match exists.

## `POST /matches/:id/points`

Records a point and returns the updated match object.

Request:

```json
{ "side": "home" }
```

`side` must be `home` or `away`. A completed match returns `409`.

### Match object

```json
{
  "id": "uuid",
  "homePlayer": "Aino",
  "awayPlayer": "Kai",
  "games": [{ "home": 21, "away": 18 }],
  "status": "in_progress",
  "winner": null
}
```
