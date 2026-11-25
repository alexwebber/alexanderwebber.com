# Implementation Plan: Interactive CV

**Branch**: `004-interactive-cv-plan` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-interactive-cv/spec.md`

## Summary

Add a CV section at `/cv/`: the owner's whole CV on one page, with the timeline of changes at its heart.
The section is new and self-contained (`src/sections/cv/`, `schemas/cv/`, `data/cv/`), injected by its own
Astro integration only once approved CV data exists, as the journey story is. Until then everything is
built and tested against made-up CVs on `/cv-preview/<state>/` in a `SHELL_PREVIEW=1` build.

**The timeline has two forms** (owner, 2026-11-25, after three phone mock-ups):

- **Below 1024 px** (phones, and tablets held upright): a **drill-down**. The first level shows the themes
  of change as tiles, each with its count, its value marks and a strip of bars showing when it was busy;
  roles, threads and "where next" sit below them. Tapping a theme lists its changes over time; tapping a
  change opens its card. A breadcrumb (Themes › theme › change) stays pinned, and the back control, the
  browser's back button and Escape each step out one level. The two swimlane mock-ups (every change
  labelled, or marks only) were both rejected as unreadable on a phone.
- **From 1024 px**: the **landscape swimlanes** of the visual CV, labelled where labels fit, as the first
  level, with the same drill, breadcrumb and cards beneath it, and zoom by role.

Both forms are built at build time from the same HTML. Without scripts the page is a complete CV: every
theme, change, role, thread and card is in the HTML as linked sections (the drill's levels as anchors).
A small script (budget 10 KB gzip, no library) turns them into the drill, the animation and the zoom.

**Approved text only.** The career record exports an approved set; `scripts/import-cv.ts` writes it into
`data/cv/` with a sha256 approval per item, and the loader refuses anything without a matching approval,
so unapproved text can't reach a page by any build path (spec 003's mechanism, per item). The import also
scans for phone numbers, checks every budget, and `scripts/compare-cv.ts` compares the built page's text
with the export word for word. The two PDFs are approved by the sha256 of their bytes, and the build reads
their text to refuse a phone number.

**Use counts (US6) are delivered outside this repository**, by the owner's private tooling reading
Cloudflare's analytics API with a read-only token, because a public repository is the wrong place for them.
The page itself only has to make no third-party request, which the existing budget check enforces.

New dependencies: `unpdf` (build-time PDF text), `@fontsource/inter-tight` and `@fontsource/space-grotesk`
(self-hosted fonts). Recurring cost: **$0**.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (deliberate pin), Astro 7.4.7, Node >= 22.23.4. No Python change.

**Primary Dependencies**: `unpdf` 2.2.2 (MIT, unjs; PDF.js's serverless build) for reading PDF text in
validation; `@fontsource/inter-tight` 5.3.0 and `@fontsource/space-grotesk` 5.3.0 (OFL) through Astro 7's
Fonts API with the local provider. Reuses `yaml`, `ajv` (`SchemaSet`), `satori`/`sharp` (`ogEndpoint`),
`Base`, `Meta`, the design tokens, `check-links` and the privacy scans. ([research.md](research.md) R5, R9,
R17.)

**Storage**: approved YAML in `data/cv/` and approved PDFs in `data/cv/downloads/`, read through a new
`CvStore` built on `src/shared/storage` ([data-model.md](data-model.md)).

**Testing**: Vitest (schemas, the loader's approval and referential checks, every refused case, budgets,
the domain's scale, packing, date wording and label layout, the import and compare scripts, the PDF check);
Playwright and axe over `/cv-preview/<state>/` at 320, 375, 768, 1024, 1440 and 1920 px, in light, dark,
forced colours, reduced motion and with scripts off; Lighthouse on the preview ([quickstart.md](quickstart.md)).

**Target Platform**: static pages on Cloudflare Workers static assets, as the rest of the site.

**Project Type**: a new section of the existing web application (constitution Principle VII).

**Performance Goals**: mobile Lighthouse performance >= 90, accessibility 100, LCP <= 2.5 s (SC-001).

**Constraints**: the repo's budgets (`scripts/lighthouse-budget.mjs`): same-origin JS <= 10 KB gzip,
HTML+CSS+JS <= 150 KB gzip, no third-party request. Fonts about 58 KB of WOFF2 (Space Grotesk 700 12.8 KB,
Inter Tight 400 22.0 KB and 600 22.7 KB, measured from the 5.3.0 packages), one preloaded. WCAG 2.2 AA in
light, dark and forced colours. Text budgets: card 280 characters, change label 72, role label 48,
theme line 100 (owner, 2026-11-25, for the card). No phone number anywhere in the section's output.

**Scale/Scope**: designed for any CV from one theme with one change; tested with a typical made-up CV
(5 themes, about 50 changes, 8 roles, 5 threads, 3 "next") and a stress CV (8 themes, 90 changes, 12 roles,
long labels and many changes in one year). The real CV's size is unknown to this repository.

**Recurring costs**: **$0**: static files on the existing free tier; the counts use Cloudflare's existing
analytics.

**Unknowns**: none left as NEEDS CLARIFICATION. One fact waits on the owner: whether Cloudflare's free plan
answers a per-path query for this zone (US6). It's tested with one query once the owner has made the read-only
token; if it can't, US6 is dropped and the owner is told (spec, US6 scenario 2). Nothing in this repository depends
on the answer.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

| Principle or bar | Assessment | Evidence in design |
|---|---|---|
| I. Move fast, spike first | PASS | The phone form was settled by three throwaway mock-ups before planning; the build starts from the chosen one |
| II(a) Contract tests at graduation | PASS | Schemas, loader approvals and refusals, budgets, import and compare scripts, PDF check, domain functions, page states over previews |
| II(b) Eval suite for AI decisions | N/A | Nothing on the site drafts text. The CV is drafted and approved in the private career record; the site only refuses what isn't approved |
| II(c) Error handling and logging | PASS | Every refusal names the file, the item id and the field, and never quotes CV text (a sentinel test proves it) |
| III. Own your data | PASS | Approved files in git, rendered at build. No provider, no request at view time |
| IV. Pluggable providers and storage | PASS | No provider. Read through `CvStore` on the shared storage layer; the career record is reached only by the import script, offline |
| V. Serverless, gracefully degrading | PASS | Static pages, no new Worker route. Without scripts the whole CV reads as linked sections. "Last updated" shown for the downloads, the only dated things |
| VI. Privacy by default | PASS, one new category | CV text is a new category, published only per item with the owner's approval and after the sharing rules are re-checked (FR-023). No phone number in text or PDFs, checked at build. The email address never appears literally in the HTML. Unlisted until one setting changes |
| VII. Modular sections | PASS | Everything in `src/sections/cv/`, `schemas/cv/`, `data/cv/`. Shared code gains nothing section-specific; `astro.config.mjs` gains the integration, the Fonts API entries and the sitemap filter, as it did for Running |
| VIII. Authentic voice | PASS | Text comes only from the career record's approved set, word for word (FR-021, SC-005). Edits during approval go into `VOICE.md` (FR-024) |
| Mobile-first and fast | PASS (budget set) | Phone form designed first; no library; script about 6 KB gzip estimated; fonts 58 KB with fallbacks sized to avoid layout shift |
| Accessible | PASS (verification planned) | Real headings and links at every level, a labelled breadcrumb, focus moved to each level's heading, the value mark is a star shape and a word, threads by name; axe in light and dark, forced colours |
| SEO and social previews | PASS | Approved title and description, a share image of the theme strips; `noindex` while unlisted |
| Graceful degradation | PASS | No data source to fail; scripts optional |
| Visualisations first | PASS | The timeline is the page's centre on both forms |
| Tech constraints | PASS | Astro on Cloudflare; no new service; $0 |
| Build gate from day one | PASS | New schema, approval, referential, budget, phone and PDF checks run in the existing gate's `validate-data` and build |
| Broader CI deferred | PASS | Existing path-filtered `tests.yml`; its filters gain the new section's paths |

**Gate result: PASS, no violations.** Complexity Tracking lists the choices worth the owner's eye.

### Post-design re-check (after Phase 1)

Re-checked against [data-model.md](data-model.md) and [contracts/](contracts/): every row still passes.
The design tightened four points. Each item's approval hash covers its named fields only, so adding a
thread to a change needs that change re-approved but nothing else. A PDF is approved by the hash of its
bytes, so a swapped file is refused. The drill's anchors are the same ids without scripts and with them,
so a shared link to a change works either way. And refusals name items by id, never by their text,
because the refused text is by definition not approved for public logs.

## Design answers

Each has the decision and its reason; the fuller reasoning is in [research.md](research.md).

1. **A new section** (R1). `src/sections/cv/` with its own integration, store, domain, components, pages and
   share image; `schemas/cv/`; `data/cv/`. Its routes exist only once `data/cv/page.yaml` does, so nothing
   shows before the content PR. Unlisted: `noindex`, out of the sitemap and menus while `listed: false`.
2. **Data files** (R2). `page.yaml` (header, contact, settings), `blocks.yaml` (the text blocks in order,
   value stories among them), `timeline.yaml` (themes, roles, threads, changes, next), `downloads.yaml` and
   the PDFs. One file per kind, because the set is imported whole from one export, never hand-edited.
3. **Approval** (R3). Each item carries `approved: {date, source, sha256}`: the sha256 of a canonical JSON
   of its named fields, `source` the career-record commit it came from. The loader recomputes every hash;
   a missing or stale one fails the build naming the item. PDFs: the sha256 of the bytes.
4. **Import and compare** (R4). `import-cv.ts --from=<export.json> --rules-checked=<date>` validates the
   export, refuses an item not marked approved, a phone number or an over-budget text, and writes the files.
   `--rules-checked` must be on or after the date the owner last re-confirmed the sharing rules, which the
   export carries from the career record (FR-023). `compare-cv.ts` reads `dist/cv/index.html` and the export and reports any
   difference word for word; its summary goes in the PR (SC-005).
5. **The phone form** (R6). Three levels, all in the HTML: overview, a list per theme, roles, threads and
   next, and a card per item. Without scripts they're sections in reading order joined by anchors. With
   scripts one level shows at a time, routed on the hash (`#cv`, `#theme-<id>`, `#change-<id>`,
   `#change-<id>-in-<list>`), so the back button walks out. Previous and next step within the current list;
   a change reached from a thread steps through the thread.
