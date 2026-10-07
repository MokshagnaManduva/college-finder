# Free temporary demo: Vercel + Render

Prepared 8 October 2026. The user selected dashboard setup, a Vercel frontend, and a free Render
API/PostgreSQL demo. No paid hosting is authorized. This project is the repository root; the
sibling reference project is not part of the deployment.

The private source repository is [MokshagnaManduva/college-finder](https://github.com/MokshagnaManduva/college-finder).

## What has been verified locally

40 backend tests and 27 frontend tests pass. Frontend tests and the production build were also
checked with Node 24. The full Python 3.13 Dockerfile built successfully. On a fresh isolated
PostgreSQL 16 database, its default command applied both Alembic migrations, atomically loaded
19 labelled demo colleges/57 courses and 18 reviewed claims, and started FastAPI.

The HTTP rehearsal checked production frontend routes/assets, readiness, CORS, discovery,
comparison, registration, login and workspace create/edit/read/delete. Restarting the API preserved
the catalog and skipped bootstrap. These are local rehearsal results, not a deployed-site pass.
HTTP/API checks do not replace the visual browser walkthrough.

## Live deployment status

On 8 October 2026, Vercel successfully deployed commit `01a3a55`. The frontend is
[college-finder-peach.vercel.app](https://college-finder-peach.vercel.app), with the API at
[college-finder-demo-api.onrender.com](https://college-finder-demo-api.onrender.com/api/health/ready).
The compiled frontend targets that API's `/api` URL. The configured frontend origin now passes
CORS preflight. The deployed smoke script passed frontend routes/assets, health/readiness,
reviewed data, discovery, comparison, registration, login and workspace create/edit/read/delete.
A labelled smoke-test account remains on the temporary database; its workspace entry was removed.
Safari visibly loaded the live Home/Explore pages and completed the Sources walkthrough at
desktop and 360 × 900 px in Responsive Design Mode. Coverage counts, annual/semester notes,
reviewer/hash details and narrow-screen wrapping passed. Space collapsed the review disclosure,
and the Electrical Engineering course link selected that course on detail. Responsive mode was
exited after checking. This is desktop emulation; physical-phone and full screen-reader checks
remain separate.

## 1. Create the backend and database on Render

Open [Render](https://dashboard.render.com/), connect the private GitHub repository, and create
a Blueprint using the root [render.yaml](render.yaml). Review the proposed resources: both plans
must say **Free**, both use Singapore, and the database uses PostgreSQL 16. The database accepts
only Render-internal connections; no local database or local student notes are uploaded.

The Blueprint generates a fresh JWT secret and obtains the private database URL from the database
resource. Do not copy the local `.env` or create the shared `demo@college.in` login on this server.
At the `FRONTEND_URL` prompt, enter the actual Vercel production origin if it is already known.
Otherwise use `https://example.invalid` temporarily; replace it in step 3 before using accounts.

The Docker start command runs migrations, then opt-in demo bootstrap, then the web server.
`BOOTSTRAP_DEMO_CATALOG=true` initializes only an empty catalog; it never creates users and never
resets an existing catalog. Initialization and reviewed claims share a transaction. Ordinary demo
seeding stays disabled through `ALLOW_DEMO_SEED=false`. Subsequent reviewed-data updates are
an explicit operator task, rather than an automatic reseed on deployment.

Wait for the service to become live, then copy its actual HTTPS URL. Visiting
`<backend-origin>/api/health/ready` must return `{"status":"ok","database":"ok"}`.
Keep the service at one instance; startup migrations assume a single deployment process.
Automatic backend deploys are disabled, so later source commits do not silently redeploy it.

## 2. Import the frontend on Vercel

Open [Vercel](https://vercel.com/new), import the same private repository, and use these settings:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite |
| Node version | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build:deploy` |
| Output Directory | `dist` |
| `VITE_DATA_MODE` | `api` |
| `VITE_API_URL` | Actual Render API service HTTPS origin; `/api` is appended automatically |
| `VITE_TEMPORARY_DEMO` | `true` |

Set these environment variables for **Production** before building. The deployment build rejects
the development `/api` default, HTTP/database/dashboard URLs and fixture-only mode. A bare HTTPS
API origin or an origin ending in `/api` is accepted and normalized for the compiled frontend.
SPA rewrites and asset caching
are in [frontend/vercel.json](frontend/vercel.json). Frontend variables contain only public settings;
the database URL and JWT secret belong only on Render.

## 3. Bind the actual frontend origin

Copy Vercel's actual production HTTPS origin, without a path or trailing slash. On the Render API,
replace `FRONTEND_URL` with that origin and apply the environment change/redeploy. Do not use a
preview deployment's changing URL. CORS permits the configured origin; until it matches, the
browser's account requests will fail even if the backend health check succeeds.

The public UI displays a temporary-demo notice and links to workspace backup. Render documents
that free PostgreSQL expires after **30 days**, followed by a grace period before deletion, and
that free API services spin down when idle. This setup is a temporary demonstration, not durable
storage for real applications. See [Render's free limits](https://render.com/docs/free).

## 4. Check the deployed journey

Once both URLs are known, run from this repository:

```bash
python3 tools/deployment_smoke.py \
  --frontend-url https://YOUR-ACTUAL-FRONTEND.vercel.app \
  --api-url https://YOUR-ACTUAL-BACKEND.onrender.com/api \
  --account-check
```

Replace both example origins with the actual deployed URLs. The script waits for API readiness,
checks frontend routes/assets, CORS and reviewed data, and optionally creates one labelled test
account. Its disposable workspace entry is removed; the test account remains. It does not touch
existing accounts or print credentials. Omitting `--account-check` leaves it read-only.

In Safari, visit the **production** frontend and check Explore → selected course → Compare →
Workspace, then sign in, edit a test note and reload. Open `/sources`: expect 9 of 57 tuition claims,
9 of 57 duration claims, 9 reviewed courses and 8 cited document hashes. Open Review details and
follow an electrical/chemical/mechanical course link to confirm that course is selected. Check
the Sources layout at desktop and 360 px. Record the actual result in `RELEASE_CHECKS.md`.

The public URLs, deployed HTTP/API checks and Sources visual walkthrough are recorded above.
Broader physical-device/accessibility checks remain separate.

## Provider references

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
