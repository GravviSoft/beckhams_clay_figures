from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class Observation:
    source_key: str
    observed_value: str
    source_version: str
    retrieved_at: datetime


def collect(source_version="sample-v1"):
    """Replace this deterministic collector with a real, focused source client."""
    return [{"source_key": "example", "observed_value": "ready", "source_version": source_version}]


def validate(rows):
    required = {"source_key", "observed_value", "source_version"}
    if not isinstance(rows, list) or not rows:
        raise ValueError("Collector returned no rows")
    if any(set(row) != required or not all(str(row[key]).strip() for key in required) for row in rows):
        raise ValueError("Source contract changed or contains empty values")
    if len({row["source_key"] for row in rows}) != len(rows):
        raise ValueError("Duplicate source keys")
    now = datetime.now(timezone.utc)
    return [Observation(retrieved_at=now, **row) for row in rows]


def persist(connection, observations):
    written = 0
    with connection.cursor() as cursor:
        for row in observations:
            cursor.execute(
                """INSERT INTO example_observations (source_key, observed_value, source_version, retrieved_at)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (source_key) DO UPDATE SET observed_value=EXCLUDED.observed_value,
                     source_version=EXCLUDED.source_version, retrieved_at=EXCLUDED.retrieved_at
                   WHERE (example_observations.observed_value, example_observations.source_version)
                     IS DISTINCT FROM (EXCLUDED.observed_value, EXCLUDED.source_version)""",
                (row.source_key, row.observed_value, row.source_version, row.retrieved_at),
            )
            written += cursor.rowcount
    return written

