


# AI Command That I Always Start With

Before doing anything else, read README.md end-to-end.
Pay close attention to the project rule about not using npm outside Docker.
Your task:
1. Read the last few days of journal entries.
2. Review the schema file at backend/app_schema.py
3. Make sure you journal as we work.
After reviewing those items, report back before making any changes.




# Beck's Clay Figures

A barebones full-stack starter: React 18 + PrimeReact frontend, Flask API,
PostgreSQL, shared Traefik routing, and Dockerized scheduled jobs. It carries
the structure and operating rules of a production modular monolith with only a
replaceable example domain as content.

This README is the **operating manual**. Read it end-to-end before changing
anything, then read the latest file in `work_journal/`.

## Mission and Product Notes

_Replace this section with the application's mission, principles, goals, and
product vision. Keep business reasoning here; keep standards and setup below._

## Platform Architecture

The target is a modular monolith: one repository and deployment, one canonical
identity, one canonical record per business entity, role-specific workspaces,
and strict backend authorization. Architecture standards, domain ownership,
and accepted decisions live in [`docs/architecture/`](docs/architecture/README.md).

### Mandatory Evidence-First Rule

Use an evidence-first approach. Before answering, inspect the relevant project
files. Do not assume standard project conventions apply here. State what you
verified, what remains uncertain, and do not make changes based on an
unverified assumption.

### Development Reloads

Frontend edits can hot-reload the dev app and clear temporary browser state.
Routine frontend edits and app-local dev reloads can proceed without separate
live-browser confirmation. After frontend changes, say when it is safe to
refresh. After backend edits, restart the backend and verify the change imports
before the operator tests it because the Flask reloader can miss changes.

### Mandatory Domain-Organization Rule

This is one application, but it must never become one tangled body of code.
Domain organization is mandatory for every feature, refactor, migration, API
route, background job, and UI workflow.

Before implementation, every change must identify:

- the business domain that owns the behavior and its source of truth;
- the authorization policy and canonical identifiers involved;
- whether another domain is called through an explicit, narrow contract;
- where its backend routes, services, repositories, policies, tests, and
  frontend workflow belong; and
- how the change avoids duplicating logic or data already owned elsewhere.

Business logic goes in `backend/domains/<name>/` and the matching
`frontend/src/domains/<name>/`. `backend/app.py` is the composition root only;
it must not accumulate domain workflows. Shared identity, database, error, and
application infrastructure belong to the platform boundary (`backend/core/`).
Record new domains in [`docs/architecture/domain-ownership.md`](docs/architecture/domain-ownership.md).

## Production State Rule

Never use `localStorage`, `sessionStorage`, IndexedDB, or any browser-only store
for business records, user decisions, workflow state, saved preferences, or
anything a user expects to follow their account across browsers or devices.
Persistent user state belongs in the database behind ownership-checked APIs.
Browser storage is allowed only for genuinely transient client behavior, and
only after discussing it with the product owner. Never use browser persistence
as a shortcut or temporary substitute for a database-backed design.

The only current exceptions are the bearer token in `localStorage` and a
navigation-only login return path in `sessionStorage`
([ADR 003](docs/architecture/decisions/003-authentication-session-model.md)).

## Daily Work Journal

Daily journaling is an essential task. Create or append
`work_journal/YYYY-MM-DD.txt` continuously as work progresses, not only at the
end of a session. Every new note begins with `# AI Used: ChatGPT` or
`# AI Used: Claude`, and each entry records reason, investigation, root cause,
change made, why this approach, files touched, database changes, verification
commands, results, blockers, and next steps. The full standard and template are
in [`work_journal/README.md`](work_journal/README.md).

The journal is the session log; this README is the current operating manual.
Update this README whenever product behavior, setup rules, schema expectations,
or the endpoint surface changes meaningfully.

