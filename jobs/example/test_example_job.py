import pytest

from example_job import collect, validate


def test_example_collection_contract():
    rows = validate(collect("test-v1"))
    assert rows[0].source_key == "example"
    assert rows[0].source_version == "test-v1"


def test_validation_rejects_duplicates():
    row = {"source_key": "same", "observed_value": "one", "source_version": "v1"}
    with pytest.raises(ValueError, match="Duplicate"):
        validate([row, row.copy()])


def test_validation_rejects_empty_result():
    with pytest.raises(ValueError, match="no rows"):
        validate([])

