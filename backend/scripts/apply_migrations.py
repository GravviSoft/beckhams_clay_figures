#!/usr/bin/env python3
"""Apply unrecorded migrations in order and record each checksum.

Each pending migration runs in its own transaction together with its ledger
row, so a migration is either fully applied and recorded or not at all. The
run refuses to start when history has drifted: a recorded file whose checksum
changed, a ledger row with no checked-in file, or a file missing from
`app_schema.MIGRATIONS`.

    python scripts/apply_migrations.py            # apply pending migrations
    python scripts/apply_migrations.py --dry-run  # list pending migrations only
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2  # noqa: E402
from psycopg2 import sql  # noqa: E402

from app_schema import LEDGER_TABLE, MIGRATIONS, checksum, load_additive_schema_migration, migration_files  # noqa: E402
from core.schema import database_schema, set_search_path  # noqa: E402


def bootstrap_ledger(cursor, schema):
    cursor.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema)))
    set_search_path(cursor, schema)
    cursor.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
               filename TEXT PRIMARY KEY,
               checksum_sha256 TEXT NOT NULL,
               applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
               applied_by TEXT NOT NULL DEFAULT current_user,
               notes TEXT
           )"""
    )


def plan(expected, recorded):
    """Return pending filenames, or raise when the ledger has drifted."""

    unlisted = sorted(set(expected) - set(MIGRATIONS))
    unknown = sorted(set(recorded) - set(expected))
    changed = sorted(name for name in set(expected) & set(recorded) if recorded[name] != expected[name])
    if unlisted or unknown or changed:
        raise RuntimeError(
            "Migration drift; nothing applied. "
            f"not_in_app_schema={unlisted} unknown_in_ledger={unknown} checksum_mismatch={changed}"
        )
    return [name for name in expected if name not in recorded]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="List pending migrations without applying them.")
    args = parser.parse_args()

    connection_string = os.environ.get("CONNECTION_STRING", "").strip()
    if not connection_string:
        raise SystemExit("CONNECTION_STRING is required")

    schema = database_schema()
    expected = {path.name: checksum(path) for path in migration_files()}
    connection = psycopg2.connect(connection_string)
    try:
        with connection.cursor() as cursor:
            bootstrap_ledger(cursor, schema)
            connection.commit()
            cursor.execute("SELECT filename, checksum_sha256 FROM schema_migrations")
            recorded = dict(cursor.fetchall())

        pending = plan(expected, recorded)
        if not pending:
            print(f"No pending migrations; {len(expected)} recorded.")
            return 0
        for filename in pending:
            if args.dry_run:
                print(f"Pending {filename}")
                continue
            try:
                with connection.cursor() as cursor:
                    set_search_path(cursor, schema)
                    cursor.execute(load_additive_schema_migration(filename))
                    cursor.execute(
                        "INSERT INTO schema_migrations (filename, checksum_sha256, notes) VALUES (%s, %s, %s)",
                        (filename, expected[filename], "Applied by scripts/apply_migrations.py"),
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                print(f"Failed {filename}; it was rolled back and not recorded.", file=sys.stderr)
                raise
            print(f"Applied {filename}")
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    sys.exit(main())
