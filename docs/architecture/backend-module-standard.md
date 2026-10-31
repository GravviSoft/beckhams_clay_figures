# Backend Module Standard

## Target module shape

```text
domains/<name>/
├── README.md
├── __init__.py        # exports create_<name>_blueprint
├── routes.py
├── validators.py
├── service.py
├── repository.py
├── policies.py        # when the domain has its own authorization rules
└── serializers.py     # when API shapes diverge from repository rows
```

README-only domain boundaries may be created up front so the roadmap is
visible. Executable files are added only when the domain needs them;
placeholder routes, services, and repositories must not be created merely to
fill out the tree.

## Responsibilities

- Routes translate HTTP requests and responses.
- Validators normalize untrusted input and raise `ValidationError`.
- Services own business rules and transaction boundaries (`core.database.transaction`).
- Repositories own SQL and persistence mapping, scoped to the actor.
- Policies own domain-specific authorization.
- Serializers create stable API representations.

Routes must not contain SQL. Repositories must not decide who is authorized.
Frontend state must not authorize backend behavior.

## Application composition

`application.py` provides app creation and blueprint registration primitives.
`app.py` is the composition root: it wires `core` infrastructure into each
domain's `create_<name>_blueprint(get_db=..., require_auth=...)`. It must not
accumulate business workflows.

## Errors

Raise `core.errors` subclasses (`ValidationError` 400, `NotFoundError` 404,
`ConflictError` 409, or a domain `DomainError` with its own code/status). Every
error leaves the API as `{"error": {"code", "message"}}`. Dropped database
connections return 503; unexpected errors return a generic 500 and are logged.
Never return raw exceptions, SQL, secrets, or HTML.

## Tests

Each domain requires proportional coverage for route contracts, validation,
authorization denial / actor scoping, workflow transitions, and transaction
rollback. Inject a fake `get_db` (see `backend/tests/conftest.py`) and
monkeypatch the repository for route tests; verify SQL against a live database
before relying on it.
