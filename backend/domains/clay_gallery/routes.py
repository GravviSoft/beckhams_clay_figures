"""HTTP contract for the authenticated clay gallery."""

from flask import Blueprint, g, jsonify

from . import service


def create_clay_gallery_blueprint(*, get_db, require_auth):
    blueprint = Blueprint("clay_gallery", __name__, url_prefix="/api/figures")

    @blueprint.get("")
    @require_auth
    def list_figures():
        return jsonify(figures=service.list_figures(get_db, g.user_id))

    return blueprint
