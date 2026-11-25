from io import BytesIO
from struct import pack
from tempfile import TemporaryFile

import pytest
from werkzeug.datastructures import FileStorage

from core.errors import ValidationError
from domains.clay_gallery import repository, service, storage


FIGURE = {
    "id": 4,
    "character_name": "Bowser",
    "made_on": "2026-11-20",
    "description": "A fire-breathing favorite.",
    "created_at": None,
    "updated_at": None,
    "assets": [],
}


def test_gallery_is_public(client, monkeypatch):
    def list_figures(_connection):
        return [FIGURE]

    monkeypatch.setattr(repository, "list_figures", list_figures)
    response = client.get("/api/figures")

    assert response.status_code == 200
    assert response.get_json()["figures"] == [FIGURE]


def test_large_glb_is_validated_without_buffering_the_model(monkeypatch):
    size = 51 * 1024 * 1024
    monkeypatch.delenv("CLAY_GALLERY_MODEL_MAX_MB", raising=False)
    with TemporaryFile() as model:
        model.write(pack("<4sII", b"glTF", 2, size))
        model.truncate(size)
        file = FileStorage(stream=model, filename="large.glb")
        asset, stream = service.read_asset(file, "display_model")
        assert asset[-1] == size
        assert stream is model
        assert stream.tell() == 0
        monkeypatch.setenv("CLAY_GALLERY_MODEL_MAX_MB", "50")
        with pytest.raises(ValidationError, match="configured 50 MB"):
            service.read_asset(file, "display_model")


def test_upload_requires_sign_in_and_feature_requires_gallery_owner(client, auth_headers, monkeypatch):
    monkeypatch.setenv("CLAY_GALLERY_OWNER_USER_ID", "8")
    assert client.post("/api/figures").status_code == 401
    assert client.post("/api/figures", headers=auth_headers).status_code == 400
    assert client.put("/api/figures/4/feature").status_code == 401
    assert client.put("/api/figures/4/feature", headers=auth_headers).status_code == 403


def test_authoring_lists_only_the_signed_in_accounts_editable_figures(client, auth_headers, monkeypatch):
    monkeypatch.setenv("CLAY_GALLERY_OWNER_USER_ID", "8")
    monkeypatch.setattr(repository, "owned_figure_ids", lambda _connection, owner_id: [4] if owner_id == 7 else [])
    assert client.get("/api/figures/authoring").status_code == 401
    response = client.get("/api/figures/authoring", headers=auth_headers)
    assert response.get_json() == {"can_upload": True, "can_feature": False, "editable_figure_ids": [4]}
    assert response.headers["Cache-Control"] == "private, no-store"


def test_owner_can_feature_owned_figure(client, auth_headers, monkeypatch, connections):
    monkeypatch.setenv("CLAY_GALLERY_OWNER_USER_ID", "7")

    def apply_feature(_connection, figure_id, owner_id):
        return {"figure_id": 4} if (figure_id, owner_id) == (4, 7) else None

    monkeypatch.setattr(repository, "feature_figure", apply_feature)
    assert client.put("/api/figures/5/feature", headers=auth_headers).status_code == 404
    assert client.put("/api/figures/4/feature", headers=auth_headers).status_code == 204
    assert connections[-1].committed


def test_owner_edits_saved_figure_without_reuploading_model(client, auth_headers, monkeypatch):
    monkeypatch.setenv("CLAY_GALLERY_OWNER_USER_ID", "8")

    def update(_connection, figure_id, owner_id, details, poster):
        assert details == ("New name", None, None)
        assert poster is None
        return (figure_id, owner_id) == (4, 7), None

    monkeypatch.setattr(repository, "update_figure", update)
    assert client.patch("/api/figures/4", data={"character_name": "New name"}).status_code == 401
    assert client.patch("/api/figures/5", headers=auth_headers, data={"character_name": "New name"}).status_code == 404
    assert client.patch("/api/figures/4", headers=auth_headers, data={"character_name": "New name"}).status_code == 204


@pytest.mark.parametrize("include_poster", [False, True])
def test_owner_saves_model_with_optional_photo(client, auth_headers, connections, monkeypatch, include_poster):
    monkeypatch.delenv("CLAY_GALLERY_OWNER_USER_ID", raising=False)
    uploaded = []

    class Bucket:
        def put_object(self, **kwargs):
            uploaded.append(kwargs)

    def insert(_connection, owner_id, details, assets):
        assert owner_id == 7
        assert details == ("Bowser", None, "Clay sculpture")
        expected_types = ["display_model", "gallery_poster"] if include_poster else ["display_model"]
        assert [asset[0] for asset in assets] == expected_types
        assert [asset[1] for asset in assets] == [item["Key"] for item in uploaded]
        return 4

    monkeypatch.setattr(storage, "bucket_client", lambda: (Bucket(), "private-test"))
    monkeypatch.setattr(repository, "insert_figure", insert)
    data = {
        "character_name": "Bowser",
        "description": "Clay sculpture",
        "model": (BytesIO(pack("<4sII", b"glTF", 2, 24) + pack("<I4s", 4, b"JSON") + b"{}  "), "figure.glb"),
    }
    if include_poster:
        data["poster"] = (BytesIO(b"\x89PNG\r\n\x1a\n"), "poster.png")
    response = client.post("/api/figures", headers=auth_headers, data=data)
    assert response.status_code == 201
    assert response.get_json() == {"id": 4}
    assert connections[0].committed
    assert client.get("/api/figures/4/assets/source_model").status_code == 404
