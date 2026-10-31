# Project Structure

```text
.
├── README.md                      # operating manual (rules + setup)
├── .env.example                   # every supported setting; copy to .env
├── docker-compose.dev.yml         # dev stack behind the shared local Traefik
├── docker-compose.yml             # production stack behind HTTPS Traefik
├── traefik-local/                 # fallback shared proxy (only if none is running)
├── docs/
│   ├── architecture/              # standards and decision records (this folder)
│   ├── data_extraction_workflow.md
│   └── scheduled_data_job_standard.md
├── backend/
│   ├── app.py                     # WSGI entry point + composition root
│   ├── application.py             # app creation and blueprint registration
│   ├── app_schema.py              # canonical schema snapshot + migration list
│   ├── core/                      # platform boundary: config, db, errors, auth
│   ├── domains/
│   │   ├── identity/              # canonical accounts and sign-in
│   │   └── example_items/         # replaceable reference domain
│   ├── migrations/                # numbered BEGIN/COMMIT-wrapped SQL
│   ├── scripts/                   # apply/check migrations, inspect schema
│   └── tests/
├── frontend/src/
│   ├── App.jsx                    # route table
│   ├── app/                       # startup, routing, auth gating, layout
│   ├── domains/                   # reusable business UI + domain API modules
│   ├── workspaces/                # role-specific composition of domain UI
│   ├── shared/                    # cross-domain helpers (when a 2nd domain needs them)
│   ├── components/                # PageLoader, StatusState, authenticated-ui primitives
│   ├── services/                  # api.js client and auth.js session transport
│   └── lib/                       # framework-agnostic helpers
├── jobs/
│   ├── example/                   # one focused, Dockerized scheduled job
│   └── shared/                    # job helpers once a second job proves reuse
├── scripts/                       # run_job.sh, cron wrappers, shell libs + tests
└── work_journal/                  # daily engineering journal (YYYY-MM-DD.txt)
```

README-only directories are deliberate boundary markers. Add executable code to
them only with a real workflow.
