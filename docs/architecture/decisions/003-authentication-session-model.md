# ADR 003: Authentication Session Model

- Status: Accepted (interim)

## Decision

The backend issues a short-lived HS256 bearer token (`APP_SECRET_KEY`,
`AUTH_TOKEN_TTL_SECONDS`). The browser keeps only that token in `localStorage`
and sends it as `Authorization: Bearer ...`. A login return path may sit in
`sessionStorage` briefly because it is navigation-only and consumed at sign-in.

## Consequences

- These two values are the only permitted browser-storage exceptions to the
  Production State Rule. Business records, workflow state, and user preferences
  are always database-backed behind ownership-checked APIs.
- A 401 clears the stored token and returns the user to sign-in.
- Moving to secure HTTP-only cookie sessions or an external identity provider
  is a later, separately approved decision that will supersede this record.
