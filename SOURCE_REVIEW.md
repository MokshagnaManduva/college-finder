> Historical nine-course pilot. The current official catalog conversion, scope and checks are documented in [OFFICIAL_DATA.md](OFFICIAL_DATA.md) and [REAL_DATA_PLAN.md](REAL_DATA_PLAN.md). Counts and UI descriptions below refer to the earlier pilot.

# Reviewed course data

Updated 8 October 2026. The connected local database contains eighteen reviewed claims across nine
existing courses: IIT Bombay Computer Science/Electrical Engineering and IIT Delhi Computer
Science/Mechanical Engineering, IIT Madras Computer Science/Chemical Engineering, NIT Trichy
Civil Engineering/Computer Science, and IISc Bachelor of Science (Research).
College overview, seats, facilities, other courses and
placement figures keep their demo status. This is a bounded source-review pilot, not a verified
admissions directory.

## Evidence and normalization

Reviewed the [official IIT Bombay Autumn 2026–27 circular, page 2](https://acad.iitb.ac.in/sites/default/files/FeeCircularAutumn2026-27.pdf#page=2),
linked from the [Academic Office fee page](https://acad.iitb.ac.in/admissions/fees-structure).
IIT Delhi tuition uses its [2026–27 prospectus, PDF page 38 / printed page 33](https://home.iitd.ac.in/uploads/PROSPECTUS%202026-27.pdf#page=38);
standard B.Tech duration is supported on PDF page 25 / printed page 20. The
[2026-entry fee circular](https://academics.iitd.ac.in/wp-content/uploads/2026/07/UG-26_compressed.pdf)
was also reviewed for the applicable category/remission context. The retained current PDFs agree
on the income bands; an earlier search excerpt was stale and is not used as evidence.

The next expansion uses [IIT Madras's 2026–27 fee circular, Annexure I / PDF page 5](https://fees.iitm.ac.in/assets/circular/Institute_fee_circular_for_jul_nov_2026.pdf#page=5)
for Indian new-entrant tuition and its [2015-onward B.Tech ordinance O.3 / PDF page 5](https://www.iitm.ac.in/sites/default/files/Ordinances/b.tech-2015.pdf#page=5)
for normal eight-semester duration. The institute's current undergraduate page corroborates four years.
NIT Trichy uses its [2026 B.Tech fee table / PDF page 1](https://www.nitt.edu/home/academics/fees_section/ug_courses_fee_structure/B.Tech%202026.pdf#page=1)
and [2024-onward regulations B.19.0 / PDF page 23](https://www.nitt.edu/home/academics/rules/Regulations_B.Tech._2024.pdf#page=23).
IISc uses the [2026–27 fee circular, new entrants section 1A / PDF page 1](https://bs-ug.iisc.ac.in/assets/Fee-Structure-Circular-AY-2026-27.pdf#page=1)
and [2025–26 UG Handbook section 1.1 / PDF page 4](https://bs-ug.iisc.ac.in/assets/UG-HandBook-25-26.pdf#page=4),
corroborated by its 2026 admissions page. Each claim keeps its document's own reporting year;
older duration regulations are not presented as 2026 publications. Programme identity was checked
against institution programme listings; names, seats and other fields have not been promoted to verified claims.

All six new evidence pages were rendered and visually inspected, including table columns and
footnotes. Semester duration converts to planning months using two regular semesters per year;
it does not describe the number of classroom weeks. IISc's tuition is already annual, so it is
not doubled. Its new-entrant rate is distinct from the rate for students admitted before 2026–27.
The pilot retains the raw semester fee and programme duration, converts them into the app's annual
tuition/months units, and displays the scope and conversion assumptions beside the source link.
The annualized fee is a planning rate, not an assurance of the total payable amount or unchanged
fees in subsequent semesters. Applicable exemptions/remissions and additional charges require
separate consideration.

The manifest stores the retrieved PDF's SHA-256 and the review timestamp. The database retains
the latest reviewed input per claim, with the reviewer, scope notes and linked source. Older source
records are not deleted. The CLI verifies retained document bytes before applying a review; it
rejects missing evidence or a checksum mismatch before opening a database transaction. It does
not independently authenticate reviewer assertions or download URLs. Retained official PDFs
and their origin links are documented in [seed/evidence/README.md](backend/seed/evidence/README.md).

## Commands

After `make migrate`, the included pilot can be previewed and applied:

```bash
make review-pilot  # read-only change preview
make apply-pilot   # atomically apply the reviewed claims
make review-batch  # preview the four-course expansion and verify retained PDFs
make apply-batch   # apply the expanded batch atomically
make review-directory  # preview the nine-course batch and verify all eight cited PDFs
make apply-directory   # apply all eighteen claims atomically
```

For another reviewed file:

```bash
cd backend
.venv/bin/python -m seed.review /absolute/path/to/review.json --evidence-dir /path/to/evidence
.venv/bin/python -m seed.review /absolute/path/to/review.json --evidence-dir /path/to/evidence --apply
```

Use [the pilot manifest](backend/seed/data/reviewed_iit_bombay_2026.json) as the format reference.
The earlier four-course expansion is in [reviewed_iits_2026.json](backend/seed/data/reviewed_iits_2026.json).
The current nine-course batch is [reviewed_directory_2026.json](backend/seed/data/reviewed_directory_2026.json).
Name each retained PDF `<documentSha256>.pdf` in the evidence directory. `--apply` requires `--evidence-dir`;
dry-run can validate a manifest alone, or also verify evidence when the directory is supplied.
`version` is 1; each course uses its existing UUID and owning college slug. A course can include
tuition, duration, or both. Each claim requires a title, HTTPS source URL, reporting year, timezone-
aware review timestamp, reviewer, document SHA-256, and notes explaining scope/assumptions.

Supported source units:

| Claim | Original unit | Conversion |
|---|---|---|
| Tuition | `INR/semester` | ×2 for an explicitly annualized planning rate |
| Tuition | `INR/year` | ×1 |
| Duration | `years` | ×12 into months |
| Duration | `months` | ×1 |
| Duration | `semesters` | ×6 planning months, assuming two regular semesters per year |

Unsupported fee periods must be reviewed and modeled before import. Scope-specific tuition is
not a universal fee: the UI tells students to adjust it to their applicable category.

The importer validates the entire file before writing, rejects duplicate or mismatched course
targets, invalid units/values, future review dates, stale reviews and conflicting evidence at the
same timestamp. Reapplying the same review is safe. It updates facts on the existing course ID;
it does not create/delete colleges, courses, users or workspace entries. Saved cost scenarios stay
student-controlled. Demo reseeding protects the reviewed tuition, fee basis and duration.

## UI and verification

Detail and cost views show the original value, annualization, source year/date and notes. The
catalog banner says source review is in progress. A reviewed course claim does not change the
college overview's demo status. Comparison shows provenance per tuition value and suppresses
lowest-tuition highlights when source status/scope/year/period differ or values are missing.

40 backend and 27 frontend tests pass; lint, TypeScript and production/standalone builds pass.
Alembic reports no schema drift. The live API retains 19 colleges and 57 courses. Safari checked
the detail/cost evidence, source notes at 360 px, and a mixed-source comparison without a tuition
winner. The standalone HTML continues to use unchanged demo fixtures; reviewed facts are in the
connected API app.
The public `/sources` page reports tuition/duration claim coverage separately, lists reviewed
course evidence, and offers optional reviewer/hash details. Counts are based on evidence that
matches the current course values; inconsistent claims do not count as reviewed. Nine of 57
courses currently have both claims reviewed, citing eight retained PDFs. College records remain demo.
The deployed Sources page passed Safari checks at desktop and 360 × 900 px emulation: coverage
counts, original units, reporting years/dates, reviewer/hash details and narrow-screen wrapping.
Space collapsed a review disclosure; a course link selected Electrical Engineering on detail.
Responsive mode was exited afterward. These checks do not constitute a physical-device or full
assistive-technology audit. Coverage calculations and the deployed API data also pass checks.
The live nine-course import also left the authenticated demo workspace unchanged. Replay and
demo reseeding are covered by the integration suite. Container verification is recorded in
`RELEASE_CHECKS.md`.
The updated Python 3.13 image passed the current nine-course evidence dry-run, health/readiness,
catalog claims/hash checks and Alembic drift check, including the retained semester-duration units.

## Next data work

Expand course reviews institution by institution. Review programme identity, seats and other
claims independently instead of treating an institution URL as verification of every field.
Placement comparisons need compatible definitions, year and scope. Historical cutoffs still
need a separate sourced counselling dataset with programme/category/quota/round dimensions.