Future sessions read this README and the latest journal before making product
or architecture decisions. A session that may touch data, SQL, migrations, jobs,
or query logic also inspects the live schema first (see Schema Orientation).

## Quick Start

This repo is Docker-first for builds and local development.

- The frontend uses npm only inside Docker image builds and existing containers.
- Never run `npm install`, `npm ci`, `npm start`, `npm test`, or `npm run build` on the host.
- Never create a host-side `frontend/node_modules` folder.
- Never bind-mount the whole frontend over `/app` or add a separate `/app/node_modules` volume.
- Build and run the app through Docker Compose only.

### Running beside other local apps

This app shares one local Traefik with sibling projects on the external
`proxy-net` network. It routes **only** `DEV_APP_DOMAIN`
(`becksclay.localhost`), binds no host ports, and has unique `APP_SLUG` /
`COMPOSE_PROJECT_NAME` values. Do not give it a bare `localhost` router: another
app may already own that hostname. If you copy this starter for another app,
change `APP_SLUG`, `COMPOSE_PROJECT_NAME`, and `DEV_APP_DOMAIN` first.

### Standard local flow

```bash
cp .env.example .env          # then set DB_SCHEMA, APP_SECRET_KEY, and CONNECTION_STRING / DEV_CONNECTION_STRING
```

Make sure a shared Traefik is serving port 80 (see [`traefik-local/README.md`](traefik-local/README.md)):

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i traefik    # reuse it if one is running
```

Apply migrations, then start the stack:

```bash
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml run --rm --no-deps backend python scripts/apply_migrations.py
docker compose -f docker-compose.dev.yml up -d
```

Open:

- **Frontend** at http://becksclay.localhost
- **Backend health** at http://becksclay.localhost/api/health

### Stop services

```bash
docker compose -f docker-compose.dev.yml down
```

### Frontend Dependency Rule

- `frontend/Dockerfile.dev` and `frontend/Dockerfile` install dependencies with
  `npm ci` from the committed `package-lock.json` during the image build.
- The dev stack mounts only `frontend/src` and `frontend/public`.
- After changing `package.json`, regenerate the lockfile inside a Docker build
  (never on the host) and rebuild:

```bash
docker compose -f docker-compose.dev.yml up -d --build frontend
```

### Development database

The root `.env` is shared by both Compose files. Set `DEV_CONNECTION_STRING` to
a separate database (for example a branch of production) and the dev backend
and dev jobs use it instead of `CONNECTION_STRING`. Practice or seed data must
only ever be written to that separate database.

## Testing

### Frontend test rule

When the dev stack is running behind Traefik, run frontend commands in the
existing container with `exec`, never `run`:

```bash
docker compose -f docker-compose.dev.yml exec -T -e CI=true frontend npm test -- --watchAll=false
docker compose -f docker-compose.dev.yml exec -T -e CI=true frontend npm test -- --watchAll=false src/services/api.test.js
```

`docker compose run frontend ...` creates one-off `frontend-run-*` containers
that can stay attached to the proxy network; Traefik then load-balances between
them and the real dev server and the site returns `502`.

Run only one frontend test or build at a time. A timed-out command does not
prove its process stopped; inspect before retrying:

```bash
docker compose -f docker-compose.dev.yml exec frontend ps -o pid,ppid,stat,etime,args
docker compose -f docker-compose.dev.yml restart frontend   # if a stale test/build process remains
```

### Backend, job, and shell tests

```bash
docker compose -f docker-compose.dev.yml exec -T backend pytest -q
JOB_COMPOSE_FILE=docker-compose.dev.yml ./scripts/run_job.sh example-job pytest -q
./scripts/test_shell.sh
./scripts/test_safe_env_reader.sh
./scripts/test_automation_notifications.sh
```

### Mandatory test closeout rule

Before ending any test or build task:

- Inspect running containers and confirm no `frontend-run-*`, browser-test,
  preview-server, or other one-off container remains.
- Stop and remove every one-off container the task created, even after `--rm`.
- Never leave a test runner attached to `proxy-net`.
- Verify both routes through Traefik:

```bash
docker ps -a --filter label=com.docker.compose.project=becks-clay-figures \
  --format '{{.Names}}\t{{.Status}}\t{{.Label "com.docker.compose.service"}}'
