"""Environment-driven runtime configuration.

The repository root `.env` is the single source of configuration for every
Compose service. Values are read once at import time; tests pass their own
config object to ``create_app`` instead of mutating the environment.
"""

import os


def _csv(name, default=""):
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


class Config:
    SECRET_KEY = os.getenv("APP_SECRET_KEY", "development-only-change-me")
    AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "3600"))
    CONNECTION_STRING = os.getenv("CONNECTION_STRING", "").strip()
    CORS_ORIGINS = _csv("CORS_ORIGINS", "http://boilerplate.localhost")
