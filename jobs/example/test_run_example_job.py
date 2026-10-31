import pytest

import run_example_job


class FakeCursor:
    def __init__(self, log):
        self.log = log
        self.rowcount = 1

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def execute(self, sql, params=None):
        self.log.append(("execute", " ".join(sql.split()), params))

    def fetchone(self):
        return (41,)


class FakeConnection:
    def __init__(self):
        self.log = []

    def cursor(self):
        return FakeCursor(self.log)

    def commit(self):
        self.log.append(("commit",))

    def rollback(self):
        self.log.append(("rollback",))


def test_running_row_is_committed_before_collection(monkeypatch):
    connection = FakeConnection()

    def collect():
        assert ("commit",) in connection.log, "running row must be durable before collection starts"
        return [{"source_key": "k", "observed_value": "v", "source_version": "s"}]

    monkeypatch.setattr(run_example_job, "collect", collect)
    assert run_example_job.run(connection) == "success"


def test_failure_is_recorded_after_rollback(monkeypatch):
    connection = FakeConnection()

    def collect():
        raise ValueError("source contract changed")

    monkeypatch.setattr(run_example_job, "collect", collect)
    with pytest.raises(ValueError):
        run_example_job.run(connection)

    rollback_at = connection.log.index(("rollback",))
    after = connection.log[rollback_at + 1:]
    assert any(entry[0] == "execute" and "status = 'failed'" in entry[1] for entry in after)
    assert after[-1] == ("commit",)
