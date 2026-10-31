import psycopg2

from domains.example_items import repository as items_repository


def test_health_endpoints(client):
    assert client.get("/health").get_json() == {"status": "ok"}
    assert client.get("/api/health").status_code == 200


def test_unknown_route_returns_json_error(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


def test_protected_route_requires_token(client):
    response = client.get("/api/items")
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "unauthorized"


def test_dropped_database_connection_returns_json_503(client, auth_headers, monkeypatch):
    def dropped(*_args):
        raise psycopg2.OperationalError("SSL connection has been closed unexpectedly")

    monkeypatch.setattr(items_repository, "list_items", dropped)
    response = client.get("/api/items", headers=auth_headers)
    assert response.status_code == 503
    assert response.is_json
    assert response.get_json()["error"]["code"] == "database_unavailable"


def test_unexpected_error_never_serves_html(client, auth_headers, monkeypatch):
    def broken(*_args):
        raise RuntimeError("secret detail")

    monkeypatch.setattr(items_repository, "list_items", broken)
    response = client.get("/api/items", headers=auth_headers)
    assert response.status_code == 500
    assert response.is_json
    assert "secret detail" not in response.get_data(as_text=True)
