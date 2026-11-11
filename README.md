# College Finder

A redesigned college decision workspace built with React, TypeScript, FastAPI and PostgreSQL 16.
The connected application supports discovery, registration/login, account preferences and
persistent workspace entries.

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

To load the official catalog locally:

```bash
make db
make migrate
make apply-catalog
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
- Account settings: change password (signs out other devices), sign out everywhere and permanent account deletion.
- Sign-in attempt limits, security response headers, request-size and workspace-size limits.
- Retry-safe guest import, explicit browser/account conflicts and revision checks for newer edits.
- JSON backup/import and a downloadable browser recovery copy.

The directory contains **19 institutions and 28 published programmes** with official source links. It has **13 sourced tuition claims, 27 sourced duration claims, four academic fee/payment claims, eight intake totals, 11 campus facilities and 12 NIRF outcome cohorts**, and every institution now has a sourced founding year. Sample figures, unsupported accreditation claims and stock campus photographs have been removed. The interface now uses real campus/building photographs with individual licenses and credits. Missing information stays unavailable; personal dates remain student targets. Reviews, forums, popularity badges and rank predictions remain outside the active product.

## Official catalog data

Run `make review-catalog` to validate every retained source checksum, then `make apply-catalog` to apply the versioned release. The upgrade preserves accounts, notes and original option IDs; it archives unconfirmed sample programmes instead of deleting them. Demo reseeding cannot overwrite an official catalog. The standalone HTML uses the same public snapshot and retains aliases for archived guest options.

Open `/sources`, linked in the footer, for institution references, claim coverage, original fee periods, graduating cohorts and document checksums. IIM Bangalore's two programme references rely on indexed official pages and have no archived original document; those claims remain unverified. See the [source evidence registry](backend/seed/evidence/README.md) for retained documents and provenance.

Campus photos are served locally, with creator and license links on detail pages and `/sources#photos`.
The [photo credits](frontend/public/images/campuses/CREDITS.md) and `frontend/src/data/campus-photos.json`
record source URLs and retained-image checksums. The standalone preview embeds the images for offline use.

The [fee validation table](backend/seed/evidence/fee-validation-2026-10-08.csv) records the nine checked fee sources.
Tuition excludes mandatory non-tuition charges. SIBM Pune's bundled academic fee is retained as programme context,
with no separate tuition amount inferred. BITS tuition rises after the first year; the calculator explicitly uses constant annual planning inputs.

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

After running `make preview`, open `preview/college-finder.html` directly in a browser for the
official-catalog guest experience. No backend is needed, and account sync requires the connected app.
Fonts use external URLs with local visual fallbacks; campus images are embedded and a neutral icon remains as the image-error fallback.

```bash
make preview  # rebuilds the production bundle and standalone HTML
```

For a standalone-catalog Vite session, set `VITE_DATA_MODE=demo` in `frontend/.env.local`. Otherwise,
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

The tests cover catalog upgrades, authentication, account isolation, workspace persistence,
guest import, matching, costs and frontend adapters.

## API and deployment notes

Public discovery, matching and comparison endpoints live under `/api`. Authenticated profile and
workspace endpoints use bearer tokens. Responses use camelCase except `access_token`; OpenAPI
documents request/response types. `/api/health` checks the process and `/api/health/ready` checks
database connectivity. Readiness does not replace migrations.

For deployment, build `backend/Dockerfile`, provide `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
and use its default command, which runs Alembic migrations before serving traffic. Build the frontend with `VITE_API_URL` pointing
to the public backend `/api` URL, and configure SPA rewrites to `index.html`. Match `FRONTEND_URL`
to the deployed frontend origin (several origins may be comma-separated). Keep `ALLOW_DEMO_SEED=false` outside explicit demo environments.
The existing site is [college-finder-peach.vercel.app](https://college-finder-peach.vercel.app).
Sign-in attempt limits are kept in the API process, so they assume a single API instance; the image trusts
proxy `X-Forwarded-For` headers (`FORWARDED_ALLOW_IPS`, default `*`) and must sit behind the platform proxy.
A fully reviewed admissions catalog, password recovery by email, email verification and historical
cutoff exploration remain future work. Set `BOOTSTRAP_DEMO_CATALOG=true` to apply the versioned
official catalog at backend startup; this does not create the shared demo login.
The current directory catalog loads all records for UI
lookups; revisit that approach before a large production dataset.

## Verified data coverage

The local `official-2026-11-11-r8` catalog contains 19 institutions and 28 programmes: 13 annual tuition claims, 27 durations, four separately labelled academic fee/admission-payment claims, eight JoSAA 2026 intake totals, 11 campus facility claims, 12 institution-reported placement cohorts and a sourced founding year for all 19 institutions. Fees retain their admission year/category; intake is capacity, not vacancies; NIRF outcomes retain their cohort and campus scope. Release r8 added ten founding years, three NIRF 2026 cohorts (Jadavpur, CHRIST, UCE Osmania) and four libraries; see the [r8 source list](backend/seed/evidence/data-expansion-2026-11-11.csv).

Fifteen annual tuition amounts remain unavailable; four of those programmes have separate fee/payment evidence. One IIM Bangalore PGPEM reference still lacks an archived original and stays unverified. See the [source archive and scope notes](backend/seed/evidence/README.md), [expansion audit](backend/seed/evidence/data-expansion-2026-10-09.csv) and [tuition gap audit](backend/seed/evidence/tuition-gaps-2026-10-09.csv).
