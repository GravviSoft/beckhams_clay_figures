from domains.example_items import repository

ITEM = {"id": 3, "title": "First", "completed": False, "created_at": None, "updated_at": None}


def test_list_is_scoped_to_authenticated_user(client, auth_headers, monkeypatch):
    seen = {}

    def list_items(_connection, user_id):
        seen["user_id"] = user_id
        return [ITEM]

    monkeypatch.setattr(repository, "list_items", list_items)
    response = client.get("/api/items", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["items"] == [ITEM]
    assert seen["user_id"] == 7


def test_create_requires_title(client, auth_headers):
    response = client.post("/api/items", json={"title": "   "}, headers=auth_headers)
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "validation_error"


def test_create_returns_item(client, auth_headers, monkeypatch):
    monkeypatch.setattr(repository, "insert_item", lambda _connection, user_id, title: {**ITEM, "title": title})
    response = client.post("/api/items", json={"title": " New "}, headers=auth_headers)
    assert response.status_code == 201
    assert response.get_json()["item"]["title"] == "New"


def test_update_rejects_non_boolean_completed(client, auth_headers):
    response = client.patch("/api/items/3", json={"completed": "yes"}, headers=auth_headers)
    assert response.status_code == 400


def test_update_another_users_item_is_not_found(client, auth_headers, monkeypatch):
    monkeypatch.setattr(repository, "update_item", lambda *_args: None)
    response = client.patch("/api/items/99", json={"completed": True}, headers=auth_headers)
    assert response.status_code == 404


def test_delete_returns_no_content(client, auth_headers, monkeypatch):
    monkeypatch.setattr(repository, "delete_item", lambda *_args: {"id": 3})
    response = client.delete("/api/items/3", headers=auth_headers)
    assert response.status_code == 204


def test_failed_write_rolls_back(client, auth_headers, connections, monkeypatch):
    def broken(*_args):
        raise RuntimeError("write failed")

    monkeypatch.setattr(repository, "insert_item", broken)
    response = client.post("/api/items", json={"title": "New"}, headers=auth_headers)
    assert response.status_code == 500
    assert connections[0].rolled_back and not connections[0].committed and connections[0].closed
