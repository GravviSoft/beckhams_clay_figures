# Identity Domain

Owns the canonical human account (`becks_clay.users`), password registration and
sign-in, and the authenticated-actor lookup.

## Endpoints

- `POST /api/auth/register` — creates an account; `409 conflict` when the email
  is already registered.
- `POST /api/auth/login` — returns the user and a bearer token; `401
  invalid_credentials` on a bad email/password pair.
- `GET /api/auth/me` — returns the authenticated user.
- `POST /api/auth/passkeys/enroll/{options,verify}` — signed-in enrollment.
  Starting enrollment requires the account's current password.
- `POST /api/auth/passkeys/login/{options,verify}` — device sign-in. Successful
  verification starts the same bearer session as password sign-in.

Passkeys use the exact origin configured in `CORS_ORIGINS` and its hostname as
the relying party ID. The server verifies user presence and verification,
signature, origin, and challenge. Enrollment and login challenges expire after
three minutes and are single-use. The database stores public credentials and
signature counters.

## Boundaries

- One canonical account per person. Other domains reference `becks_clay.users.id`;
  they never copy email or password data.
- Token issue and verification live in the platform core (`core/auth.py`).
  This domain owns the account record and credential rules.
- Organizations, roles, and permissions are a later identity phase. Add them
  here through a reviewed migration rather than in another domain.
