# ADR 002: Database Migration Standard

- Status: Accepted

## Decision

Database evolution uses numbered, append-only, BEGIN/COMMIT-wrapped SQL
migrations. Each applied file is recorded with its SHA-256 checksum in
`becks_clay.schema_migrations`. Applied migrations are never edited; corrections use a
new forward migration. The canonical schema snapshot (`backend/app_schema.py`)
lists every migration in order.

## Consequences

- `scripts/apply_migrations.py` applies only unrecorded files, each in one
  transaction with its ledger row, and refuses to run when history has drifted.
- `scripts/check_schema_migrations.py` exits nonzero for missing, unknown, or
  changed migrations; run it before and after every deployment.
- A test fails if `app_schema.MIGRATIONS` and the files on disk disagree.
- Ledger drift is investigated, never silently "fixed" by re-recording checksums.
