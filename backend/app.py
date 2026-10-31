"""WSGI entry point and application composition root.

This file wires platform infrastructure to domain blueprints. It must not
accumulate business workflows: new behavior belongs in `domains/<name>/`.
"""

from flask_cors import CORS

from application import create_flask_app, register_blueprints
from core.auth import require_auth
from core.config import Config
from core.database import get_db
from core.errors import register_error_handlers
from domains.example_items import create_example_items_blueprint
from domains.identity import create_identity_blueprint


def create_app(config_object=Config, *, db=get_db):
    app = create_flask_app(__name__, config_object)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    register_error_handlers(app)

    @app.get("/health")
    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    register_blueprints(app, [
        create_identity_blueprint(get_db=db, require_auth=require_auth),
        create_example_items_blueprint(get_db=db, require_auth=require_auth),
    ])
    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
