# Example Items Domain

A deliberately small reference domain showing the module standard end to end:
`routes.py` → `validators.py` → `service.py` → `repository.py`, with a matching
frontend domain in `frontend/src/domains/example_items/`.

Replace or delete it when the application's first real domain exists. Keep the
shape, not the content.

## Endpoints (all require a bearer token)

- `GET /api/items` — the authenticated user's items.
- `POST /api/items` — create an item (`title` required, at most 200 characters).
- `PATCH /api/items/<id>` — change `title` and/or boolean `completed`.
- `DELETE /api/items/<id>` — delete an item.

Items belonging to another account return `404`, never `403`, so their
existence is not disclosed.
