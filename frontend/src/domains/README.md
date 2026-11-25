# Frontend Domains

Reusable business UI and domain-specific client state. Domains mirror the
backend ownership map in `backend/domains/`. Each domain keeps its own API module
(the only place its endpoints are named), components, and scoped CSS.

- `identity/` — password sign-in for private authoring access.
- `clay_gallery/` — public gallery data loading and presentation.
- `example_items/` — the replaceable reference domain.

Domains do not import from one another's internals or from `workspaces/`.
