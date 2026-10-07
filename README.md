# College Finder

A redesigned college decision workspace built with React, TypeScript, FastAPI and PostgreSQL 16.
The connected application supports discovery, registration/login, account preferences and
persistent workspace entries. The original `../CollegeFind-main` project remains the reference.

## Run locally

Prerequisites: Python 3.12+, Node.js 22.18+ (24+ recommended), and a running Docker daemon.
Run these commands from `College_Finder`:

```bash
make setup
cp backend/.env.example backend/.env
```

Set `JWT_SECRET` in `backend/.env` to a unique value of at least 32 characters. Generate one with:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

For the local demo dataset, also set `ALLOW_DEMO_SEED=true`. Then:

```bash
make db
make migrate
make seed
make api
```

In a second terminal, run `make web`. Open **http://localhost:5173**; API documentation is at
**http://localhost:8000/api/docs**. Vite proxies `/api` to the backend. Regular HTTP development
uses the API by default and reports connection errors instead of silently switching to fixtures.

Optional: run `make seed-demo` to create the local demo account `demo@college.in` / `demo1234`.
The seed does not reset an existing account's password or remove its notes.

The supplied Compose credentials are for local development. If port 5432 is occupied, set
`POSTGRES_PORT` when running Make and update the backend `DATABASE_URL` to the same host port.
Migrations must run before seeding; repeat seeds update deterministic demo records without
removing users or workspace entries. The schema uses PostgreSQL 16 features.

## Working features

- A completely new ivory/forest interface with responsive navigation and layouts.
- Course-aware discovery with search, degree/state/budget filters, sorting and pagination.
- College details, selectable courses, source labels and a shared complete/partial cost calculator.
- Optional preferences, strict/flexible requirements and explainable matching.
- Comparison of up to three course options with persisted, URL-backed selections.
- Guest or account workspace with list/board views, stages, private notes, next actions, personal
  target dates, saved cost scenarios and CSV export.
- Registration/login, startup session validation and owner-scoped account persistence.
- Retry-safe guest import, explicit browser/account conflicts and revision checks for newer edits.
- JSON backup/import and a downloadable browser recovery copy.

The directory starts with 19 colleges and 57 courses from **demo data**. An optional reviewed pilot
adds source-linked tuition and duration for nine courses at IIT Bombay, IIT Delhi, IIT Madras,
NIT Trichy and IISc; the expanded batch is applied in the current local database.
Other claims remain demo data. Sources and missing data remain visible; personal
dates are student targets. Photos are illustrative. Reviews, forums,
popularity badges and rank predictions have been removed from the active product.

## Reviewed course data

After migrations, run `make review-pilot` to preview the included official-source review and
`make apply-pilot` to apply it. The import preserves course IDs and student notes, protects reviewed
values from demo reseeding, and displays fee scope/annualization in the connected app. The standalone
preview retains its demo fixtures. See [SOURCE_REVIEW.md](SOURCE_REVIEW.md) for evidence, format,
commands and the remaining data work.
Use `make review-directory` / `make apply-directory` for the current nine-course batch.
The earlier four-course batch remains available through `make review-batch` / `make apply-batch`.
Applying reviews requires
retained source PDFs that match the manifest hashes. Open `/sources` (also linked from the data
banner) to see claim coverage, cited documents and course-specific review details.

## Guest notes and account sync

Guest entries stay in versioned browser storage. Signing in imports distinct college/course
options. If an account option differs, its version stays active until the student chooses which
version to keep; browser notes remain available for review. Interrupted imports reuse their
idempotency key and preserve additions or edits made after the saved request. Account edits use
revisions so a stale editor cannot silently overwrite a newer save.

The standalone preview and the HTTP app have separate browser storage. In the old preview,
open My workspace → **Export backup**; in the connected app, use **Import backup**. CSV exports
are for reading in a spreadsheet; use JSON to transfer full notes, preferences and cost scenarios.
**Export browser recovery** downloads the retained guest copy after sync. Treat backups as private.
Signing out clears the active account view and private query cache; account entries are not copied
into guest storage.

## Standalone preview

Open [preview/college-finder.html](preview/college-finder.html) directly in a browser for the
fixture-based guest experience. No backend is needed, and account sync requires the connected app.
Fonts/photos use external URLs with local visual fallbacks.

```bash
make preview  # rebuilds the production bundle and standalone HTML
```

For a fixture-only Vite session, set `VITE_DATA_MODE=demo` in `frontend/.env.local`. Otherwise,
use `frontend/.env.example` for API configuration. Vite environment changes require a restart.

## Checks

```bash
make test      # PostgreSQL integration tests
make web-test  # focused frontend domain/adapter tests
make lint
make build
```

`make test` starts the local database and creates `college_finder_test` if absent. Tests require
a database name ending in `_test`, reject the application database and use a separate temporary
schema per test. For a different server, supply `TEST_DATABASE_URL`; provision that test database
separately. The backend development dependency snapshot is in `backend/requirements-dev.lock`.

Current verification: **40 backend and 27 frontend tests pass**, Ruff/ESLint pass, and the production
and standalone builds pass. The Python 3.13 API container builds and serves PostgreSQL-backed
catalog and authenticated reads; Alembic reports no schema drift. Local Python 3.14 also passes
the integration suite. Earlier standalone walkthroughs checked responsive discovery, comparison,
costs and guest note persistence. The connected Safari walkthrough now verifies guest note editing,
sign-in/import, account editing, persistence after reload, sign-out clearing the private view, and
restoration after signing back in. A labelled test note remains in the local demo account.
Release review also checked 360/768/1024/1440 px layouts, 200% zoom, dialog focus and mobile
comparison keyboard scrolling. See [RELEASE_CHECKS.md](RELEASE_CHECKS.md) for evidence and scope.

## API and deployment notes

Public discovery, matching and comparison endpoints live under `/api`. Authenticated profile and
workspace endpoints use bearer tokens. Responses use camelCase except `access_token`; OpenAPI
documents request/response types. `/api/health` checks the process and `/api/health/ready` checks
database connectivity. Readiness does not replace migrations.

For deployment, build `backend/Dockerfile`, provide `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
and use its default command, which runs Alembic migrations before serving traffic. Build the frontend with `VITE_API_URL` pointing
to the public backend `/api` URL, and configure SPA rewrites to `index.html`. Match `FRONTEND_URL`
to the deployed frontend origin. Keep `ALLOW_DEMO_SEED=false` outside explicit demo environments.
The [free demo is deployed](https://college-finder-peach.vercel.app), and its HTTP/API checks pass.
A fully reviewed admissions catalog, password recovery, email verification and historical
cutoff exploration remain future work. Dashboard configuration and a clean-database deployment
rehearsal are prepared in [DEPLOYMENT.md](DEPLOYMENT.md). The selected free Render demo has
an explicit empty-catalog bootstrap and never creates the shared demo login. The current directory catalog loads all records for UI
lookups; revisit that approach before a large production dataset.

See [PLAN.md](PLAN.md) for product decisions, milestone status and release gates.
