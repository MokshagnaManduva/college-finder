# College_Finder — Product Redesign and Conversion Plan

Updated: 8 October 2026. Supersedes the original UI-preserving rebuild plan.

## 1. Product direction

Build a college decision workspace for Indian students: discover suitable courses and colleges,
understand costs, compare tradeoffs, and keep application progress in one place.

The frontend gets a completely new visual system, navigation, page layouts, and interaction flow.
React + FastAPI + PostgreSQL remains the technical direction. Existing code and seed data are
reference material; feature parity and visual parity with CampusFind are no longer goals.

**Primary journey:** Preferences → Explore → College/course detail → Compare → Workspace.

Browsing and preference matching work without an account. Sign-in adds cross-device persistence.
Students can start with a guest shortlist and transfer it to their account when they sign in.

**First release:** discovery, details, preference matching, course cost estimates, comparison,
a shortlist/application workspace, and authentication. Historical cutoff exploration is a second
release, dependent on sufficiently detailed and sourced data.

Success means a student can find three relevant options, understand their costs and differences,
and record a next action for each without leaving the app.

## 2. Feature decisions

| Existing feature | Decision | New behavior / reason |
|---|---|---|
| College search and filters | Keep and redesign | Search colleges and courses; clear active filters; desktop result rows and mobile cards |
| College details | Keep and redesign | Course-first information, costs, placement evidence, facilities, and source dates in an anchored page |
| Compare up to three colleges | Keep and improve | Compare selected courses and tradeoffs against the student's priorities |
| Save/unsave hearts and Saved page | Replace | A workspace with notes, selected course, progress, next action, and optional deadlines |
| Register/login | Keep | Guest browsing; sign-in for sync; validate stored sessions on startup |
| Rank predictor and Excellent/Good/Possible labels | Remove | Later replace with explicitly historical cutoff comparisons; no admission probability score |
| Discussions, answers, votes and accepted answers | Remove | Outside the core decision journey; removes forum moderation and community infrastructure |
| Seeded reviews and aggregate star ratings | Remove from new UI | Anonymous sample reviews are unsuitable decision evidence |
| Save-count popularity badges | Remove | Popularity is not a measure of suitability |
| Large marketing hero and repeated CTA sections | Replace | A compact introduction and immediate search/preferences entry points |
| College/course data and placement information | Keep with provenance | Show units, reporting period and source; distinguish demo data and missing information |

The original project remains the reference. Reviews/forum models, endpoints and seeds are excluded
from the new release. Local development uses a fresh database. Migration of existing production
users and records, if needed, is a separate cutover task before deployment.

## 3. New features for the first release

### A. Student preferences and explainable matches

An optional preferences form collects study level, degree/subject interests, preferred states,
annual tuition budget, and whether budget/location are strict requirements or flexible preferences.
Students can skip it, edit it later, and override its defaults in Explore.

- Match at course level, then group qualifying courses under their colleges.
- Strict requirements filter results; flexible preferences order the remaining results.
- Count satisfied, known preferences equally for initial ordering; use name/slug for deterministic
  ties. Keep unknown values separate and display match coverage. For course options, course ID
  completes the tie-breaker.
- Explain results: "Offers B.Tech Computer Science", "Within your tuition budget", "In a preferred
  state". Show flexible preference mismatches too.
- Preference fit is neither an admission probability nor a universal quality score.
- Unknown data cannot satisfy a strict requirement. Explain exclusions and suggest which filter
  to relax when there are no matches.

**Acceptance:** deterministic results; understandable reasons; budget/location changes update
results; incomplete data never appears as a confirmed match.

### B. Course cost calculator

Selecting a course on college detail opens a cost breakdown. Compare uses the same calculation.

- Use sourced tuition/duration when available; otherwise request user input.
- Editable inputs: annual tuition, annual living/hostel costs, annual other costs, one-time costs.
- Initial formula: `(annual tuition + annual living + annual other costs) × duration in years
  + one-time costs`. Money uses integer INR; duration supports partial years.
- Distinguish reported figures, user-entered figures, and missing inputs.
- Fee growth and scholarships are outside the initial formula; show that assumption alongside
  results. Label an incomplete estimate partial, rather than treating missing inputs as zero.