6. **The landscape form** (R7). From 1024 px: an SVG of the swimlanes built at build time (years left to
   right, the latest year month by month, roles across the top, "next" at the right), each change a link to
   its card. Labels are placed at build in free rows from the font's measured advance widths; a label with
   no room shows on hover and focus, and on its card. Below 1024 px the same SVG is not sent.
7. **Zoom** (R8). Tapping a role on the landscape form zooms to that role's years; "Whole career" zooms
   back out. Keyboard: Enter on a role, Escape to zoom out. No new content to approve.
8. **Threads** (R6, R7). Landscape: following a thread lights its changes and dims the rest, with previous
   and next. Phone: a thread is a list like a theme. A thread needs two or more changes.
9. **Animation** (R10). The finished picture is the resting state; the script adds the draw-in only when it
   starts. Landscape: a sweep left to right in 2.5 s. Phone: the overview's strips grow left to right.
   Any tap, scroll or key ends it. Level changes slide 0.2 s. Reduced motion: no movement at all.
10. **Downloads** (R9). Served at `/cv/<file name>` by a static endpoint from `data/cv/downloads/`, each
    with its approval date as "Last updated". Validation extracts the text with `unpdf` and refuses a phone
    pattern; it also refuses a PDF whose bytes don't match its approval. `X-Robots-Tag: noindex` on them
    while unlisted.
