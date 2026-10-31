import pytest

import app_schema
from scripts.apply_migrations import plan


def test_canonical_snapshot_lists_every_checked_in_migration_in_order():
    assert app_schema.MIGRATIONS == [path.name for path in app_schema.migration_files()]


def test_every_migration_is_transaction_wrapped():
    for name in app_schema.MIGRATIONS:
        assert app_schema.load_additive_schema_migration(name)


def test_composed_schema_is_one_transaction_with_the_ledger():
    sql = app_schema.compose_schema_sql()
    assert sql.startswith("BEGIN;") and sql.endswith("COMMIT;")
    assert sql.count("COMMIT;") == 1
    assert "app.schema_migrations" in sql


def test_plan_returns_only_unrecorded_migrations():
    expected = {"001_initial_schema.sql": "abc"}
    assert plan(expected, {}) == ["001_initial_schema.sql"]
    assert plan(expected, {"001_initial_schema.sql": "abc"}) == []


def test_plan_refuses_checksum_drift():
    with pytest.raises(RuntimeError, match="checksum_mismatch"):
        plan({"001_initial_schema.sql": "new"}, {"001_initial_schema.sql": "old"})


def test_plan_refuses_unknown_ledger_rows():
    with pytest.raises(RuntimeError, match="unknown_in_ledger"):
        plan({"001_initial_schema.sql": "abc"}, {"001_initial_schema.sql": "abc", "999_gone.sql": "x"})
