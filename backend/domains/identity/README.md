# Identity Domain

Owns the canonical human account (`app.users`), password registration and
sign-in, and the authenticated-actor lookup.

## Endpoints

- `POST /api/auth/register` — creates an account; `409 conflict` when the email
  is already registered.
- `POST /api/auth/login` — returns the user and a bearer token; `401
  invalid_credentials` on a bad email/password pair.
- `GET /api/auth/me` — returns the authenticated user.

## Boundaries

- One canonical account per person. Other domains reference `app.users.id`;
  they never copy email or password data.
- Token issue and verification live in the platform core (`core/auth.py`).
  This domain owns the account record and credential rules.
- Organizations, roles, and permissions are a later identity phase. Add them
  here through a reviewed migration rather than in another domain.