11. **Email** (R11). The address is assembled by the script into a `mailto:` link; without scripts the page
    shows it in words ("alex at alexanderwebber.com"), so the literal address is never in the HTML. LinkedIn
    shows once `page.yaml` has its address.
12. **Look** (R5). The visual CV's palette and lane colours as the section's tokens (light, plus a dark set
    checked for AA), Space Grotesk 700 for the name and headings, Inter Tight 400 and 600 for text, dates
    in Inter Tight's tabular figures. Fonts through Astro's Fonts API with generated fallback metrics.
13. **Share image** (R12). `/og/cv.png`: the approved title and the theme strips drawn as in the overview,
    no other words.
14. **Use counts** (R13). Outside this repository (see Summary). Nothing here changes for them.

## Project Structure

### Documentation (this feature)

```text
specs/004-interactive-cv/
├── spec.md              # FR-007, FR-008, US1 and US3 amended by this plan (owner, 2026-11-25)
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit-tasks), not created here
```

### Source Code (changes to the repository)

```text
schemas/cv/
├── page.schema.json, blocks.schema.json, timeline.schema.json, downloads.schema.json   # new
├── export.schema.json                       # the career record's export, read by import-cv
└── fixtures/                                # valid and invalid, made up
src/sections/cv/                             # new section
├── README.md                                # the graduation design note
├── integration.ts                           # routes, only when data/cv/page.yaml exists
├── validate.ts                              # approvals, references, budgets, phone, PDFs
├── data/store/                              # CvStore on src/shared/storage; files, hashes
├── domain/
│   ├── dates.ts                             # "2013 to 2016", "about 2024", "February to May 2026"
│   ├── scale.ts                             # career scale: years, then the latest year by month
│   ├── pack.ts                              # rows for bars without overlap (strips, swimlanes)
│   ├── labels.ts                            # label placement from advance widths
│   ├── metrics.json                         # advance widths, generated from the font files
│   └── hashes.ts                            # canonical JSON and sha256 per item
├── components/
│   ├── CvPage.astro, CvHeader.astro, CvBlocks.astro, CvContact.astro, CvDownloads.astro
│   ├── Timeline.astro                       # both forms and the no-script reading order
│   ├── ThemeOverview.astro, ThemeList.astro, ItemCard.astro, Crumbs.astro
│   ├── Swimlanes.astro                      # the landscape SVG
│   └── timeline.client.ts                   # the drill, zoom, threads, animation, email (no library)
├── pages/cv.astro, pages/download.ts         # the page; the PDF endpoint
├── og/cv.png.ts
└── styles/cv.css                            # .cv- prefix; the section's tokens
data/cv/                                     # in the content PR only
scripts/
├── import-cv.ts, compare-cv.ts              # new
├── gen-cv-metrics.ts                        # new: metrics.json from the font files
├── scan-privacy.ts                          # findings in CV files redacted, as for the story
└── lighthouse-budget.mjs                    # the CV page type
astro.config.mjs                             # cv integration, fonts, sitemap filter, /cv-preview/[state]
public/_headers                              # X-Robots-Tag for /cv/*.pdf while unlisted (generated at build)
.github/workflows/tests.yml                  # path filters
tests/
├── fixtures/cv-preview/                     # made-up CVs: typical, stress, minimal, unlisted
├── e2e/cv.spec.ts, cv-phone.spec.ts, cv-landscape.spec.ts, cv-noscript.spec.ts
├── a11y/cv.spec.ts
└── unit/                                    # schemas, store, validate, domain, import, compare, PDF
```

