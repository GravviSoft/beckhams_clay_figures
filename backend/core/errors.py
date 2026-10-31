"""One JSON error contract for every response.

Every error body is ``{"error": {"code": ..., "message": ...}}``. The browser
must never receive the Werkzeug HTML debugger page, a raw database exception,
or a secret, even in debug mode.
"""

import psycopg2
from flask import jsonify, request
from werkzeug.exceptions import HTTPException


class DomainError(Exception):
    """A predictable business failure that maps to a stable HTTP response."""

    status = 400
    code = "domain_error"

    def __init__(self, message, *, code=None, status=None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status:
            self.status = status


class ValidationError(DomainError):
    status = 400
    code = "validation_error"


class NotFoundError(DomainError):
    status = 404
    code = "not_found"


class ConflictError(DomainError):
    status = 409
    code = "conflict"


def error_response(code, message, status):
    return jsonify(error={"code": code, "message": message}), status


def register_error_handlers(app):
    @app.errorhandler(DomainError)
    def handle_domain_error(error):
        return error_response(error.code, error.message, error.status)

    @app.errorhandler(psycopg2.InterfaceError)
    @app.errorhandler(psycopg2.OperationalError)
    def handle_database_connection_error(error):
        app.logger.warning("Database connection error on %s: %s", request.path, error)
        return error_response(
            "database_unavailable",
            "The database connection dropped while loading this data. Please try again.",
            503,
        )

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        return error_response(error.name.lower().replace(" ", "_"), error.description, error.code)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("Unhandled error", exc_info=error)
        return error_response("internal_error", "An unexpected error occurred.", 500)