curl -sS -o /dev/null -w 'frontend=%{http_code}\n' http://becksclay.localhost/
curl -sS -o /dev/null -w 'backend=%{http_code}\n' http://becksclay.localhost/api/health
```

Remove only the exact one-off containers you identified. For real stray
containers or a `502`, reset only this project:

```bash
docker compose -f docker-compose.dev.yml down --remove-orphans
docker compose -f docker-compose.dev.yml up -d
```

## Schema Orientation

All application tables live in the PostgreSQL `becks_clay` schema. Fully
qualified relation names therefore use `becks_clay.*`; do not add new tables
to the generic `app` or `public` schemas.

The namespace is configured once with `DB_SCHEMA` in `.env`. It is deliberately
separate from `APP_SLUG`: infrastructure slugs may contain hyphens and may be
renamed, while PostgreSQL schemas use stable lowercase snake_case identifiers.
The backend, jobs, and migration tools validate `DB_SCHEMA`, set it as their
connection `search_path`, and keep ordinary SQL and migration files free of a
hardcoded application schema. When copying this boilerplate, change
`DB_SCHEMA`; do not search-and-replace SQL relation names.

- Canonical snapshot: [`backend/app_schema.py`](backend/app_schema.py) composes
  every migration in order (`python app_schema.py --print-sql`).
- Migrations: `backend/migrations/NNN_description.sql`, each wrapped in
  `BEGIN;` … `COMMIT;`, numbered, append-only.
- Ledger: `becks_clay.schema_migrations` records each applied file and its SHA-256.

Inspect the live schema before database or query changes:

```bash
docker compose -f docker-compose.dev.yml exec backend python scripts/inspect_schema.py
```

### Adding a migration

1. Inspect the live schema.
2. Add the next numbered, BEGIN/COMMIT-wrapped file. Prefer additive,
   rerun-safe statements (`IF NOT EXISTS`).
3. Append its filename to `MIGRATIONS` in `backend/app_schema.py` (a test fails otherwise).
4. Apply and verify:

```bash
docker compose -f docker-compose.dev.yml exec backend python scripts/apply_migrations.py --dry-run
docker compose -f docker-compose.dev.yml exec backend python scripts/apply_migrations.py
docker compose -f docker-compose.dev.yml exec backend python scripts/check_schema_migrations.py
```

Never edit an applied migration; write a forward correction. The apply script
refuses to run if a recorded checksum changed or the ledger has unknown rows.
For production, back up first and review every pending file
([ADR 002](docs/architecture/decisions/002-database-migration-standard.md)).

## API Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Liveness |
| POST | `/api/auth/register` | — | Create account (`409` if the email exists) |
| POST | `/api/auth/login` | — | Bearer token for valid credentials |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/figures` | — | Publicly list clay figures and asset metadata |
| GET/POST | `/api/items` | Bearer | List / create the caller's example items |
| PATCH/DELETE | `/api/items/<id>` | Bearer | Update / delete the caller's item (`404` otherwise) |

Every error response is `{"error": {"code": "...", "message": "..."}}`.

## Error-Handling Standard

- Request connections come from `core.database.get_db()`, which is
  drop-tolerant: `rollback()`/`close()` become no-ops once the database has
  dropped the connection, so cleanup never replaces the real error.
- `core/errors.py` maps domain errors to their status, dropped connections
  (`psycopg2.InterfaceError`/`OperationalError`) to `503`, and anything else to
  a generic `500`. Debug mode must never serve the Werkzeug HTML page.