- Clearly distinguish annual tuition budget from estimated full-course cost.
- Save cost scenarios with workspace entries; edits never overwrite reported college facts.

**Acceptance:** correct arithmetic/units; zero and unknown remain distinct; partial-year courses
work; scenario edits leave source data intact.

### C. Shortlist and application workspace

Replace `/saved` with one workspace. An entry represents a college and an optional selected course.
Students can keep multiple distinct course options from the same college.

- List and board views with stages: Researching → Shortlisted → Applying → Applied.
- Optional outcomes: Offer received, Waitlisted, Rejected, Withdrawn.
- Private notes, next action, target/application date, application URL, and cost scenario per entry.
- Student-entered dates are personal targets. A verified official deadline needs a source URL and
  verification date. Unknown deadlines remain empty.
- Highlight approaching and overdue targets using the user's local date.
- Move entries through a select/menu as well as drag-and-drop; support keyboard editing.
- Export list, course, progress and notes as CSV; escape spreadsheet formula prefixes in user text.
  Public sharing and reminder emails are deferred.
- Guest entries use versioned local storage. On sign-in, merge without duplicate college/course
  pairs and preserve notes. Existing account records win conflicts until the student chooses
  otherwise; retain the guest version for review. Clear local guest data only after successful sync.

**Acceptance:** survives reload; private records are owner-scoped; duplicate prevention includes
college-only entries; failed sync leaves guest data recoverable; repeated sync is idempotent.

### D. Comparison guided by priorities

Compare two or three college/course options, including different courses at the same college.
Prompt for missing course selections before course-specific cost comparisons.

- Views: All details, Costs, Academics, Placements.
- Persistent option headings on desktop; controlled horizontal scrolling on mobile.
- Highlight lowest comparable tuition/estimated cost and highest comparable reported placement
  metrics; handle ties explicitly and explain each highlight.
- Placement comparisons require compatible year, scope and definitions. Otherwise show facts with
  a comparability note. Missing values never win.
- Display preference reasons and let the student add an option to the workspace from comparison.
- Persist selections locally and encode college/course IDs in the URL for reproducibility.
- No unsupported overall winner or opaque weighted ranking.

**Acceptance:** preserves selection order; explicit units; handles absent/incompatible data;
usable on small screens; selecting different courses updates costs and academics correctly.

## 4. Completely new UI/UX

### Visual direction: a calm editorial workspace

- Warm ivory background `#F7F5EF`, white panels, charcoal text `#202923`.
- Deep forest primary `#1D4A3B`, muted terracotta accent `#AD583C`.
- Space Grotesk headings; system sans-serif body; tabular numerals for costs.
- Thin borders, restrained shadows, 8–12 px corners, generous section spacing, compact data rows.
- A new wordmark and small graphic details; campus photos supplement information.
- Subtle transitions with reduced-motion support.
- Replace the old indigo gradients, serif headings, floating compare bar, component classes and
  marketing composition. The preview implements the new tokens in CSS; Tailwind v3 mapping can be added during integration.

