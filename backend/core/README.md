# Platform Core

This package is the backend **platform boundary**: cross-domain infrastructure
that every domain may use and that no single business domain owns.

| Module | Owns |
|---|---|
| `config.py` | Environment-driven runtime configuration |
| `database.py` | Drop-tolerant `get_db()` connections and the `transaction()` helper |
| `errors.py` | The JSON error contract, `DomainError` subclasses, and database 503 handling |
| `auth.py` | Bearer-token issue/verification and the `require_auth` decorator |

Rules:

- No business rules, SQL for business tables, or domain workflows live here.
- Domains receive `get_db` and `require_auth` through their blueprint factory
  instead of importing the Flask app.
- The package is named `core` rather than `platform` because a top-level
  `platform` package would shadow Python's standard-library `platform` module.