- `services/api.js` retries a GET/HEAD once after a 500/502/503/504 or network
  failure. Writes are never retried automatically.
- An HTML or overlong text error body is never shown; the client shows a short
  "could not complete this request (HTTP n)" line instead.
- Frontend tests must not depend on container environment variables; mock
  network modules explicitly.

## Frontend Loading-State Standard

The development gallery at `/?preview=local` has a **Preview a local GLB** picker in the
Collection panel. Each local GLB gets a model thumbnail and a **⋯ → Delete**
action. The collection lives in the browser until you leave or reload the
gallery. It uses a version-pinned Model Viewer module from jsDelivr.
The public gallery is available signed out. Sign in opens a dialog over the
gallery. To set up device sign-in, select **Add a passkey after signing in** in
the password dialog and follow the setup prompt,
then select **Sign in with a passkey** on later visits. Passkeys are tied to the
site hostname. Use the public HTTPS address for phones and enroll on the hostname
where you plan to sign in. Keep the exact origins in `CORS_ORIGINS`.
For signed-in visitors, the upload icon opens the GLB picker, shows
the model immediately, and attempts to save it with a name based on the
filename. If a session expires during upload, the sign-in dialog opens and
resumes the selected file after sign-in. Every signed-in account can save a GLB to R2 and its metadata to
PostgreSQL. Accounts can edit their own figures and attach an optional gallery
photo. The configured gallery owner can star a model they uploaded to pin it
first and make it the gallery's default view.
The desktop stage has zoom and reset buttons and an orientation widget to
snap to the front, right, or top view. Mobile uses drag and pinch gestures.
Set `CLAY_GALLERY_OWNER_USER_ID` only if you want to enable the gallery-wide
featured model action. Set the R2 credentials and bucket from `.env.example`. Use a separate dev
database and bucket when publishing test figures.
The GLB upload limit defaults to 250 MB. Set `CLAY_GALLERY_MODEL_MAX_MB` in
`.env` to adjust it, then recreate the backend container so it reads the change.
When the owner views a saved model without a gallery photo, the viewer can
generate and save a small thumbnail. Use **Edit → Generate thumbnail** to retry.
An uploaded gallery photo takes precedence.
For large saved models, the gallery prefers a smaller `web_model` derivative
when available. A saved image remains visible during 3D loading and on failure.
The uploaded GLB remains the original. See the clay gallery domain guide for
the offline derivative workflow.

For direct GLB uploads, configure R2 CORS with the exact dev and production
origins, method `PUT`, and allowed header `Content-Type`. The private bucket
uses short-lived signed PUT URLs. The API checks the staged model and publishes
it only after verification. If browser access to R2 fails, the uploader can
use the existing API relay. Configure an R2 lifecycle rule for the `staging/`
prefix to expire abandoned uploads.

- Use `components/PageLoader.jsx` for every loading state instead of plain
  text or a new spinner.
- Use the default loader for full-page waits and `compact` for cards, tables,
  charts, and panels.
- Give every loader a specific accessible `label` (for example `Loading example items`).
- Keep error and empty states (`components/StatusState.jsx`) distinct from loading.

## Data Presentation Design Strategy

- Start with the user's question; put a short question-led heading near each visual.
- Prefer one strong visual over many small cards. Avoid cards inside cards.
- Compactness is the default: controls and rows near 32–40px, buttons smaller
  than inputs (`AppButton` compact 26px / standard 32px), lightly rounded
  corners (4–8px). Reserve pills for tags and statuses.
- Use typography, weight, alignment, and thin dividers for hierarchy before
  adding containers or height.
- Style opened dropdown panels explicitly; never ship the unstyled default.
- Keep primary answers visible and methodology behind a small details control.
- Teach the calculation, not just the result: tooltips show the real inputs and
  each step with actual values, and update from current state.
- Never hide uncertainty, units, source, period, or geography to simplify;
  keep "no data" distinct from zero or a favorable result.
