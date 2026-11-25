"""HTTP contract for account registration, sign-in, and the current actor."""

from flask import Blueprint, g, jsonify, request

from core.auth import issue_token
from core.errors import ValidationError

from . import passkeys, service, validators


def passkey_body():
    request.max_content_length = 96 * 1024
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ValidationError("Start the passkey prompt again.")
    return body


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

    @blueprint.post("/passkeys/enroll/options")
    @require_auth
    def passkey_enrollment_options():
        body = passkey_body()
        return jsonify(passkeys.enrollment_options(get_db, request.headers.get("Origin"), g.user_id, body.get("password")))

    @blueprint.post("/passkeys/enroll/verify")
    @require_auth
    def passkey_enroll():
        passkeys.finish_enrollment(get_db, request.headers.get("Origin"), g.user_id, passkey_body())
        return "", 204

    @blueprint.post("/passkeys/login/options")
    def passkey_login_options():
        return jsonify(passkeys.login_options(request.headers.get("Origin")))

    @blueprint.post("/passkeys/login/verify")
    def passkey_login():
        user = passkeys.finish_login(get_db, request.headers.get("Origin"), passkey_body())
        return jsonify(user=user, token=issue_token(user["id"]))

    return blueprint