**Structure Decision**: a new section beside Running, with the same split between store, domain, data
loaders and components. Shared code (`src/shared/`) gains nothing.

### Graduation plan (Principle I and II)

| Unit | Graduation bar delivered with it |
|---|---|
| CV files, approvals, import and compare | [contracts/content-files.md](contracts/content-files.md), schema fixtures, store and validate tests, planted-case tests (SC-004), the sentinel test |
| The page and timeline | [contracts/timeline-ui.md](contracts/timeline-ui.md), Playwright and axe on every preview state and width, the no-script and reduced-motion runs, Lighthouse, an adversarial self-review |
| Downloads | [contracts/routes.md](contracts/routes.md), PDF check tests with planted phone numbers and a swapped file |

### Delivery order (input to /speckit-tasks)

Each slice can be its own PR. Slices 1 to 6 use made-up text only and change nothing a visitor sees,
because the CV's routes exist only once `data/cv/page.yaml` does.

1. **Files and checks**: schemas, `CvStore`, hashes, validation (approvals, references, budgets, phone),
   `import-cv` and `compare-cv` against a made-up export, the redaction, the gate wiring.
2. **US1, the page and the phone form**: header, blocks, contact, the overview, lists and cards, the
   breadcrumb and hash routing, the no-script reading order, fonts, the section's tokens; previews, e2e and
   axe on phone widths.
