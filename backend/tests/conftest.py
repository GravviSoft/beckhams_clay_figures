import pytest

from app import create_app


class TestConfig:
    TESTING = True
    SECRET_KEY = "test-secret"
    AUTH_TOKEN_TTL_SECONDS = 60
    CONNECTION_STRING = ""
    CORS_ORIGINS = ["http://test.localhost"]


class FakeConnection:
    """Records transaction outcomes; repositories are monkeypatched in tests."""

    def __init__(self):
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


@pytest.fixture
def connections():
    return []


@pytest.fixture
def client(connections):
    def fake_db():
        connection = FakeConnection()
        connections.append(connection)
        return connection

    app = create_app(TestConfig, db=fake_db)
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    from core.auth import issue_token

    with client.application.app_context():
        token = issue_token(7)
    return {"Authorization": f"Bearer {token}"}
