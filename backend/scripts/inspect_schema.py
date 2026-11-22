#!/usr/bin/env python3
"""Print live PostgreSQL tables and columns.

Run this at the start of any session that may touch data, SQL, migrations,
jobs, or query logic, so decisions are made from the live schema rather than
from memory or the checked-in snapshot alone.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2
import psycopg2.extras

from core.schema import database_schema


def main():
    parser = argparse.ArgumentParser(description="Inspect live schemas, tables, and columns.")
    parser.add_argument("--schemas", nargs="+", help="Schemas to inspect (default: DB_SCHEMA).")
    args = parser.parse_args()
    schemas = args.schemas or [database_schema()]

    connection_string = os.getenv("CONNECTION_STRING", "").strip()
    if not connection_string:
        raise RuntimeError("CONNECTION_STRING is not set.")
    connection = psycopg2.connect(connection_string, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        with connection.cursor() as cursor:
            for schema in schemas:
                cursor.execute(
                    """SELECT table_name FROM information_schema.tables
                       WHERE table_schema = %s AND table_type = 'BASE TABLE' ORDER BY table_name""",
                    (schema,),
                )
                tables = [row["table_name"] for row in cursor.fetchall()]
                print(f"\n== {schema} ({len(tables)} tables)")
                for table in tables:
                    cursor.execute(
                        """SELECT column_name, data_type, is_nullable FROM information_schema.columns
                           WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position""",
                        (schema, table),
                    )
                    print(f"\n{schema}.{table}")
                    for column in cursor.fetchall():
                        nullable = "null" if column["is_nullable"] == "YES" else "not null"
                        print(f"  {column['column_name']:<28} {column['data_type']:<28} {nullable}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
