import pytest

from core.schema import database_schema


@pytest.mark.parametrize("schema", ["becks_clay", "app2", "a"])
def test_database_schema_accepts_safe_postgres_identifiers(schema):
    assert database_schema(schema) == schema


@pytest.mark.parametrize("schema", ["", "becks-clay", "BecksClay", "2becks", "public; DROP SCHEMA public"])
def test_database_schema_rejects_missing_or_unsafe_identifiers(schema):
    with pytest.raises(RuntimeError, match="DB_SCHEMA"):
        database_schema(schema)
