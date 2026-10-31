#!/usr/bin/env python3
"""Check checked-in SQL migrations against the live migration ledger.

Exits nonzero for unapplied files, unknown live ledger rows, or a checksum
mismatch. It never writes; use `scripts/apply_migrations.py` to apply.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2  # noqa: E402

from app_schema import LEDGER_TABLE, checksum, migration_files  # noqa: E402


def main():
    connection_string = os.getenv("CONNECTION_STRING", "").strip()
    if not connection_string:
        raise RuntimeError("CONNECTION_STRING is required.")
    expected = {path.name: checksum(path) for path in migration_files()}
    connection = psycopg2.connect(connection_string)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass(%s)", (LEDGER_TABLE,))
            if not cursor.fetchone()[0]:
                print(f"{LEDGER_TABLE} is missing; run scripts/apply_migrations.py first.")
                return 1
            cursor.execute(f"SELECT filename, checksum_sha256 FROM {LEDGER_TABLE}")
            actual = dict(cursor.fetchall())
    finally:
        connection.close()

    missing = sorted(set(expected) - set(actual))
    unknown = sorted(set(actual) - set(expected))
    changed = sorted(name for name in set(expected) & set(actual) if actual[name] != expected[name])
    if missing or unknown or changed:
        print(f"Migration drift: missing={missing} unknown={unknown} checksum_mismatch={changed}")
        return 1
    print(f"Schema migration ledger OK: {len(expected)} checked-in migrations match the live database ledger.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
