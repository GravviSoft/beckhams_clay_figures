import os
import sys

import psycopg2

from example_job import collect, persist, validate

DATASET_KEY = "example_dataset"


def start_run(connection):
    """Register the source and commit a durable `running` row before collecting."""

    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO app.external_data_sources (dataset_key, name, update_frequency) VALUES (%s, %s, %s)
               ON CONFLICT (dataset_key) DO UPDATE SET name = EXCLUDED.name""",
            (DATASET_KEY, "Generic example dataset", "manual"),
        )
        cursor.execute("INSERT INTO app.external_data_runs (dataset_key, status) VALUES (%s, 'running') RETURNING id", (DATASET_KEY,))
        run_id = cursor.fetchone()[0]
    connection.commit()
    return run_id


def run(connection):
    run_id = start_run(connection)
    try:
        observations = validate(collect())
        written = persist(connection, observations)
        status = "success" if written else "unchanged"
        with connection.cursor() as cursor:
            cursor.execute(
                """UPDATE app.external_data_runs SET status = %s, source_version = %s, rows_seen = %s,
                     rows_written = %s, finished_at = NOW() WHERE id = %s""",
                (status, observations[0].source_version, len(observations), written, run_id),
            )
        connection.commit()
    except Exception as error:
        connection.rollback()
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE app.external_data_runs SET status = 'failed', message = %s, finished_at = NOW() WHERE id = %s",
                (str(error)[:1000], run_id),
            )
        connection.commit()
        raise
    print(f"status={status} rows_seen={len(observations)} rows_written={written}")
    return status


def main():
    connection_string = os.environ.get("CONNECTION_STRING", "").strip()
    if not connection_string:
        raise RuntimeError("CONNECTION_STRING is required")
    connection = psycopg2.connect(connection_string)
    try:
        run(connection)
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    sys.exit(main())
