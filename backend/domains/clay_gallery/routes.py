"""HTTP contract for the publicly viewable clay gallery."""

from flask import Blueprint, Response, g, jsonify, request

from . import service


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

    @blueprint.patch("/<int:figure_id>")
    @require_auth
    def update_figure(figure_id):
        request.max_content_length = service.POSTER_LIMIT + 64 * 1024
        service.update_figure(get_db, figure_id, g.user_id, request.form, request.files)
        return "", 204

    @blueprint.get("/<int:figure_id>/assets/<asset_type>")
    def get_asset(figure_id, asset_type):
        asset, body = service.display_asset(get_db, figure_id, asset_type)
        response = Response(body.iter_chunks(64 * 1024), content_type=asset["content_type"])
        response.content_length = asset["size_bytes"]
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "public, max-age=300"
        response.call_on_close(body.close)
        return response

    return blueprint
