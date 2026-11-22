# Domain Ownership

Every table, endpoint, and workflow has exactly one owning domain. Record each
domain here when it is created.

| Domain | Owns | Canonical records |
|---|---|---|
| Platform (`backend/core`) | Configuration, connections, error contract, token transport | `becks_clay.schema_migrations` |
| Identity | Accounts, registration, sign-in | `becks_clay.users` |
| Clay gallery | Clay creations and R2 asset metadata | `becks_clay.figures`, `becks_clay.assets` |
| Example items | Replaceable reference workflow | `becks_clay.example_items` |
| Data warehouse (jobs) | Source registry, run history, observations | `becks_clay.external_data_sources`, `becks_clay.external_data_runs`, `becks_clay.example_observations` |

## Rules

- Other domains reference a canonical record by its identifier; they never
  copy its data or write into its tables.
- Cross-domain behavior goes through the owner's documented public service.
- Presentation state (dashboards, canvases, UI preferences) may reference
  canonical records but must never become their only source of truth.
- When ownership is unclear, decide it and record it here before writing code.
