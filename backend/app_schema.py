#!/usr/bin/env python3
"""Canonical `app` schema snapshot, migration ledger helpers, and apply helper.

This is the single checked-in schema reference for the application. It
bootstraps a blank database by composing every reviewed, transaction-wrapped
migration under `backend/migrations/` in order. When the schema changes, add a
new numbered migration *and* append it to `MIGRATIONS` below; a test fails if
the two ever disagree.

    python app_schema.py --print-sql   # print the composed schema
    python app_schema.py               # apply it to CONNECTION_STRING (blank DB bootstrap)

For already-live databases, use `scripts/apply_migrations.py`, which applies
only unrecorded migrations and records each checksum in `app.schema_migrations`.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
MIGRATIONS_DIR = BACKEND_DIR / "migrations"
LEDGER_TABLE = "app.schema_migrations"

# Ordered, append-only. Never edit or remove an entry that has been applied.
MIGRATIONS = [
    "001_initial_schema.sql",
]


def migration_files():
    return sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda path: path.name)


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_additive_schema_migration(filename: str) -> str:
    """Return a migration's body without its required BEGIN/COMMIT wrapper."""

    migration_sql = (MIGRATIONS_DIR / filename).read_text(encoding="utf-8").strip()
    lines = migration_sql.splitlines()
    if not lines or lines[0].strip().upper() != "BEGIN;" or lines[-1].strip().upper() != "COMMIT;":
        raise RuntimeError(f"Additive schema migration {filename} must be wrapped in BEGIN/COMMIT")
    return "\n".join(lines[1:-1]).strip()


def compose_schema_sql() -> str:
    body = "\n\n".join(load_additive_schema_migration(name) for name in MIGRATIONS)
    return f"BEGIN;\n\n{body}\n\nCOMMIT;"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Print or apply the canonical app schema.")
    parser.add_argument("--print-sql", action="store_true", help="Print the composed schema SQL instead of applying it.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    schema_sql = compose_schema_sql()
    if args.print_sql:
        print(schema_sql)
        return 0

    import psycopg2

    connection_string = os.getenv("CONNECTION_STRING", "").strip()
    if not connection_string:
        print("CONNECTION_STRING is required.", file=sys.stderr)
        return 1
    connection = psycopg2.connect(connection_string)
    try:
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
    finally:
        connection.close()
    print("Applied canonical app schema. Record the ledger with scripts/apply_migrations.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
