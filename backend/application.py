"""Shared Flask application composition primitives.

``app.py`` is the public WSGI entry point and composition root. Keeping app
construction here gives every domain blueprint one stable registration seam
without importing business domains into this module.
"""

from collections.abc import Iterable

from flask import Blueprint, Flask


def create_flask_app(import_name: str, config_object) -> Flask:
    """Create a Flask application configured from ``config_object``."""

    app = Flask(import_name)
    app.config.from_object(config_object)
    return app


def register_blueprints(app: Flask, blueprints: Iterable[Blueprint]) -> Flask:
    """Register an explicit collection of domain blueprints and return ``app``."""

    for blueprint in blueprints:
        app.register_blueprint(blueprint)
    return app
