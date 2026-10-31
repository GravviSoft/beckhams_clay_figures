"""HTTP contract for the authenticated user's example items."""

from flask import Blueprint, g, jsonify, request

from . import service, validators


def create_example_items_blueprint(*, get_db, require_auth):
    blueprint = Blueprint("example_items", __name__, url_prefix="/api/items")

    @blueprint.get("")
    @require_auth
    def list_items():
        return jsonify(items=service.list_items(get_db, g.user_id))

    @blueprint.post("")
    @require_auth
    def create_item():
        body = request.get_json(silent=True)
        title = validators.title(body.get("title") if isinstance(body, dict) else None)
        return jsonify(item=service.create_item(get_db, g.user_id, title)), 201

    @blueprint.patch("/<int:item_id>")
    @require_auth
    def update_item(item_id):
        changes = validators.item_update(request.get_json(silent=True))
        return jsonify(item=service.update_item(get_db, g.user_id, item_id, changes))

    @blueprint.delete("/<int:item_id>")
    @require_auth
    def delete_item(item_id):
        service.delete_item(get_db, g.user_id, item_id)
        return "", 204

    return blueprint
