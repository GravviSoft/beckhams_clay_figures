# Domain Ownership

Every table, endpoint, and workflow has exactly one owning domain. Record each
domain here when it is created.

| Domain | Owns | Canonical records |
|---|---|---|
| Platform (`backend/core`) | Configuration, connections, error contract, token transport | `app.schema_migrations` |
| Identity | Accounts, registration, sign-in | `app.users` |
| Example items | Replaceable reference workflow | `app.example_items` |
| Data warehouse (jobs) | Source registry, run history, observations | `app.external_data_sources`, `app.external_data_runs`, `app.example_observations` |

## Rules

- Other domains reference a canonical record by its identifier; they never
  copy its data or write into its tables.
- Cross-domain behavior goes through the owner's documented public service.
- Presentation state (dashboards, canvases, UI preferences) may reference
  canonical records but must never become their only source of truth.
- When ownership is unclear, decide it and record it here before writing code.
