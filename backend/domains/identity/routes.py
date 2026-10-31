"""HTTP contract for account registration, sign-in, and the current actor."""

from flask import Blueprint, g, jsonify, request

from core.auth import issue_token

from . import service, validators


def create_identity_blueprint(*, get_db, require_auth):
    blueprint = Blueprint("identity", __name__, url_prefix="/api/auth")

    @blueprint.post("/register")
    def register():
        email, password = validators.credentials(request.get_json(silent=True))
        user = service.register(get_db, email, validators.new_password(password))
        return jsonify(user=user, token=issue_token(user["id"])), 201

    @blueprint.post("/login")
    def login():
        email, password = validators.credentials(request.get_json(silent=True))
        user = service.authenticate(get_db, email, password)
        return jsonify(user=user, token=issue_token(user["id"]))

    @blueprint.get("/me")
    @require_auth
    def current_user():
        return jsonify(user=service.current_user(get_db, g.user_id))

    return blueprint
