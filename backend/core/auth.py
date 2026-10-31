"""Bearer-token authentication shared by every domain.

The token only proves identity (`g.user_id`). Authorization decisions belong to
the owning domain's policies and repositories, which must scope every query to
the authenticated actor.
"""

from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, request

from .errors import error_response


def issue_token(user_id):
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(seconds=current_app.config["AUTH_TOKEN_TTL_SECONDS"]),
        },
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return error_response("unauthorized", "A bearer token is required.", 401)
        try:
            payload = jwt.decode(header[7:], current_app.config["SECRET_KEY"], algorithms=["HS256"])
            g.user_id = int(payload["sub"])
        except (jwt.InvalidTokenError, KeyError, ValueError):
            return error_response("unauthorized", "The token is invalid or expired.", 401)
        return view(*args, **kwargs)

    return wrapped
