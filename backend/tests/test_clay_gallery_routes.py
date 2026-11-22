from domains.clay_gallery import repository


FIGURE = {
    "id": 4,
    "character_name": "Bowser",
    "made_on": "2026-11-20",
    "description": "A fire-breathing favorite.",
    "created_at": None,
    "updated_at": None,
    "assets": [],
}


def test_gallery_requires_authentication(client):
    assert client.get("/api/figures").status_code == 401


def test_gallery_lists_only_authenticated_users_figures(client, auth_headers, monkeypatch):
    seen = {}

    def list_figures(_connection, owner_user_id):
        seen["owner_user_id"] = owner_user_id
        return [FIGURE]

    monkeypatch.setattr(repository, "list_figures", list_figures)
    response = client.get("/api/figures", headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()["figures"] == [FIGURE]
    assert seen["owner_user_id"] == 7
