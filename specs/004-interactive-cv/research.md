# Research: Interactive CV

Phase 0 of [plan.md](plan.md). Each entry: the decision, why, and what else was weighed. Facts about
dependencies and services were read on 2026-11-24 and 2026-11-25 from their registries and documentation.

## R1. A new section, injected only once its data exists

**Decision**: `src/sections/cv/` with its own Astro integration, as Running has. The integration injects
`/cv/`, the download endpoint and `/og/cv.png` only when `data/cv/page.yaml` exists, checked from files while
the config loads (Running's `journeyChapterIds()` pattern). Previews come from `SHELL_PREVIEW=1`, at
`/cv-preview/[state]`. `scripts/check-boundaries.ts` already treats any `src/sections/<name>/` as a section,
so the CV can't import Running or be imported by it.

**Rationale**: Principle VII; nothing about the CV is visible before the content PR, and no visitor can reach
an empty page.

**Alternatives**: a page under `src/pages/cv.astro` (would sit outside any section and its checks); a route
present from the first slice with an empty state (a public "coming soon" page nobody asked for).

## R2. Data files: one per kind, imported whole

**Decision**: `data/cv/page.yaml`, `blocks.yaml`, `timeline.yaml`, `downloads.yaml`, and the PDFs in
`data/cv/downloads/`. Items in lists carry stable ids from the career record.

**Rationale**: the set is always imported whole from one export, never hand-edited, so one file per item
(as the story's chapters) would only multiply files. Stable ids keep anchors and approvals stable across
imports.

**Alternatives**: one file per change (diff noise on every import, nothing gained); a single file (the PDFs'
metadata and the text would share one approval path).

## R3. Approval per item, by hash of named fields

**Decision**: every item (header, each block, theme, role, thread, change, next item) carries
`approved: {date, source, sha256}`. The sha256 is of a canonical JSON of the item's named fields (the list is
per kind, in [contracts/content-files.md](contracts/content-files.md)); `source` is the career-record commit
the export came from. The store recomputes each hash when it loads; a missing or stale one throws a
`DataValidationError` naming the file and item id. PDFs: the sha256 of their bytes.

**Rationale**: spec 003's mechanism, generalised to items, satisfies FR-022's "naming the item" and lets one
card change without re-approving the rest. Checking in the loader means no build path can skip it.

**Alternatives**: a whole-file hash (any edit re-approves everything); trusting the export's own "approved"
mark without a hash (a hand edit after import would pass).

## R4. Import and word-for-word comparison

**Decision**: `scripts/import-cv.ts --from=<export.json> --rules-checked=<YYYY-MM-DD>`:

- validates the export against `schemas/cv/export.schema.json`;
- refuses any item the export doesn't mark approved, any phone pattern, any text over budget, any thread
  with fewer than two changes, any reference to an undefined theme, thread or value story;
- refuses an export without `page.sharing_rules_confirmed` (the date the owner last re-confirmed the
  sharing rules, recorded in the career record), and `--rules-checked` earlier than it (FR-023);
- writes the files with their approvals, and prints counts only.

`scripts/compare-cv.ts --from=<export.json>` reads `dist/cv/index.html`, collects the CV's text per item by
its `data-cv-item` attribute, and reports every difference against the export (SC-005). Its summary (counts,
"no differences") goes in the PR.

**Rationale**: FR-021 and SC-005 want a mechanical guarantee that what's built is what was approved. The
export is produced by the career record under its own rules; the site trusts nothing it can't check.

**Alternatives**: copying text by hand (the failure FR-021 exists to prevent); reading the career repository
directly from the build (a private repository in a public build).

## R5. Look and fonts

**Decision**: the section's tokens take the visual CV's palette and lane colours, with a dark set chosen for
AA contrast and checked by `tests/unit/design-tokens.test.ts`. Space Grotesk 700 for the name and headings;
Inter Tight 400 and 600 for text and labels; dates in Inter Tight's tabular figures. The fonts come from
`@fontsource/inter-tight` 5.3.0 and `@fontsource/space-grotesk` 5.3.0 (both published July 2026, OFL),
loaded through Astro 7.4.7's Fonts API with the local provider: it preloads the font used above the fold,
generates fallback faces with matched metrics, and keeps every request on our own origin.

Measured from the packages: Space Grotesk latin 700 is 12.8 KB, Inter Tight latin 400 22.0 KB, 600 22.7 KB,
about 58 KB in all (the owner's choice, 2026-11-25, over the visual CV's full three-family set at about
160 KB, or system fonts).

**Rationale**: FR-006 asks for the visual CV's look; the owner picked the lean set. Package imports keep the
files versioned and visible to the version check, without binary files in the repository.

**Alternatives**: Google Fonts (a third-party request, refused by the budget); committing the WOFF2 files
(as Inter is for share images: works, but invisible to version checks); the variable Inter Tight (44.9 KB for
all weights, heavier than two static weights).

## R6. The phone form: a three-level drill

**Decision** (owner, 2026-11-25): below 1024 px the timeline is a drill-down, tested as a mock-up with
made-up labels on the real record's shape:

1. **Overview**: one tile per theme, in the themes' order: name, count of changes, count of value marks, and
   a strip of the theme's changes packed into as few rows as don't overlap, on the career scale. Below,
   tiles for roles (a strip of the roles), threads and "where next".
2. **A list**: a theme's changes oldest first, each a row with its label, dates in words, value mark, thread
   name and a one-row bar showing where it sits in the career. Roles, a thread and "next" are lists too.
3. **A card**: label, theme, dates, the bar, the card text, "Read the value story" for a value change,
   "Follow this thread" (which opens the same change within its thread), and previous and next within the
   current list.

A breadcrumb (Themes › list › item) is pinned under the section heading while drilled in, with a back
control. Levels are routed on the hash (`#theme-<id>`, `#change-<id>`, `#change-<id>-in-<list>`), so the
browser's back button steps out; Escape does too; focus moves to each level's heading. Tablets held upright
(768 to 1023 px) lay the tiles out in two columns.

Without scripts, the same HTML reads in order: the overview (tiles are anchor links), then each list, then
each card, with "Back to themes" links. The script only hides the levels not in view.

**Rationale**: the owner rejected both swimlane takes on a phone (2026-11-25): with every change labelled
the lines' meaning was lost; with marks only, "you can only see one thing at a time". Starting from the
themes keeps the first screen readable and puts any change two taps away (SC-007).

**Alternatives**: the two rejected takes; a horizontal-scrolling landscape timeline on phones (fails FR-008's
"without sideways scrolling"); a bottom sheet for cards (covers the list it belongs to; the in-place card
keeps the breadcrumb honest).

## R7. The landscape form: build-time SVG with placed labels

**Decision**: from 1024 px, `Swimlanes.astro` renders one SVG at build: years left to right with the latest
year magnified month by month (the visual CV's layout: years over about 78% of the width, the latest year
over the last 20%), one lane per theme with changes packed into rows, roles across the top as bars, "next" at
the right. Each change is an `<a>` to its card's anchor. Labels are placed at build into the first free row
after their bar, using advance widths from `domain/metrics.json`, which `scripts/gen-cv-metrics.ts`
generates from the font files once per font update; a label with no room is left off the picture and shows
on hover and focus (and is always on its card and in the lists). The Playwright overlap test is the
guarantee; the build-time estimate is deliberately wide.

The SVG is in the HTML once, inside a container hidden below 1024 px; the phone form is hidden from
1024 px. So each width gets one form, both work without scripts, and no layout is measured in the browser.

**Rationale**: SC-003 (no overlaps from 320 to 1920 px) and FR-014 (works without scripts) rule out
browser-side packing, which the visual CV uses for print.

**Alternatives**: measuring in the browser after fonts load (the visual CV's way; a layout shift and nothing
without scripts); no labels on the landscape form (loses the visual CV's main strength, which the owner wants
on wide screens).

## R8. Zoom by role

**Decision**: on the landscape form, choosing a role zooms the x-axis to that role's years (the scale's
domain changes; marks move with a 0.3 s transition, none with reduced motion); "Whole career" zooms out.
Escape also zooms out. The zoomed view keeps the latest year's months magnified if they fall inside it.

