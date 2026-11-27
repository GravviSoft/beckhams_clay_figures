"""HTTP contract for the publicly viewable clay gallery."""

import os

from flask import Blueprint, Response, g, jsonify, redirect, request

from core.errors import DomainError, ValidationError

from . import direct_upload, service, storage


def upload_body():
    request.max_content_length = 16 * 1024
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ValidationError("Upload details are required.")
    if any(not isinstance(body.get(name, ""), str) for name in ("character_name", "made_on", "description")):
        raise ValidationError("Upload details are invalid.")
    return body


def create_clay_gallery_blueprint(*, get_db, require_auth):
    blueprint = Blueprint("clay_gallery", __name__, url_prefix="/api/figures")

    @blueprint.get("")
    def list_figures():
        return jsonify(figures=service.list_figures(get_db))

    @blueprint.get("/authoring")
    @require_auth
    def authoring():
        response = jsonify(service.get_authoring(get_db, g.user_id))
        response.headers["Cache-Control"] = "private, no-store"
        return response

    @blueprint.put("/<int:figure_id>/feature")
    @require_auth
    def feature_figure(figure_id):
        service.feature_figure(get_db, figure_id, g.user_id)
        return "", 204

    @blueprint.post("")
    @require_auth
    def create_figure():
        request.max_content_length = service.model_upload_limit() + service.POSTER_LIMIT + 64 * 1024
        figure_id = service.create_figure(get_db, g.user_id, request.form, request.files)
        return jsonify(id=figure_id), 201

    @blueprint.post("/uploads")
    @require_auth
    def start_upload():
        response = jsonify(direct_upload.start_upload(g.user_id, upload_body()))
        response.headers["Cache-Control"] = "no-store"
        return response

    @blueprint.post("/uploads/finish")
    @require_auth
    def finish_upload():
        return jsonify(id=direct_upload.finish_upload(get_db, g.user_id, upload_body())), 201

    @blueprint.put("/<int:figure_id>/thumbnail")
    @require_auth
    def save_thumbnail(figure_id):
        request.max_content_length = service.THUMBNAIL_LIMIT + 64 * 1024
        service.save_model_thumbnail(get_db, figure_id, g.user_id, request.files.get("thumbnail"))
        return "", 204

    @blueprint.patch("/<int:figure_id>")
    @require_auth
    def update_figure(figure_id):
        request.max_content_length = service.POSTER_LIMIT + 64 * 1024
        service.update_figure(get_db, figure_id, g.user_id, request.form, request.files)
        return "", 204

    @blueprint.get("/<int:figure_id>/assets/<asset_type>")
    def get_asset(figure_id, asset_type):
        if (asset_type == "web_model" and request.method == "GET"
                and os.getenv("CLAY_GALLERY_DIRECT_WEB_MODELS") == "1"
                and "retry" not in request.args):
            asset = service.display_asset_metadata(get_db, figure_id, asset_type)
            try:
                url = storage.signed_model_url(asset["storage_key"])
            except DomainError:
                pass  # Relay when signing is unavailable.
            else:
                response = redirect(url)
                response.headers["Cache-Control"] = "no-store"
                return response
        asset, body = service.display_asset(get_db, figure_id, asset_type)
        response = Response(body.iter_chunks(64 * 1024), content_type=asset["content_type"])
        response.content_length = asset["size_bytes"]
        response.headers["X-Content-Type-Options"] = "nosniff"
        if asset_type in {"gallery_poster", "model_thumbnail"}:
            # Image URLs are versioned by the figure's updated timestamp in the
            # UI, so immutable caching avoids repeating the R2 relay.
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif (asset_type == "web_model" and asset.get("id")
                and request.args.get("v") == str(asset["id"]) and "retry" not in request.args):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "public, max-age=86400"
        response.call_on_close(body.close)
        return response

    return blueprint
