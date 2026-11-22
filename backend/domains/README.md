# Backend Domains

Every business capability belongs under this directory as a coherent domain
module. Follow [`docs/architecture/backend-module-standard.md`](../../docs/architecture/backend-module-standard.md).

```text
domains/<name>/
├── README.md        # ownership, endpoints, boundaries (always present)
├── __init__.py      # exports create_<name>_blueprint
├── routes.py        # HTTP translation only
├── validators.py    # normalizes untrusted input
├── service.py       # business rules and transaction boundaries
├── repository.py    # SQL and persistence mapping
├── policies.py      # domain authorization (add when needed)
└── serializers.py   # stable API representations (add when needed)
```

Current domains:

- `identity/` — canonical accounts, registration, sign-in.
- `clay_gallery/` — clay figures and their R2-backed asset metadata.
- `example_items/` — the replaceable reference domain.

Rules:

- A planned domain may start as a README-only directory so the target product
  is visible. Add executable files only with the first real vertical slice; do
  not create placeholder routes, services, or repositories.
- Blueprint factories receive `get_db` and `require_auth`; domains never import
  `app.py`.
- Domains call each other only through documented public services and
  canonical identifiers, never by writing into another domain's tables.