Initial tokens must pass contrast checks. Target WCAG 2.2 AA: readable contrast, visible focus,
keyboard navigation, labelled controls, reflow and accessible status updates. Use 44 px touch
controls as a product design target. Reference: [W3C accessibility guidance](https://www.w3.org/WAI/WCAG22/quickref/).

### Navigation and layouts

| Screen | Desktop | Mobile |
|---|---|---|
| App shell | Compact top navigation: Explore, Compare, My workspace; profile/session controls | Compact header and bottom navigation for the three main destinations |
| Home | Brief introduction, search, Start with preferences, recent local activity | Search first; preferences and resume workspace directly below |
| Explore | Filter rail, result count/sort toolbar, dense rows with course snippets | Cards; filter sheet with explicit Apply/Reset; active filter chips |
| College detail | Summary header, sticky section links, course table, cost panel and sources | Stacked anchored sections; persistent shortlist action with content clearance |
| Compare | Persistent column headings and section selector | Scrollable comparison with readable names and a visible scroll cue |
| Workspace | Board/list toggle, progress counts, upcoming targets, inline entry editing | List-first, stage filter, full-screen entry editor |
| Preferences | Short form and live examples of matching reasons | Short steps; Skip and Back always available |

### Routes

`/` · `/explore` · `/colleges/:slug` · `/preferences` · `/compare` · `/workspace` · `/login` · `/register`

Add `/cutoffs` in the second release. Redirect legacy `/colleges` to `/explore`, and `/saved` to
`/workspace`. Removed forum/predictor routes show a retired-feature page linking to discovery.
Validate auth return paths as local routes.

### Interaction rules

- URL-synced search/filters; reset pagination on changes; preserve state when returning from detail.
- Debounce typing. Desktop filters apply immediately; mobile filters apply from the sheet.
- Request sign-in when sync is needed; return to the current task afterward.
- Layout-specific skeletons, purposeful empty states, retry actions and mutation feedback.
- Failed edits retain student input. Keyboard/screen-reader support for board editing and modals.
- Check 360, 768, 1024 and 1440 px widths and 200% zoom. Comparison scrolls horizontally within
  its container; the surrounding page reflows.

## 5. Data quality and later cutoff exploration

The extracted legacy data contains 19 colleges, 57 courses and 70 cutoff records. It is demo content,
not a verified admissions dataset. Extracted reviews/forum content stays reference-only.

- Mark inherited facts as demo; show a visible demo-data label in local/pre-release previews.
- Remove reviews/ratings from displayed metrics and default sorting.
- Keep raw fixtures for reference; normalize a separate new seed into the revised schema.
- Tuition, placements and later cutoffs need claim-level source metadata: URL, title, reporting
  year, verification time, and demo/verified/unverified status.
- A URL alone does not establish verification; record a review of the source.
- Production imports exclude demo fixtures. Check displayed claims or label them unverified.
- Resolve annual versus full-course fee ambiguity before using a reported figure in a complete estimate.
- Seeds are deterministic and idempotent. Resets are explicit and confined to disposable databases.

### Second release: historical cutoff explorer

Start with a bounded JEE counselling dataset for supported institutes/programs. Extend to other
admission systems only when their dimensions are correctly represented.

Store exam/rank system, program, year, counselling round, seat category, quota and applicable seat
pool. Compare matching dimensions only; distinguish common rank from category rank. Explain the
required input. Show "Ahead of historical opening rank", "Within historical range", or "Beyond
historical closing rank", always with year/source. These describe historical data only.

JoSAA provides current and previous opening/closing rank links through its
[official OR-CR page](https://josaa.nic.in/or-cr/). Existing college-level synthetic fixtures lack the
detail needed for this feature and are not its production source.

Do not label results safe, guaranteed, or an admission probability. Show absent matching data;
never silently substitute another category, round or year.

## 6. Technical architecture and schema

| Layer | Direction |
|---|---|
| Frontend | React 19, Vite, TypeScript, TanStack Query, lucide-react; preview uses CSS tokens and React Context; reassess Tailwind v3/Zustand/forms tooling during full integration |
| Backend | FastAPI, Pydantic v2, async SQLAlchemy 2.0 + asyncpg, Alembic, PyJWT, bcrypt |
| Database | PostgreSQL 16; fresh local database; managed PostgreSQL for deployment |
| Validation | pytest/httpx against disposable PostgreSQL; focused calculation/state tests; build/lint and browser walkthroughs |
| Deployment | API container and Vercel frontend after release checks |

**Adapt:** users, colleges, courses and core session/security code.

**Exclude from target schema:** reviews, saved-count metrics, threads, answers and votes. Replace
legacy cutoffs before the historical explorer release. The original source project stays intact.

**Add/change:**

- `student_profiles`: user ID, study level, degree/subject interests, states, annual tuition budget,
  strict/flexible flags, timestamps. Guest equivalents remain local until sync.
- `workspace_entries`: user ID, college ID, optional course ID, stage, notes, next action, target date,
  official deadline/source/verification date, application URL, cost scenario, timestamps, revision
  for optimistic concurrency. Course must belong to the selected college.
- Unique college/course option per user, including NULL course IDs: use PostgreSQL 16
  `UNIQUE NULLS NOT DISTINCT` or equivalent partial unique indexes.
- `courses`: normalized degree/subject metadata, duration in months, tuition amount and fee period.
  Derive annual tuition only using a documented conversion rule.
- `data_sources` / `college_metrics`: typed source-linked claims with year, units and placement scope.
  Missing values are NULL. Retain raw import payloads separately.
- Future `admission_cutoffs`: program ID and complete counselling dimensions described above.

UUID IDs; camelCase JSON with an explicit `access_token` auth exception. Handle both string and
validation-array FastAPI `detail` errors. Session expiry resets authenticated React state and clears private caches.
Owner checks protect private records. Show edit conflicts rather than overwriting newer revisions.

### Target API surface

All paths are under `/api`. The new frontend may change contracts; retain useful college slugs.

| Area | Endpoints / behavior |
|---|---|
| Health | `GET /health`, `GET /health/ready` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Discovery | `GET /colleges`, `GET /colleges/catalog`, `GET /colleges/filters`, `GET /colleges/{slug}`; course-aware filters and sourced detail |
| Matching | `POST /matches`: transient preferences, paginated college/course options, reasons and coverage; guest-accessible |
| Profile | `GET /profile`, `PUT /profile`; authenticated persistence |
| Compare | `POST /compare`: 2–3 college/course options; comparable facts and metadata; guest-accessible |
| Workspace | `GET /workspace`, `POST /workspace`, `PATCH /workspace/{id}`, `DELETE /workspace/{id}`; owner-scoped |
| Guest sync | `POST /workspace/import`; transaction, idempotency key, explicit conflict response |
| Cutoffs, later | `GET /cutoffs` with supported counselling dimensions |

Implement cost arithmetic once in a pure frontend module for instant updates, compare and export.
Backend validates stored scenario values/structure. Do not duplicate independent calculation rules.

## 7. Existing work and transition

The redesigned frontend now connects to FastAPI and PostgreSQL. Implemented:

- New UI/UX and course-aware discovery, details, matching, costs and comparison.
- Revised source-linked college/course/metric models, an initial Alembic migration and safe,
  deterministic demo seeds (19 colleges, 57 courses, 57 placement metrics).
- Registration/login/me, persistent preferences and owner-scoped workspace CRUD.
- Revision conflicts, transactional idempotent guest import and browser/account review panels.
- Stable IDs and legacy guest migration; JSON transfer and downloadable browser recovery copies.
- Docker API image, environment examples, readiness checks and runnable setup commands.
- 40 PostgreSQL integration/validation tests and 27 frontend tests; all pass, as do lint and builds.
- Reviewed course-claim import with dry-run, raw evidence, unit normalization and safe reseeding.
- Expanded pilot: eighteen claims across nine courses at five institutions, backed by eight retained official
  PDFs and mandatory checksum validation on CLI apply. Public `/sources` exposes claim coverage. Other facts
  remain demo. Source-aware detail/cost views and compatible-scope tuition highlights are connected.
- Successful API-container health/catalog/authenticated-read checks and Alembic drift check.

Docker, dependency downloads and local ports now work. Python 3.14 passes the backend suite;
the API image uses Python 3.13. Earlier standalone browser checks covered responsive discovery,
comparison, costs and guest editing/reload. The connected Safari walkthrough now passes guest note
editing, sign-in/import, account editing, reload persistence, sign-out clearing private state, and
signing back in to restore the saved entry. A labelled test note remains in the local demo account.

The local demo release review now checks responsive widths, 200% zoom, dialog focus, keyboard
comparison scrolling and live demo provenance. Review fixes include unavailable comparisons,
filtered navigation, text/control contrast, touch targets and recovery copy. See `RELEASE_CHECKS.md`
for evidence and remaining production gates. Deployment and real admissions data verification
are not complete beyond the bounded course pilot in `SOURCE_REVIEW.md`. See `README.md` for the
current workflow.

## 8. Build phases and acceptance gates

### Phase 1 — New design foundation and interactive preview (implemented)

Create tokens, typography, accessible primitives and responsive navigation. Build Home, Explore,
college detail and a guest workspace using labelled demo fixtures and typed mock API adapters.
Remove copied marketing layouts/forum navigation. Make the new journey reviewable before further
backend work. This is the first milestone after resuming.

**Gate:** visibly distinct design; usable on mobile/desktop; search → detail → guest shortlist works;
fixture previews carry a demo label.

### Phase 2 — Align backend, database and discovery (implemented; API checks pass)

Revise models, write the initial migration, normalize seeds, complete course-aware discovery/detail
contracts and provenance. Connect real frontend adapters, update env configuration, add readiness
checks and appropriate college endpoint tests.

**Gate:** migrations work on empty PostgreSQL; repeat seeds are safe; discovery uses FastAPI;
filters/pagination work; missing/sourced/demo data displays correctly.

### Phase 3 — Preferences, costs and comparison (implemented; domain/API checks pass)

Implement explainable matching, preferences, the shared cost calculator, comparison views and
persisted/URL-backed selection.

**Gate:** deterministic matching; strict requirements enforced; cost checks include unknown, zero
and partial-year inputs; comparison handles ties, incompatible facts and missing values.

### Phase 4 — Authentication and persistent workspace (implemented; Safari sync walkthrough passes)

Implement register/login/me, workspace CRUD, notes/stages/dates, guest import, revision conflicts,
CSV export and upcoming targets.

**Gate:** owner isolation; expired sessions clear private state; retry-safe guest sync; recoverable
conflicting edits; correct export; no silent data loss.

### Phase 5 — Release checks (local demo checks pass; production gates pending)

Review sources for the intended release data; run frontend build/lint and backend tests. Walk
through the student journey and keyboard/focus/contrast/responsive behavior. Document setup,
provenance, env variables and deployment.

**Gate:** only working first-release features ship; honest data labels; required checks pass;
unresolved limitations are documented before deployment.

Deployment setup now targets a free temporary Vercel frontend and Render API/PostgreSQL through
the dashboards. Configuration and a clean-database rehearsal pass; live resource creation, actual
URL binding and deployed browser checks remain pending. See `DEPLOYMENT.md`.

### Phase 5A — Reviewed course-data pilot (implemented; expansion pending)

Store claim-level raw values, conversion assumptions, reviewer/date/document hash and source links.
Import reviewed tuition/duration onto existing course IDs without changing private records. Protect
those claims from demo reseeding. Render mixed data statuses honestly and suppress incompatible
tuition highlights. The current local pilot covers nine courses' tuition and duration; expand reviewed
coverage before calling the admissions directory verified. See `SOURCE_REVIEW.md`.
Retained document checksums are required on apply, and the public Sources page distinguishes
claim-level coverage from college-wide verification. Its new browser walkthrough is pending
Safari input recovery; coverage calculations and API data pass checks.
The importer retains semester-based duration and explicitly converts it into planning months.
The current batch adds IIT Madras, NIT Trichy and IISc, retaining the earlier Bombay/Delhi reviews.

### Phase 6 — Historical cutoff explorer

After meeting the data gate, import a sourced counselling dataset and build historical comparisons.
Test rank systems, categories/rounds, missing data and historical range boundaries.

## 9. Explicitly deferred

Scholarship matching; loan/ROI recommendations; automatic application submission; email/push
reminders; identity-document uploads; public sharing; AI counsellor; community/forum/reviews;
maps; large-scale scraping; paid plans; administrative dashboard.

Evaluate these after the core workspace is useful and its data is reliable.

## 10. Target local workflow

```bash
make setup     # install backend/frontend dependencies
# copy backend/.env.example to backend/.env and set JWT_SECRET
make db        # requires a running Docker daemon
make migrate   # apply the initial/revised migrations
make seed      # set ALLOW_DEMO_SEED=true for local demo fixtures
make api       # http://localhost:8000/api/docs
make web       # http://localhost:5173
make test      # isolated PostgreSQL integration tests
make web-test
make lint
make build
make preview   # portable guest/demo HTML
```

Structure code around `colleges`, `matching`, `profile`, `workspace`, `compare`, `auth`, and later
`cutoffs`. Rebuild frontend pages/components around these journeys. Removed feature code stays
out of the active dependency graph.
