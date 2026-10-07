# Official catalog — 8 October 2026

The public catalog now uses 19 real institution profiles and 28 confirmed programme options. It replaces all sample fees, seats, placement averages/rates, accreditation claims, facilities and stock campus photographs. Unavailable values remain null, not zero. The catalogue is a curated subset, not a complete inventory of every institution's courses.

The release contains 13 tuition claims and 26 duration claims with retained official evidence. IIM Bangalore's two MBA programme identities/durations are supported by indexed official pages, but direct downloads returned HTTP 403. These references remain unverified, carry no document checksum and do not contribute to archived/checked-claim counts. No sample fee or placement figure remains on those entries.

Tuition coverage:

- IIT Bombay, IIT Delhi and IIT Madras: the existing 2026 reviews use standard Indian undergraduate tuition before category/income remissions, annualized from two semesters.
- NIT Tiruchirappalli: the existing 2026 review uses the applicable standard Indian B.Tech category; exemptions and remissions are explicit.
- IISc Bachelor of Science (Research): 2026 entrants' annual tuition; earlier entrants and exempt categories differ.
- BITS Pilani Computer Science and integrated-first-degree Mathematics: 2026 domestic entrants, ₹2,91,500 per semester, ₹5,83,000 annualized in year one. Published later-year increases, summer/Practice School charges, admission, hostel and advances are excluded from this tuition figure. The Mathematics option is a four-year integrated first degree; it is not a two-year postgraduate MSc.
- VIT Vellore core CSE: Group B, no-scholarship category 5, ₹4,90,000 per year. Scholarship/counselling categories have different tuition; caution deposit is separate. The default is not the lowest scholarship category.
- SIBM Pune MBA: two annual instalments of ₹6,55,000, ₹13,10,000 annualized, for Indian students in the 2026–28 batch. Instalments are preserved as instalments, not mislabeled semesters.

There is no university-wide tuition for University of Delhi, MAHE, Symbiosis or other multicampus institutions. Published programme names and scope specify teaching institutions/campuses. Amity's older 2025 prospectus supports programme identity and duration; its 2025 fee is not presented as current 2026 tuition. AIIMS's 2023 prospectus supports normal MBBS duration (5.5 years including internship), not current seats or eligibility. Undated pages retain a null reporting year.

Four institutions have real outcome data: IIT Madras, NIT Tiruchirappalli, IISc and SRMIST. These are institution-reported NIRF 2026 submissions, using the **2024–25 graduating UG four-year cohort**. The API reporting year is 2025, the end of that academic year. Median salary is for placed graduates only; counts of graduates, placements and higher-study selections remain separate. There is no derived placement-rate or course-level salary claim, and comparisons do not award a salary winner. IISc's placed population is three students and is visible alongside its median. SRMIST's report covers institution-wide programmes/campuses, not only Kattankulathur CSE.

## Repeatable upgrade

`make review-catalog` validates the release and every retained checksum without writing. `make migrate` followed by `make apply-catalog` performs the release atomically. Docker startup performs migrations and the same opt-in upgrade using the existing `BOOTSTRAP_DEMO_CATALOG=true` environment key, so the deployed database upgrades without resetting it.

All 57 original programme rows remain identifiable. Two precise programme entries are added; the release publishes 28 and archives 31. Existing accounts, workspace notes, dates, cost scenarios and revisions are never rewritten. Archived course notes remain editable/exportable. All 57 legacy course aliases remain in the frontend, including those no longer public. A release checksum prevents accidental alteration/reapplication, and demo reseeding cannot overwrite official institution records. New releases require a new version identifier.

`python3 tools/export_catalog.py --api-url http://localhost:8000/api --allow-local-http` exports only public catalog data to the standalone snapshot. Legacy aliases remain separate. Retained source URLs/checksums/scopes are in `backend/seed/evidence/README.md` and `backend/seed/data/official_catalog_2026.json`.

The global “Source review in progress” and “Temporary demo” strips are removed. The footer links to Sources, details show figure-level evidence, and the workspace keeps JSON backup guidance. The underlying free Render PostgreSQL service still expires after 30 days; this work does not change hosting or authorize paid resources.
