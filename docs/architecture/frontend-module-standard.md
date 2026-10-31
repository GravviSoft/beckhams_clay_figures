# Frontend Module Standard

## Structure

```text
frontend/src/
├── app/
├── domains/
├── workspaces/
├── shared/
├── components/
└── services/
```

- `app` owns routing, authentication gating, layouts, and startup.
- `domains` owns reusable business UI, domain state, and the domain's API module.
- `workspaces` composes domain UI for a role-specific experience.
- `shared` holds genuinely cross-domain helpers once a second domain needs them.
- `components` holds the shared primitives: `PageLoader`, `StatusState`, and
  `authenticated-ui` (`AppButton`, `AppActionGroup`, `AppActionBar`, `AppField`, `AppFormDialog`).
- `services` holds the one API client (`api.js`) and session transport (`auth.js`).

## Rules

- All network calls go through `services/api.js` so error handling, retries,
  and 401 behavior stay consistent.
- Authenticated forms and dialogs use the `authenticated-ui` primitives. Page
  CSS may position them but must not redefine their height, padding, radius,
  icon gap, typography, or focus/disabled states.
- Use `PageLoader` for every loading state with a specific `label`; use
  `compact` inside cards, tables, charts, and panels.
- Keep page/domain styles scoped to that page or domain.
- The frontend may hide unavailable actions; the backend remains authoritative.

## UI tooling

React 18, React Router 6, PrimeReact, PrimeIcons, and PrimeFlex. Dependency
changes are made in `package.json`/`package-lock.json` and installed only by
rebuilding the Docker image.
