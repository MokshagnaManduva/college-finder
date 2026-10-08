# Official-data conversion

Requested 8 October 2026: remove the global source-review and temporary-demo banners and replace sample catalog content with real online information.

Execute in this order:

1. Audit the 19 institution / 57 programme fixtures. Collect official institution pages and reports, archive the exact source bytes with SHA-256 checksums, and record field scope and reporting year. Keep the existing reviewed 2026 tuition/duration evidence.
2. Replace illustrative institution descriptions, photographs, facilities, accreditation, seats, fees and placement statistics. Publish confirmed programmes; archive ambiguous programme entries without deleting their IDs or students' notes. Unknown figures stay unavailable. Show NIRF median salaries with programme cohort and year, never as average salaries or course-level outcomes.
3. Implement an atomic, repeatable catalog upgrade for both existing and empty databases. Preserve accounts, workspace entries, reviewed claims and stable option IDs. Prevent a later demo seed from overwriting the official catalog.
4. Remove both global banners. Update cards, college details, comparisons, Sources and the standalone preview to use the official catalog and honest unknown states. Keep backup guidance in the workspace, without a global temporary-demo label.
5. Verify source checksums, upgrade rollback/idempotency/private-data preservation, discovery and cost calculations, API compatibility, frontend tests, lint and production build. Check the updated desktop/mobile UI.
6. Commit and push the tested changes; deploy the existing Render service and Vercel frontend without changing the free hosting tier. Verify the live catalog, source links and a deployed student journey. Record actual completion and any external blockers.

Hosting stays on the already-authorized free Render tier. Removing a banner does not extend the database lifetime; retain that operational limitation in deployment documentation and workspace backup guidance. No paid resources will be provisioned.

## Execution record

- Steps 1–4 complete locally. Release `official-2026-10-08-r2` contains 19 institutions, 28 published programmes, 13 tuition claims, 26 duration claims and four NIRF cohorts. Forty-seven referenced documents are retained; IIM Bangalore's two indexed programme references remain unverified with no archived bytes.
- Existing local catalog upgraded successfully; original accounts/notes/options preserved. Thirty-one sample options are archived, and 57 legacy aliases remain available.
- Step 5 automated checks: 43 backend tests and 29 frontend tests pass, Ruff/ESLint and the production build pass. Source checksums validate; Alembic reports no schema drift. Python 3.13 container initialization against isolated PostgreSQL 16 and HTTP/CORS/discovery/compare/account/workspace smoke checks pass. Safari access recovered after the user continued. Desktop and 360 × 900 px Sources layouts passed: banners absent, 13/28 tuition and 26/28 duration counts, 47 documents, 5.5-year MBBS note, checksum wrapping and Space-to-collapse disclosure. IISc outcome labels/counts were checked in the accessibility tree. Physical-device and full screen-reader testing remain outside this check.
- Step 6 in progress: backend commit `84b2934` is pushed. Render deployment `dep-db3fo5aj9qps73fev5j0` was started through the existing free service dashboard; Render is live and the public API now returns 19 institutions / 28 programmes with no sample profiles; frontend publication follows. The user requested manual handoff of dashboard steps. No paid hosting changes or production secret changes have been made.