**Rationale**: FR-012 asks for zooming into an era. Roles are already approved data and a natural era; any
other era list would be new text to approve.

**Alternatives**: a drag-to-select brush (hard by keyboard and touch); fixed thirds of the career
(arbitrary, meaningless names).

## R9. PDFs: approved bytes, text read at validation

**Decision**: `downloads.yaml` lists each PDF: `kind` (`plain` or `visual`), `file`, `title`,
`approved: {date, source, sha256}` of the bytes. Validation recomputes the hash and extracts the text with
`unpdf` (2.2.2, 23 Nov 2026; MIT; unjs; PDF.js's serverless build; four releases in the last month), then
applies the phone patterns to the text and the document metadata. A static endpoint serves each file at
`/cv/<file>` from `data/cv/downloads/`. A missing PDF hides its download and warns (spec edge case).

**Rationale**: FR-019 says the build refuses a PDF with a phone number; that needs its text. A hash makes a
hand-swapped file fail.

**Alternatives**: `pdfjs-dist` 6.5.438 directly (37.6 MB unpacked, more setup for Node); `pdf-parse` 2.4.5
(last published October 2025, pins an older PDF.js and a native canvas module); checking only in the career
record (FR-019 asks the site's build to refuse).

## R10. Motion

**Decision**: the resting state is the finished picture. When the timeline first enters the viewport and
motion is allowed, the script adds a class that starts the draw-in: on the landscape form a `clip-path` sweep
left to right over 2.5 s with the labels fading in behind it; on the phone form, each strip grows left to
right, staggered by tile. A pointer down, wheel, scroll past or key press ends it at once. Level changes on
the phone slide 0.2 s; cards and zoom 0.3 s. `prefers-reduced-motion: reduce` disables all of it, in CSS and
in the script.

**Rationale**: FR-015 to FR-017; a page that's complete before any script runs passes the no-script, print
and thumbnail cases for free.

**Alternatives**: an animation library (budget); starting hidden and revealing (blank page if the script
fails).

## R11. Email without the literal address

**Decision**: the HTML holds the address in parts (`data-user`, `data-domain`) and, for readers, in words
("alex at alexanderwebber.com"). The script replaces the words with a `mailto:` link. Cloudflare's own email
obfuscation never sees a literal address, so it changes nothing on the page.

**Rationale**: FR-003. It only slows simple scrapers: the PDFs on the page carry the address, as any CV must.

**Alternatives**: Cloudflare's email obfuscation (its own script and `/cdn-cgi/` link; whether it applies to
Workers static assets isn't documented); an image of the address (inaccessible).

## R12. Share image

**Decision**: `/og/cv.png` through `ogEndpoint`: the approved page title, and the theme strips drawn as on
the phone overview (from `domain/pack.ts`), as an SVG image inside the satori card. No other words. Fonts as
the page (the packages' WOFF files, since satori can't read WOFF2).

**Rationale**: FR-005 wants the image to show the timeline; the strips read at thumbnail size, the full
swimlanes don't.

**Alternatives**: a screenshot of the landscape form (needs a browser at build); text only (fails FR-005).

## R13. Use counts outside this repository

**Decision**: the owner's private tooling runs one GraphQL query against Cloudflare's analytics API
(`httpRequestsAdaptiveGroups`, filtered to the CV's paths, grouped by path, last 7 days) with a read-only
token kept outside every repository, and shows the counts to the owner. First, one test query settles
whether the free plan allows the path dimension for this zone and whether static-asset requests are
counted. If either fails, US6 is dropped and the owner is told (US6, scenario 2).

What Cloudflare's documentation says (read 2026-11-25): `httpRequestsAdaptiveGroups` is available on every
plan, including Free; adaptive datasets keep at least 31 days on Free and a query may cover 30 days
(changelog, 2 Oct 2026); that change "does not alter which datasets or fields your plan can access", and no
page states whether the path field is open on Free. Counts are sampled only at volume, so this page's counts
should be exact.

**Rationale**: the repository is public: a workflow's logs and summaries here would publish the counts.

**Alternatives**: Cloudflare Web Analytics (a script on the page, refused by FR-025); a Worker counting
requests to `/cv/` (would put the Worker in front of static assets for those paths, and a store for counts:
cost and complexity for a weekly number).

## R14. Unlisted, with one switch

**Decision**: `page.yaml` has `listed: false`. While false: `<meta name="robots" content="noindex">` on the
page, `X-Robots-Tag: noindex` on the PDFs (a `_headers` entry the build writes), the sitemap integration's
`filter` drops `/cv/`, and no menu or landing page links to it. Setting `listed: true` reverses all four; a
test builds both ways.

**Rationale**: FR-004 asks for one setting.

**Alternatives**: a separate unlisted path (a second address to retire later).

## R15. Testing

**Decision**: unit tests in Vitest for the domain (dates in words, scale, packing, label placement), schemas
and fixtures, the store's approvals and refusals (planted unapproved item, phone number, unapproved PDF,
missing card, single-change thread: SC-004), budgets, the import and compare scripts, the redaction, and a
sentinel test that no message quotes item text. Playwright on the previews: the drill at 320, 375 and
768 px (every level, back button, Escape, focus), the landscape form at 1024, 1440 and 1920 px (labels,
threads, zoom), no overlapping boxes at any of those widths (SC-003), scripts off (SC-006), reduced motion
(SC-002), forced colours; axe on every state in light and dark; Lighthouse on the typical preview (SC-001).
JS suites run from PowerShell with Node 22 (house tip: Git Bash fails at load on this machine).

**Previews** (`tests/fixtures/cv-preview/`, generated, made up): `typical`, `stress`, `minimal` (one theme,
one change, no threads, no downloads), `unlisted-off` (listed: true).

## R16. Budgets of text

**Decision** (owner, 2026-11-25, for the card): card 280 characters; change label 72; role label 48; theme
line 100; thread name 40, thread line 100. The import refuses over-budget text, naming the item.

**Rationale**: the card fits a 360 x 640 screen with its title and controls without scrolling; labels fit two
lines on a phone row and one row on the landscape form at 1440 px.

## R17. Dependencies checked

| Package | Version | Published | Licence | Why |
|---|---|---|---|---|
| `unpdf` | 2.2.2 | 2026-11-23 | MIT | PDF text in validation (R9) |
| `@fontsource/inter-tight` | 5.3.0 | 2026-07-19 | OFL-1.1 | Text font (R5) |
| `@fontsource/space-grotesk` | 5.3.0 | 2026-07-19 | OFL-1.1 | Display font (R5) |

Weighed and not taken: `pdfjs-dist` 6.5.438, `pdf-parse` 2.4.5, `@fontsource/jetbrains-mono` 5.3.0 (the
visual CV's dates; not in the lean set), `@fontsource-variable/inter-tight` 5.3.0. No animation or charting
library: the budget is 10 KB gzip and the drawing is static SVG.
