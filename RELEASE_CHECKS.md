# Local demo release checks

Checked on 8 October 2026. The connected local demo passes the checks below. This record covers
the current demonstration dataset and student workspace; deployment and verified admissions data
are separate release gates.

## Verification

| Area | Result and evidence |
|---|---|
| Backend | 40 tests passed: discovery, auth, ownership, revisions, guest import, comparison, safe seeding, reviewed claims and retained-evidence checks. |
| Frontend | 27 domain/adapter tests passed, including unavailable comparisons, source-aware highlights and coverage consistency. |
| Static checks | Ruff, ESLint, TypeScript and production/standalone builds pass. |
| Container | Updated Python 3.13 image passed health/readiness, nine-course evidence dry-run and catalog checks (18 reviewed claims, 8 hashes, 4 semester-duration claims). Alembic found no schema drift. Earlier login/authenticated-read checks passed. |
| Guest → account | Safari verified guest note editing, sign-in/import, account editing, reload, sign-out clearing the private view, and restoration after signing back in. |
| Mobile filters | At 360 px, the filter dialog applied B.A.; the URL and results changed to three matching colleges. Closing the dialog returned focus to Filters. |
| Course context | Opening Christ University from those results selected B.A. Media Studies. Back to Explore retained `degree=B.A.` and the three results. |
| Responsive layout | Safari Responsive Design Mode: workspace/discovery/comparison at 360 px; discovery at 768 px; details at 1024 px; comparison at 1440 px. Inspected screenshots for clipping and page overflow. |
| Comparison scrolling | At 360 px, the surrounding page reflowed and the table stayed in its own scroll region. Focusing the region and pressing Right revealed the second option. |
| Zoom | Safari's website settings confirmed 200%. Workspace reflow and comparison scrolling remained usable; restored actual size afterward. |
| Dialog keyboard | Tab reached the stage field; Escape closed the notes dialog and returned focus to the entry's Edit button. |
| Live data labels | API retains 19 colleges and 57 courses. Eighteen claims across nine courses at five institutions are source-linked; unrelated college/course/placement facts retain demo status. Placement reporting year/scope remain unknown. |
| Expanded sources | Live API exposes 9 reviewed tuition claims, 9 reviewed duration claims and 8 document hashes. Annual tuition is not doubled; semester duration is retained with conversion assumptions. Replay/reseeding checks pass. Live import left the authenticated demo workspace unchanged. Public Sources coverage calculations pass tests; its browser walkthrough awaits Safari input recovery. |
| Source pilot | Safari checked original/annualized tuition, source links/year/date and scope notes at desktop and 360 px. A three-option mixed-source comparison had no lowest-tuition highlight. |
| Deployment rehearsal | Full Python 3.13 Dockerfile built. Default startup migrated fresh isolated PostgreSQL 16 and atomically bootstrapped the demo catalog/18 claims without creating users. Node 24 tests/build passed. HTTP smoke covered routes/assets, CORS, discovery, comparison and isolated account/workspace persistence; restarting preserved data. |
| Hosting setup | User selected free Vercel/Render dashboard setup. Blueprint, guarded frontend build and operator guide are prepared. Public resources/URLs and deployed/browser checks are pending. |

The checks use Safari desktop emulation, not a physical phone or a full assistive-technology audit.
Registration, expired-session handling, ownership and simultaneous-import behavior are covered by
automated tests; they were not all repeated in the browser. Cross-device persistence was verified
through API storage and browser session reload/sign-out/sign-in, not a second physical device.

## Fixes made during review

- Resolve saved comparison options against the current catalog before rendering. Missing colleges,
  removed courses and courses belonging to another college no longer crash comparison. The student
  can explicitly remove unavailable choices; workspace notes are retained.
- Preserve Explore filters and the matching course when opening and returning from detail.
- Restore modal focus, use unique dialog title IDs and label the backup upload control.
- Make the board scroll region keyboard-focusable; provide focus rings for the account menu and
  backup import, and increase compact controls toward the 44 px touch-target design goal.
- Darken low-contrast supporting text and field boundaries. Mobile fields use 16 px text.
- Remove the unused account-sync placeholder and correct crash-recovery copy for account entries.

## Color checks

Calculated using relative luminance and contrast ratios for these CSS pairs:

| Foreground / background | Ratio |
|---|---:|
| Body `#202923` / paper `#f7f5ef` | 13.73:1 |
| Muted `#656e65` / paper | 4.85:1 |
| Placeholder `#656e65` / white | 5.29:1 |
| Journey text `#5c6957` / `#eaf0e6` | 5.01:1 |
| Empty board text `#5c6957` / `#ecefe5` | 4.99:1 |
| Focus `#ad583c` / paper | 4.55:1 |
| Field border `#838d80` / white | 3.45:1 |

These are targeted color and interaction checks, not a claim of complete WCAG certification.

## Remaining release gates

For a production admissions directory, replace the demo facts with reviewed source-linked data,
including the fee period, course duration and placement definitions/year/scope. The existing
fixtures are not suitable for historical cutoff comparisons.

Before deploying, configure production origins/secrets and the database, run migrations, set SPA
rewrites, and check the deployed student journey. The current catalog endpoint loads the small
directory in full; revisit it when importing a large dataset. Complete a physical mobile and
screen-reader walkthrough for the intended supported platforms.

The local demo account retains a clearly labelled test note for IIT Bombay. Two B.A. course options
were added to this browser's comparison during the walkthrough. Safari is back in its normal
view at actual size. The source pilot walkthrough added IIT Bombay as a third comparison option
and left its source section open. See [SOURCE_REVIEW.md](SOURCE_REVIEW.md) for the pilot's scope.
