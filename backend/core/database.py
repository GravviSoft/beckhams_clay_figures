"""Request-scoped PostgreSQL connections.

Domains never open connections themselves. ``app.py`` injects ``get_db`` into
each domain blueprint so services own transaction boundaries and tests can
substitute a fake connection.
"""

from contextlib import contextmanager

import psycopg2
import psycopg2.extensions
import psycopg2.extras
from flask import current_app

from core.schema import database_schema, set_search_path


class DropTolerantConnection(psycopg2.extensions.connection):
    """A connection whose cleanup cannot mask the original error.

    Hosted databases occasionally drop an SSL connection mid-query. Error paths
    then call ``rollback()``/``close()`` on a dead connection, which would raise
    "connection already closed" and replace the real failure. Once the
    connection is closed those calls become no-ops.
    """

    def rollback(self):
        if self.closed:
            return None
        return super().rollback()

    def close(self):
        if self.closed:
            return None
        return super().close()


def get_db():
    connection_string = current_app.config["CONNECTION_STRING"]
    if not connection_string:
        raise RuntimeError("CONNECTION_STRING is required")
    schema = database_schema(current_app.config.get("DB_SCHEMA", ""))
    connection = psycopg2.connect(
        connection_string,
        cursor_factory=psycopg2.extras.RealDictCursor,
        connection_factory=DropTolerantConnection,
    )
    with connection.cursor() as cursor:
        set_search_path(cursor, schema)
    return connection


@contextmanager
def transaction(get_connection):
    """Commit on success, roll back on any error, and always close."""

    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
