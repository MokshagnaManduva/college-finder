# Free temporary demo: Vercel + Render

Prepared 8 October 2026. The user selected dashboard setup, a Vercel frontend, and a free Render
API/PostgreSQL demo. No paid hosting is authorized. This project is the repository root; the
sibling reference project is not part of the deployment.

The private source repository is [MokshagnaManduva/college-finder](https://github.com/MokshagnaManduva/college-finder).

## What has been verified locally

43 backend tests and 29 frontend tests pass. Frontend tests and the production build were also
checked with Node 24. The full Python 3.13 Dockerfile built successfully. On a fresh isolated
PostgreSQL 16 database, its default command applied all Alembic migrations, atomically loaded
19 institution profiles, 28 public programmes and 39 reviewed claims (13 tuition / 26 duration), and started FastAPI.

The HTTP rehearsal checked production frontend routes/assets, readiness, CORS, discovery,
comparison, registration, login and workspace create/edit/read/delete. Restarting the API preserved
the catalog and skipped the already-applied release. These are local rehearsal results, not a deployed-site pass.
HTTP/API checks do not replace the visual browser walkthrough.

## Earlier deployed baseline

Before the official-catalog conversion, Vercel successfully deployed commit `01a3a55`. The frontend is
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

The Docker start command runs migrations, then the opt-in versioned official-catalog upgrade,
then the web server. The existing `BOOTSTRAP_DEMO_CATALOG=true` key now initializes or upgrades
the catalog atomically. It never creates users or deletes accounts/workspace entries. Unconfirmed
programme rows are archived, not deleted; source checksums and an immutable release marker
protect updates. `ALLOW_DEMO_SEED=false` remains set. An already-applied release is a no-op.

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

The two global status/demo banners have been removed at the user's request. Workspace JSON backup guidance remains. This UI change does not extend the database lifetime. Render documents
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
Workspace, then sign in, edit a test note and reload. Open `/sources`: expect 13 of 28 tuition claims,
26 of 28 duration claims, 26 reviewed courses and 47 cited document hashes. Open Review details and
follow an electrical/chemical/mechanical course link to confirm that course is selected. Check
the Sources layout at desktop and 360 px. Record the actual result in `RELEASE_CHECKS.md`.

The public URLs, deployed HTTP/API checks and Sources visual walkthrough are recorded above.
Broader physical-device/accessibility checks remain separate.

## Provider references

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## Deploy the official-catalog conversion

Deploy the backend before publishing the updated frontend. On the existing
[Render API service](https://dashboard.render.com/web/srv-db3973gm7kps73dg2gqg),
choose **Manual Deploy → Deploy latest commit**. Its default Docker command performs the
migration and idempotent catalog upgrade; no database reset or extra secret is required.
Keep the free tier and existing URLs. `/api/colleges/catalog` must return 19 institutions and
28 programmes before completing the frontend rollout. The frontend refuses sample API data
during a mixed-version rollout instead of presenting it as official information.

The new rollout and visual results are recorded in `REAL_DATA_PLAN.md`; the earlier Safari
walkthrough above is historical evidence, not a check of the new Sources layout.
