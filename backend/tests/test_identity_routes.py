from werkzeug.security import generate_password_hash

from domains.identity import repository

USER = {"id": 7, "email": "person@example.test", "created_at": "2026-01-01T00:00:00Z"}


def test_register_creates_account_and_returns_token(client, connections, monkeypatch):
    captured = {}

    def insert_user(_connection, email, password_hash):
        captured["email"] = email
        captured["hash"] = password_hash
        return USER

    monkeypatch.setattr(repository, "insert_user", insert_user)
    response = client.post("/api/auth/register", json={"email": " Person@Example.TEST ", "password": "long-enough"})
    assert response.status_code == 201
    assert response.get_json()["token"]
    assert captured["email"] == "person@example.test"
    assert captured["hash"] != "long-enough"
    assert connections[0].committed and connections[0].closed


def test_duplicate_email_returns_conflict(client, monkeypatch):
    monkeypatch.setattr(repository, "insert_user", lambda *_args: None)
    response = client.post("/api/auth/register", json={"email": "person@example.test", "password": "long-enough"})
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "conflict"


def test_register_validates_email_and_password(client):
    assert client.post("/api/auth/register", json={"email": "nope", "password": "long-enough"}).status_code == 400
    assert client.post("/api/auth/register", json={"email": "a@b.test", "password": "short"}).status_code == 400


def test_login_rejects_wrong_password(client, monkeypatch):
    monkeypatch.setattr(
        repository, "find_user_with_password",
        lambda *_args: {**USER, "password_hash": generate_password_hash("correct-password")},
    )
    response = client.post("/api/auth/login", json={"email": USER["email"], "password": "wrong-password"})
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "invalid_credentials"


def test_login_returns_user_without_password_hash(client, monkeypatch):
    monkeypatch.setattr(
        repository, "find_user_with_password",
        lambda *_args: {**USER, "password_hash": generate_password_hash("correct-password")},
    )
    response = client.post("/api/auth/login", json={"email": USER["email"], "password": "correct-password"})
    assert response.status_code == 200
    assert "password_hash" not in response.get_json()["user"]


def test_me_returns_authenticated_user(client, auth_headers, monkeypatch):
    monkeypatch.setattr(repository, "find_user", lambda _connection, user_id: {**USER, "id": user_id})
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["user"]["id"] == 7