- When the best visual is uncertain, prototype alternatives side by side from
  the same data before standardizing, and record the chosen pattern.

### Logged-In Application Form Standard

Authenticated forms, dialogs, and confirmations reuse
`frontend/src/components/authenticated-ui/` (`AppButton`, `AppActionGroup`,
`AppActionBar`, `AppField`, `AppFormDialog`) instead of inventing a page-owned
treatment. Unauthenticated entry screens may keep their own design.

Gallery dialogs use the shared charcoal appearance for grouped fields,
indigo primary actions, and mobile-friendly inputs. Sign-in, registration,
and figure editing use this same appearance.

- `AppButton` variants carry meaning: `primary` main action, `secondary`
  alternate workflow, `accent` highlighted transition, `outline` restrained
  confirmation, `text` cancel/low emphasis, `danger` destructive.
- Related actions use `AppActionGroup`. Page CSS may position primitives but
  must not redefine their height, padding, icon gap, typography, radius,
  disabled, or focus states.
- Group related inputs in one lightly outlined section; show optional status in
  the label; keep actions right-aligned and compact.

## Scheduled Data Jobs

Every scheduled job is a small, independently buildable Docker service under
`jobs/`, follows [`docs/scheduled_data_job_standard.md`](docs/scheduled_data_job_standard.md),
and is designed with [`docs/data_extraction_workflow.md`](docs/data_extraction_workflow.md).

Data warehouse rules:

- One `dataset_key` per distinct upstream file/feed, grain, and cadence; each
  has a source registry row and its own run history.
- Keep source cadence separate from poll cadence. A successful no-change poll
  is `unchanged`, not a failure and not "data changed".
- Reuse storage tables only when the normalized row shape and meaning match.
- No dataset reaches the UI until it has a registry row, a focused collector,
  logged runs, a known latest period, freshness status, and a plain-language
  explanation.

Run the example job:

```bash
JOB_COMPOSE_FILE=docker-compose.dev.yml ./scripts/run_job.sh example-job   # dev database
./scripts/run_example_job.sh                                               # production wrapper
```

Production cron calls only the wrapper:

```cron
17 3 1 * * /absolute/path/to/repo/scripts/run_example_job.sh
```

### Scheduled-job failure notifications

All wrappers share one private Discord webhook,
`AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL`. A failed wrapper sends one alert
(job, host, stage, exit code, time, log path) and preserves the original exit
code. Success, unchanged, skipped, and overlapping runs are silent. Test
locally without a real webhook with `./scripts/test_automation_notifications.sh`.

### Host-side secret loading rule

- Store real secrets only in the untracked root `.env` (`chmod 600 .env` on servers).
- Wrappers read only explicitly allowlisted keys through `scripts/lib/safe_env.sh`.
- Parse values as data; never `source .env`, use `eval`, or execute the file.
- An explicitly exported variable may override `.env` for temporary testing.
- Never duplicate secrets in crontab, tracked files, docs, chat, or `.env.example`.

## Architecture

```text
.
├── backend/   app.py · application.py · app_schema.py · core/ · domains/ · migrations/ · scripts/ · tests/
├── frontend/  src/{app, domains, workspaces, shared, components, services, lib}
├── jobs/      example/ · shared/
├── scripts/   run_job.sh · run_example_job.sh · lib/ · tests
├── docs/      architecture/ · data_extraction_workflow.md · scheduled_data_job_standard.md
└── work_journal/
```

Full tree and responsibilities: [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md).

## Environment Variables

