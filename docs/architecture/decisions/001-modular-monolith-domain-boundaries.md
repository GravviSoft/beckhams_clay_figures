# ADR 001: Modular Monolith with Domain Boundaries

- Status: Accepted

## Decision

The application is one Flask/React monolith with explicit business domains.
Backend domains separate HTTP routes, validation, services, repositories,
policies, and serialization. Frontend domains are composed into workspaces
through shared app and API infrastructure.

## Consequences

- New business logic never expands `backend/app.py`; it goes in `backend/domains/<name>/`.
- Domains communicate through documented public services and canonical
  identifiers rather than undocumented writes into one another's tables.
- Shared infrastructure lives in the platform boundary (`backend/core/`).
