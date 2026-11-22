"""Validated PostgreSQL schema configuration shared by runtime tooling."""

import os
import re

from psycopg2 import sql


SCHEMA_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


def database_schema(value=None):
    """Return the configured schema or fail before executing any SQL."""

    schema = (os.getenv("DB_SCHEMA", "") if value is None else value).strip()
    if not schema:
        raise RuntimeError("DB_SCHEMA is required.")
    if not SCHEMA_NAME_PATTERN.fullmatch(schema):
        raise RuntimeError("DB_SCHEMA must be lowercase snake_case (letters, digits, underscores; max 63 characters).")
    return schema


def set_search_path(cursor, schema):
    """Select the application's namespace without interpolating identifiers."""

    cursor.execute(sql.SQL("SET search_path TO {}, public").format(sql.Identifier(database_schema(schema))))