| Variable | Purpose |
|---|---|
| `APP_SLUG` | Unique Traefik router/service prefix |
| `COMPOSE_PROJECT_NAME` | Unique Compose project name |
| `DB_SCHEMA` | Required stable PostgreSQL namespace in lowercase snake_case |
| `TRAEFIK_NETWORK` | Shared external proxy network (`proxy-net`) |
| `TRAEFIK_DEV_ENTRYPOINT` | Local HTTP entrypoint (`web`) |
| `TRAEFIK_PROD_ENTRYPOINT` | Production HTTPS entrypoint |
| `TRAEFIK_CERT_RESOLVER` | Production certificate resolver |
| `REACT_APP_API_BASE_URL` | Browser API prefix; keep `/api` |
| `DEV_APP_DOMAIN` | Unique local `*.localhost` hostname |
| `APP_DOMAIN` | Production hostname |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `FLASK_ENV`, `FLASK_DEBUG` | Development behavior |
| `APP_SECRET_KEY` | Token signing secret (identical everywhere it is used) |
| `AUTH_TOKEN_TTL_SECONDS` | Sign-in token lifetime, 24 hours by default |
| `CONNECTION_STRING` | PostgreSQL connection URI |
| `DEV_CONNECTION_STRING` | Optional separate dev database |
| `AUTOMATION_FAILURE_DISCORD_WEBHOOK_URL` | Optional private failure webhook |

Never commit `.env`.

## Production Deployment

Production runs behind a Traefik instance with `web`, `websecure`, and the
configured Let's Encrypt resolver. The backend runs Gunicorn; the frontend is a
compiled SPA served by Nginx; `/api` has higher router priority and gzip
compression. Production is served at
`https://becksclay.gravvisoft.com`; its DNS record must resolve to the
Traefik host before the first certificate request.

```bash
cp .env.example .env    # set production values; chmod 600 .env
docker network create proxy-net 2>/dev/null || true
docker compose build
docker compose run --rm --no-deps backend python scripts/apply_migrations.py
docker compose up -d
```

Deployment checklist:

- [ ] Unique slug, Compose project, proxy network, and domain values.
- [ ] DNS for `becksclay.gravvisoft.com` resolves to the production host.
- [ ] Strong `APP_SECRET_KEY`; `.env` permissions restricted.
- [ ] Database backup verified; pending migrations reviewed, applied, and `check_schema_migrations.py` passes.
- [ ] Backend, frontend, job, and shell tests pass.
- [ ] `/api/health` answers through HTTPS; unknown frontend paths fall back to the SPA.
- [ ] Cron installed only after a job is validated and safe to rerun.

## Troubleshooting

- **Production `/` returns `404` while `/api/health` returns `200`:** run
  `docker compose ps` and inspect the frontend's Docker health output with
  `docker inspect "$(docker compose ps -q frontend)" --format '{{json .State.Health}}'`.
  Traefik can omit the router for an unhealthy frontend. Keep the NGINX probe
  on `127.0.0.1:80`, rebuild the frontend after changing its Dockerfile, and
  verify both public routes once the frontend is healthy.
- **`404` / `502`:** confirm a shared Traefik serves port 80, both services are
  running on `proxy-net`, and router names are unique. Clear stray `frontend-run-*` containers.
- **Port 80 already in use:** another app's Traefik is running. Reuse it; do not start `traefik-local`.
- **Frontend dependency errors:** never run npm on the host; rebuild with
  `docker compose -f docker-compose.dev.yml up -d --build --force-recreate frontend`.
- **Backend change not visible:** restart the backend and verify the import.
- **Backend cannot connect:** check `CONNECTION_STRING`/`DEV_CONNECTION_STRING` from inside the container.
- **Registration fails with 500:** run `scripts/apply_migrations.py`, then `check_schema_migrations.py`.
- **Job reported `unchanged`:** a successful idempotent outcome, not a failure.

## Tech Stack

- **Frontend:** React 18, React Router 6, PrimeReact 10, PrimeIcons 6, PrimeFlex 3, Create React App 5
- **Backend:** Flask 3, Flask-CORS, psycopg2, PyJWT, Gunicorn, pytest
- **Infrastructure:** Docker Compose, Traefik v3, Nginx, PostgreSQL