3. **US2, the landscape form**: scale, packing, label placement and metrics, the swimlanes, threads, zoom
   by role; e2e at 1024 px and up, the overlap test across widths.
4. **US3, motion**: draw-in on both forms, level slides, skip, reduced motion.
5. **US4, downloads**: the endpoint, the PDF checks with `unpdf`, "Last updated", headers.
6. **Polish and graduation**: share image, the unlisted switch (sitemap, robots, headers), Lighthouse on
   the previews, the section README, the adversarial review.
7. **The content PR**, with the owner, after the sharing rules are re-confirmed: the export from the career
   record, `import-cv`, `compare-cv`, `VOICE.md`, the full gate locally, then a guided review of the live
   page on a phone and a desktop (it stays unlisted).

US6 is built in the owner's private tooling once the owner has made the read-only token, in parallel with any slice.

## Owner steps

What the plan needs from the owner, folded into reviews they're already doing:

| When | Step |
|---|---|
| This plan's PR | The confirmations below |
| Any time | A read-only Cloudflare analytics token, for the US6 test query (asked for outside this repository) |
| Each UI slice's PR | Screenshots of the previews on a phone and a desktop, with made-up text |
| Before the content PR | Re-confirm the sharing rules (FR-023), and approve the threads and cards in the career record |
| After the content PR | Guided review of the live page on a phone and a desktop; then, when they want, the switch to fully public |

## Open questions for the owner (PR checkboxes)

Nothing here is visible yet: the page appears only with the content PR. Each has a recommended option.

1. **The phone form is the drill-down** (themes, then a theme's changes, then a change) below 1024 px, with
   tablets held upright laying the tiles out in two columns. FR-007, FR-008 and US1, US3's phone wording
   are amended to say so. *Recommended: confirm the amended wording.*
2. **Zoom on the landscape form is by role**: tap a role to fill the width with its years; "Whole career"
   to go back. *Recommended: yes; no new text to approve.*
3. **Labels on the landscape form** appear where they fit, as on the visual CV; a label with no room shows
   on hover and focus, and on its card. *Recommended: yes.*
4. **Without scripts, the email reads "alex at alexanderwebber.com"** in words, and with scripts it's a
   normal link; the literal address is never in the HTML (FR-003). The PDFs on the same page do contain it,
   so this only slows the simplest scrapers. *Recommended: yes.*
5. **Text budgets**: card 280 characters (agreed), change label 72, role label 48, theme line 100. Over
   budget fails the import. *Recommended: yes.*
6. **PDF file names**: `alexander-webber-cv.pdf` (plain) and `alexander-webber-cv-visual.pdf`.
   *Recommended: yes.*
7. **"Last updated"** shows only beside the downloads (their approval dates), not on the page.
   *Recommended: yes; the page's text changes rarely and a date would invite the question "is this current?"*

## Complexity Tracking

> No constitution violations. Items below are deliberate choices the owner may want to review.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Two forms of the timeline | A swimlane picture is unreadable on a phone (two takes rejected, 2026-11-25), and the drill is thin on a desktop | One form for all widths: either fails the phone or wastes the desktop |
| Per-item approval hashes | FR-022 names the item; a change to one card must not re-approve the rest | One hash for the file: any edit re-approves everything and names nothing |
| Build-time label placement from font metrics | Labels must never overlap (SC-003) and the page must render without scripts | Measuring in the browser: layout shift and no labels without scripts |
| `unpdf` in validation | FR-019 needs the PDFs' text to refuse a phone number | Trusting the export alone: a PDF swapped by hand would pass |
| Use counts outside the repository | The repository is public; the counts are the owner's | A workflow here: its logs and summaries are public |
| Hash routing | The phone's back button must step out a level | In-page state only: back would leave the page |
