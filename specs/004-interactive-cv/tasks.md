---

description: "Task list for the Interactive CV (004-interactive-cv)"
---

# Tasks: Interactive CV

**Input**: Design documents from `/specs/004-interactive-cv/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (README, content-files,
routes, timeline-ui, gate), quickstart.md

**Tests**: Test tasks ARE included. The constitution (Principle II(a)) and plan.md's *Graduation plan*
require solid contract coverage **by graduation**. Tests are written **alongside or straight after**
the code they cover; test-first/TDD is NOT required. Suites run locally for the touched files
(`/pr-ready`) and in full on every PR through the path-filtered `tests.yml` jobs. The build gate gains
no step: the CV's checks run inside `validate-data`, the build's first hook, `check-links` and
`scan-privacy` (contracts/gate.md).

**Privacy (applies to every task)**: the repository is public. Slices 1 to 6 (Phases 1 to 7) use
made-up text, made-up PDFs and generated data only, and no task in them reads the private career
record, its export or the owner's sharing rules. Only Phase 8 (slice 7) brings real text in, and only
once the owner has re-confirmed the sharing rules and approved the text (FR-023). No task, fixture,
test, screenshot, PR body or commit message may carry CV wording, an employer, a role, a colleague, a
date from the real CV or anything about the owner's working life; tasks describe the CV by shape only
("a theme", "a change", "Change A").

**Owner decisions reflected here (plan PR #160, merged 2026-11-25; all seven open questions accepted as
recommended)**. The owner made these picks before he could see anything, so the ones judged only by eye
are **provisional** and each gets a show-and-confirm task in the slice that first shows it:

1. **Settled.** Below 1024 px the timeline is the drill-down (themes, then a theme's changes, then a
   change), tiles in two columns from 768 px (spec FR-007, FR-008 and US1, US3 already amended) (T049–T055).
2. **Provisional, show-and-confirm in T082.** Zoom on the landscape form is by role; "Whole career" goes
   back (T074).
3. **Provisional, show-and-confirm in T083.** Landscape labels show where they fit; a label with no room
   shows on hover and focus, and on its card (T069–T071).
4. **Provisional, show-and-confirm in T067.** Without scripts the email reads in words ("alex at" the
   domain); with scripts it's a `mailto:` link; the joined address is never in the HTML (T048, T054).
5. **Settled.** Text budgets: card 280 characters, change label 72, role label 48, theme line 100; over
   budget fails the import (data-model.md lists the rest: thread name 40, thread line 100, next title 72)
   (T014, T016, T021).
6. **Settled.** PDF file names `alexander-webber-cv.pdf` (plain) and `alexander-webber-cv-visual.pdf`
   (visual) (T007).
7. **Provisional, show-and-confirm in T095.** "Last updated" shows only beside the downloads (their
   approval dates), nowhere else on the page (T092).

**Owner decisions from the tasks' analysis (2026-11-25, all settled):**

8. The page's data date (constitution Principle V) is the timeline axis's last tick, the `as_of` month in
   words, on both forms and without scripts (T059; contracts/timeline-ui.md level 1).
9. FR-010 is per kind: a change shows its label, dates, lane and thread (if any); a role its label and
   dates; a "next" item its title. Next items carry no dates (T051).
10. Page title <= 60 characters and page description <= 160, over budget failing the import like the
    rest (data-model.md `Page.title`, `Page.description`; T014, T030).
11. A thread with one change is refused by the import and the build, never quietly dropped (spec Edge
    Cases; T016, T021).

**A show-and-confirm task** means: that slice's PR shows the owner the thing itself (preview
screenshots at phone width and on a desktop, light and dark, plus the exact local steps to try it:
`$env:SHELL_PREVIEW='1'; npm run build; npx astro preview`, then the named `http://localhost:4321/cv-preview/<state>/`
address and what to do there; the agent offers to open it for him in the session). The PR carries a
checkbox asking him to keep the pick or change it. **If he changes it, the change is made on that slice's
branch before it merges**: the code, its tests, the contract or plan wording it touches, and fresh
screenshots. Either way the pick is recorded in `DECISIONS.md`. A box left unanswered at merge is asked
at the next session's start, before anything builds on it.

**Use counts (US6)** are built outside this repository, in the owner's private tooling (plan.md
*Summary*, research.md R13). No task here implements them; this repository's only part is that the page
makes no third-party request, which T101's budget run and the existing Lighthouse budget enforce.

**Organization**: Each phase is one PR-sized delivery slice in plan.md's *Delivery order*, and one
session; slice 1 is Phases 1 and 2 together. Each phase header says which slice and PR it is, what goes
live, how to view it and whether it needs the owner. Owner steps are tasks marked **(owner, guided by
the agent)**: the agent prepares everything around them and folds them into reviews the owner is
already doing (plan.md *Owner steps*). Trigger-based work is under *Standing follow-ups*, written into
`PROJECT_MEMORY.md`'s *Next session* block so nothing depends on the owner remembering.

**Task IDs** are this feature's own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story the task serves (US1–US5, numbered as in spec.md; US6 has no tasks here)
- **(owner, guided by the agent)** marks a task that needs the owner

## Path Conventions (from plan.md)

- Section (TypeScript/Astro): `src/sections/cv/**`; `astro.config.mjs` gains the integration, the fonts,
  the sitemap filter and the `/cv-preview/[state]` route. `src/shared/` gains nothing (Principle VII)
- JSON Schemas: `schemas/cv/`; fixtures in `schemas/fixtures/cv/<schema>/{valid,invalid}/` (the repo's
  convention, which both `tests/contract/schemas.test.ts` and `ingest/tests/contract/test_schemas.py`
  require: pytest finds every `schemas/*/*.schema.json` by itself and fails a schema without fixtures
  there. plan.md's `schemas/cv/fixtures/` would be missed by both)
- CV data (Phase 8 only): `data/cv/`, `data/cv/downloads/`
- Scripts: `scripts/import-cv.ts`, `scripts/compare-cv.ts`, `scripts/gen-cv-metrics.ts`, run as
  `node scripts/<name>.ts` (Node's type stripping, erasable syntax only, as every script here)
- TS tests: `tests/{unit,contract,e2e,a11y}/`, helpers `tests/helpers/`
- Made-up exports: `tests/fixtures/cv-export/`; previews: `tests/fixtures/cv-preview/`
- No Python change. pytest runs whenever `schemas/` changes and validates the CV's fixtures too

## Slices, phases and stories

| Phase | Slice and PR (plan.md *Delivery order*) | User story (spec.md) | Needs the owner? |
|---|---|---|---|
| 1 Setup | Slice 1: files and checks (PR 1) | None | No |
| 2 Foundational | Slice 1: files and checks (PR 1, continued) | None (blocks all; US5's checks) | No |
| 3 | Slice 2: the page and the phone form (PR 2) | US1 Reading the CV, US2 on the phone | Screenshots; **confirm Q4** |
| 4 | Slice 3: the landscape form (PR 3) | US2 Exploring the timeline | Screenshots; **confirm Q2, Q3** |
| 5 | Slice 4: motion (PR 4) | US3 The timeline draws itself | A look, locally |
| 6 | Slice 5: downloads (PR 5) | US4 Downloading the CV | Screenshots; **confirm Q7** |
| 7 Polish | Slice 6: polish and graduation (PR 6) | Cross-cutting | No |
| 8 Launch | Slice 7: the content PR (PR 7) | US5 Publishing approved text | **Yes**: gated on the sharing rules and approval |

Slices 1 to 6 change nothing a visitor sees: the CV's routes exist only once `data/cv/page.yaml` does
(research.md R1), and no CV data enters the repository before Phase 8.

## The PR routine (every phase that raises a PR)

Referred to below as **the PR routine**:

1. `git fetch`, branch from `origin/main` (`004-interactive-cv-<slice>`), and load the house-process
   topic skills the phase needs (`speckit-house-process-tips-<topic>`: astro, testing, ui-accessibility,
   privacy-pipelines; share-images in Phase 7; owner-content in Phase 8; docs for any README).
2. Commit, then `/pr-ready` (`node scripts/process/pr-ready.ts`, in the background): the private-term
   search, the touched files' tests and the `dist/` comparison. `--suites` only for what CI can't cover
   (Phase 8's `data/`-only change: Vitest doesn't run in CI for it).
3. **Slices 1 to 6: `dist/` against `main`** in a deploy build. Expected: byte-identical, because no
   `data/cv/page.yaml` exists. Explain any difference in the PR (a font or CSS chunk moving, the
   astro tips); an unexplained one is checked in the built pages before the PR is called ready.
4. **UI slices**: `/pr-screenshots` of the phase's named preview states at phone width and on a desktop,
   light and dark; read every image before publishing (the ui-accessibility tips: tests have passed over
   broken layouts only a screenshot showed).
5. **Privacy pass before pushing**: read every new or changed file in full; made-up text only; fixtures
   from a fixed seed; nothing from the private career record.
6. **The PR body**: a *How to view it* section (the phase header's text: since nothing is deployed, the
   screenshots and the exact local steps to open the previews), what isn't built yet, and a checkbox for
   anything the owner must confirm, each with its recommended option. Say plainly that nothing changes on
   the live site.
7. `/pr-ready --no-dist` again after `gh pr create`, until every PR check is green, not just the
   required ones; then tell the owner it's ready.
8. After the merge, `/after-merge <pr>` waits for `main`'s Gate run to finish, deploy included.
9. Update *Next session* in `PROJECT_MEMORY.md` and `DECISIONS.md`, add any lesson to *Upstream
   candidates*, count tasks done by hand in `process/skill-candidates.yaml`, log the phase's token cost,
   and tell the owner it's a good point for a new session.

---

## Phase 1: Setup (slice 1: files and checks, PR 1)

**Purpose**: Register the new section with the repo's shared tooling, so the files and checks of Phase 2
have somewhere to live.

**Goes live / How to view it / Needs the owner**: see Phase 2 (one PR for both phases).

- [X] T001 [P] Create `src/sections/cv/data/store/schemas.ts` exporting `CV_SCHEMAS = ['cv/page', 'cv/blocks', 'cv/timeline', 'cv/downloads', 'cv/export'] as const` (the `$id`s `https://alexanderwebber.com/schemas/cv/<name>.schema.json`), and add the CV to the `SECTIONS` list in `scripts/gen-types.ts` with `outDir: 'src/sections/cv/data/store/generated'` (already gitignored by `src/sections/*/data/store/generated/`). Update both header comments
- [X] T002 [P] In `.github/workflows/tests.yml`, widen the `playwright=$(match '...')` alternation so `data/cv/` changes run Playwright (`data/running/owner` becomes `data/(running/owner|cv)`), because the content PR (Phase 8) changes only `data/cv/`; and add `scripts/(import-cv|compare-cv)\.ts$` beside `scripts/check-links\.ts$`, because the launch drill (T065) runs both. The `vitest=` filter already covers `src/`, `schemas/`, `scripts/` and `tests/{unit,contract,helpers,fixtures}/`
- [X] T003 [P] In `tests/helpers/scratch-site.ts`, make `copySite` also copy `data/cv/` when it exists (it copies `data/running` only today), so drills on a copy of the real site include the CV once Phase 8 adds it; extend `tests/unit/scratch-site.test.ts` for both cases

---

## Phase 2: Foundational (slice 1: files and checks, PR 1)

**Purpose**: The CV's schemas, `CvStore` with the per-item approval hashes, every validation rule
(approvals, references, cards, budgets, phone numbers), `import-cv` and `compare-cv` against made-up
exports, the redacted privacy findings and `check-links`' CV anchors. Every user story needs it; it is
US5's machinery (FR-021, FR-022, SC-004, SC-005), built first as spec 003 did.

**Goes live**: nothing visible. `validate-data` and the build's first hook gain the CV's checks, which do
nothing while `data/cv/` doesn't exist.

**How to view it**: nothing to view. The PR lists the refused cases (quickstart.md §2's table) with their
messages, the for-real drill's output (T037), and the `dist/` comparison (byte-identical).

**Needs the owner**: no (PR review only).

**Critical**: No user story work can begin until this phase is complete.

### 2a. Schemas (contracts/content-files.md; data-model.md)

Each schema: draft 2020-12, `title` the TypeScript type name, `additionalProperties: false` on every
object (the structure test checks it), shared types by `$ref` to `../defs.schema.json` where they fit,
and an `x-error` on each rule that never quotes the value. The approval block is written out in each
file as an untitled `$defs.approval` (a titled shared def breaks gen-types' index, owner-data-file
skill *Pitfalls*; a `schemas/cv/defs.schema.json` would be a schema pytest demands fixtures for). Text
budgets are **not** in the schemas: they're checked by T014's table so the message can give the count
(quickstart.md §2: "card is 281 characters (budget 280)").

- [X] T004 [P] Create `schemas/cv/page.schema.json` (`CvPage`) with every field of `data-model.md` `Page`: `Page.name`, `Page.headline`, `Page.location`, `Page.title`, `Page.description` (required one-line plain text); `Page.email_user` and `Page.email_domain` (required, the two parts, never a joined address); `Page.linkedin` (optional, pattern `^https://www\.linkedin\.com/in/[A-Za-z0-9_-]+/?$`); `Page.as_of` (`YYYY-MM`); `Page.listed` (boolean, required); `Page.sharing_rules_confirmed` (a date, required); `Page.approved` (`data-model.md` *Common fields* **Approval**: `date`, `source` 7 to 40 lower-case hex, `sha256` 64 lower-case hex)
- [X] T005 [P] Create `schemas/cv/blocks.schema.json` (`CvBlocks`: `{ blocks: [...] }`) with `data-model.md` `Text block.id` (*Common fields* **Id**: `^[a-z0-9]+(-[a-z0-9]+)*$`), `Text block.heading`, `Text block.kind` (enum exactly `pitch`, `value`, `future`, `skills`, `public`, `education`, `other`), `Text block.paragraphs` (non-empty list of non-empty plain text), `Text block.stories` (allowed only with `kind: value`, by `if`/`then`; each `{id, title, text}`, closed) and `Text block.approved`. "Exactly one `pitch`" and unique ids are T016's (cross-item rules)
- [X] T006 [P] Create `schemas/cv/timeline.schema.json` (`CvTimeline`: `themes`, `threads`, `roles`, `changes`, `next`) with `data-model.md` `Theme.id`, `Theme.name`, `Theme.line`, `Theme.colour` (enum `lane-1` to `lane-8`), `Theme.approved` (`themes`: `minItems: 1`, `maxItems: 8`); `Change.id`, `Change.label`, `Change.when`, `Change.theme`, `Change.thread` (optional), `Change.value` (optional), `Change.card` (required, `minLength: 1`), `Change.approved`; `Role.id`, `Role.label`, `Role.when`, `Role.card` (required), `Role.approved`; `Thread.id`, `Thread.name`, `Thread.line`, `Thread.approved`; `Next item.id`, `Next item.title`, `Next item.card` (required), `Next item.approved`. `when` is one pattern covering the seven forms of `data-model.md` *Common fields* **When** (year, rough year `~YYYY`, years `YYYY–YYYY` with an en dash, ongoing `YYYY–now`, month `YYYY Mon`, months `YYYY Mon–Mon`, into the latest year `YYYY–YYYY Mon`); "months only in the `as_of` year" and "start before end" are T016's
- [X] T007 [P] Create `schemas/cv/downloads.schema.json` (`CvDownloads`: `{ downloads: [...] }`) with `data-model.md` `Download.kind` (`plain` or `visual`), `Download.file`, `Download.title` and `Download.approved` (date, source, sha256 as contracts/content-files.md *Hashed fields* defines for a Download: over `kind`, `file`, `title` and the bytes' sha256). Narrowing, owner decision 6: `file` is `alexander-webber-cv.pdf` for `plain` and `alexander-webber-cv-visual.pdf` for `visual` (`if`/`then` with `const`), so a new version always replaces the old one at the same link (FR-020). "At most one of each kind" is T016's
- [X] T008 [P] Create `schemas/cv/export.schema.json` (`CvExport`), the career record's export as contracts/content-files.md *The career record's export* gives it: `format: 1`, `source`, `exported`, `page` (T004's fields without `approved`, plus `approved_on`), `blocks`, `timeline` (T005's and T006's items with `approved_on` in place of `approved`), `downloads` (`kind`, `file`, `title`, `path`, `approved_on`). `approved_on` is **not** required by the schema, so T021 can refuse its absence naming the item rather than failing on a schema message
- [X] T009 Add made-up fixtures (generated words, never real ones) in `schemas/fixtures/cv/{page,blocks,timeline,downloads,export}/{valid,invalid}/`, one invalid file per rule, named for it. Valid: a minimal and a full file of each (every `when` form, a value block with stories, a change with thread and value, LinkedIn present and absent). Invalid: a missing `approved`; a short or upper-case `sha256`; a `source` of 6 hex; an unknown `kind` and `colour`; a ninth theme; a change without `card`; an empty card; each malformed `when` (a hyphen in place of the en dash, `2026 Sept`, `~2014–2016`); `stories` on a non-value block; a `plain` download named otherwise; a LinkedIn URL on another host; an unknown key in each file. Commit with T010
- [X] T010 In `tests/contract/schemas.test.ts`, take the schema names from both sections (`[...RUNNING_SCHEMAS, ...CV_SCHEMAS]`) so the shared-fixture tests and "every fixture belongs to a known schema" cover `cv/*`; check `cd ingest; uv run pytest tests/contract/test_schemas.py` passes with the new schemas and fixtures (it finds them by itself)

### 2b. Domain and store (research.md R2, R3; data-model.md)

- [X] T011 [P] Create `src/sections/cv/domain/hashes.ts`, pure: `canonicalJson(value)` (keys sorted at every level, no whitespace, strings NFC-normalised; `data-model.md` *Common fields* **Approval**) and `itemSha256(kind, item, pdfBytes?)` over **named constant field lists** per kind, exactly contracts/content-files.md *Hashed fields* (Page, Text block, Theme, Thread, Role, Change, Next item, Download), never "everything but `approved`". "A field absent from an item is absent from its canonical JSON (not `null`)". A Download hashes the canonical JSON of `{kind, file, title, bytes}`, where `bytes` is the sha256 of the file's bytes. `Page.listed` and `Page.sharing_rules_confirmed` are outside the hash (`data-model.md` `Page`). The header comment records exactly what each hash covers (privacy-pipelines tips: an approval hash that can't be reproduced later proves nothing)
- [X] T012 [P] Create `src/sections/cv/domain/dates.ts`, first half, pure: `parseWhen(when, asOf) → { kind: 'point' | 'period', start, end, rough, ongoing, months }` for every form of `data-model.md` *Common fields* **When** (`Change.when`, `Role.when`), with "now" the end of `Page.as_of`'s month; issues for a month outside the `as_of` year and a start after its end, carrying no value
- [X] T013 [P] Create `src/sections/cv/domain/phone.ts`, pure: `findPhone(text) → { index, length }[]` for the patterns of `data-model.md` *Rules across entities* (UK and international forms; spaced, dotted and bracketed digits; `tel:` links). It must **not** match the CV's own numbers: years, year ranges with an en dash, `YYYY-MM-DD` dates, `as_of`, sha256 and commit hex, sizes ("123 KB"), counts. Used by T016, T021, T023 and T090, so one definition holds everywhere
- [X] T014 [P] Create `src/sections/cv/domain/budgets.ts`: one table of text budgets per kind and field, from `data-model.md` (`Page.title` <= 60, `Page.description` <= 160 (owner, 2026-11-25), `Theme.line`, `Change.label`, `Change.card`, `Role.label`, `Role.card`, `Thread.name`, `Thread.line`, `Next item.title`, `Next item.card`; owner decision 5), counted in Unicode code points, and `overBudget(kind, item) → { field, length, budget }[]`
- [X] T015 Create `src/sections/cv/data/store/files.ts` and `src/sections/cv/data/store/cv-store.ts`: `CvStore` over the shared storage helpers (`parseDataFile`, `listDataFiles`, `SchemaSet` with `CV_SCHEMAS`, `DataValidationError`; research.md R2, R3), reading `data/cv/page.yaml`, `blocks.yaml`, `timeline.yaml`, `downloads.yaml` and the PDFs in `data/cv/downloads/`. No `page.yaml` means no CV (`undefined`), whatever else is there. Any other file under `data/cv/` is an error. After schema validation it recomputes every item's hash with T011 and every listed PDF's bytes: a missing `approved` or a hash that doesn't match throws, naming file, kind and id (`data/cv/timeline.yaml: change change-a: approval doesn't match`, contracts/content-files.md *Messages*), so no build path can render unapproved text (FR-022). Schema messages drop the offending value (`withoutValue`, as the journey files do). No message quotes CV text. Export the loaded types (`CvData`, `CvChange`, ...) from the generated types
- [X] T016 Create `src/sections/cv/validate.ts` exporting `validateCv(root, options)` → `DataIssue[]` (contracts/gate.md), each issue naming file, kind, id and rule, never the text. Errors: a dangling `Change.theme`, `Change.thread` or `Change.value` (`data-model.md` *Rules across entities*); a thread with fewer than two changes ("thread has 1 change (needs 2)"); a missing card on a change, role or next item (US5 scenario 4); every over-budget field from T014 ("card is 281 characters (budget 280)"); a phone pattern (T013) in any text field of any file ("phone number"); a month outside the `Page.as_of` year or a start after its end (T012); duplicate ids within a kind, and duplicate value-story ids; not exactly one `pitch` block (`Text block.kind`); more than one download of a kind (`Download.kind`). Warning: a listed PDF missing from `data/cv/downloads/` (its download is hidden; spec edge case). No `data/cv/` gives no issues. The store's approval errors (T015) surface here too, so `validate-data` reports everything at once
- [X] T017 Register the CV in `scripts/validate-data.ts`'s `SECTIONS` (`{ dataDir: 'data/cv', validate: validateCv }`), after Running; update its header comment
- [X] T018 Create `src/sections/cv/integration.ts` (`export default function cv(): AstroIntegration`) with `cvExists(root = process.cwd())` (true when `data/cv/page.yaml` exists, checked from files without loading them, research.md R1) and an `astro:build:start` hook that loads `CvStore` when it exists, so a bad or unapproved file stops the build before Astro empties `dist/` (astro tips). No routes yet (T046 adds them). Add `cv()` to `integrations` in `astro.config.mjs`, after `running()`, and update the config's comment

### 2c. Import and compare (research.md R4; contracts/content-files.md)

- [X] T019 Create `tests/helpers/cv.ts`: made-up export builders from a fixed seed (`lorem(seed, n)` from `tests/helpers/journey.ts`), `exportItem(kind, extra)` for each kind, `writeExport(dir, value, pdfs)`, and `minimalPdf({ text, title, author })` writing a small valid PDF by hand (one page, a standard font, a correct xref table) with no new dependency, so tests and previews can plant a phone number in a PDF's text or metadata. Words are lorem-style; labels read "Change A", "A made-up role"
- [X] T020 Create `tests/fixtures/cv-export/generate.ts` (deterministic, `\n` line endings, output committed) writing `tests/fixtures/cv-export/<state>/export.json` and its PDFs for the four states of contracts/routes.md: `typical` (5 themes, about 50 changes, 8 roles, 5 threads, 3 next, both PDFs), `stress` (8 themes, 90 changes, 12 roles, labels at their budgets, one long unbroken word, many changes in one year and lane), `minimal` (one theme, one change, no threads, no downloads), `unlisted-off` (`listed: true`), with every `when` form spread across them (plan.md *Scale/Scope*). Each carries a made-up `page.sharing_rules_confirmed` and the domain `example.com`, never the real one
- [X] T021 Create `scripts/import-cv.ts` and its npm script `import-cv`: `node scripts/import-cv.ts --from=<export.json> --rules-checked=<YYYY-MM-DD> [--dry-run] [--root=<dir>]`, exporting `importCv(options)` for tests and the preview generator. Steps exactly as contracts/content-files.md *`scripts/import-cv.ts`*: validate against `cv/export`; refuse an item without `approved_on`, a phone pattern in any text (T013) or PDF (T090 adds the PDF text in slice 5; until then, the bytes' hash and file name only), any over-budget text (T014), a dangling reference, a one-change thread, a change or role without a card, months outside the `as_of` year, an export without `page.sharing_rules_confirmed`, and `--rules-checked` earlier than it (FR-023); then write the four YAML files (`yaml`'s `stringify` with `lineWidth: 0`, `\n` endings), each item with `approved: {date: approved_on, source, sha256}` from T011, and copy the PDFs into `data/cv/downloads/`, replacing older versions at the same names (FR-020). Re-read what it wrote through `CvStore` and fail if anything doesn't load. Output: counts per kind and the files written; on refusal, exit 1 with one line per refusal naming file, kind, id and reason, never text. `--dry-run` stops after the checks and writes nothing. `--root` (default the repo) lets the preview generator and drills write elsewhere
- [X] T022 Create `scripts/compare-cv.ts` and its npm script `compare-cv`: `node scripts/compare-cv.ts --from=<export.json> [--dist=dist] [--page=<built html>]`, exporting `compareCv(html, exportValue) → Difference[]`. It reads `dist/cv/index.html` (or `--page`, so a preview's built page can be compared too), collects each `[data-cv-item="<kind>:<id>"]`'s `[data-cv-field="<field>"]` text (whitespace collapsed, entities decoded with one lookup, tags dropped without adding spaces: testing tips), and compares the fields contracts/content-files.md *Compared fields* lists, for every exported item. It prints `no differences`, or one line per difference with kind, id and field (missing item, extra item, text differs), never the text; exit 1 on any (SC-005)

### 2d. Gate wiring (contracts/gate.md)

- [X] T023 [P] In `scripts/scan-privacy.ts`, add a phone-number rule using T013 over `data/cv/` and `dist/cv/` only (Running's pages hold run figures it shouldn't be asked about), and redact every finding in `data/cv/` and `dist/cv/` as `[<n> chars redacted]` whatever the rule, as for story text (contracts/gate.md *Privacy scan*). PDFs aren't scanned here (the `TEXT` filter skips them; T090 reads their text). Update the header comment
- [X] T024 [P] In `scripts/check-links.ts`, check fragments against element ids for links to `/cv/` too (today only `/running/story/`), so a dead `#value-…`, `#change-…`, `#theme-…`, `#role-…`, `#thread-…` or `#next-…` link, or a missing download, fails (contracts/gate.md *Links*); for a link inside a `[data-cv-item]`, the message names `<kind> "<id>"` instead of quoting the link's text. Update the header comment

### 2e. Tests (straight after the code)

- [X] T025 [P] Create `tests/contract/cv-schemas.test.ts`: each `when` form accepted and the malformed ones refused; the approval block's shape; `kind` and `colour` enums; 1 and 8 themes accepted, 0 and 9 refused; `stories` only on `value`; the PDF file names per kind; `approved_on` optional in the export schema; no budget in any schema (T014 owns them)
- [X] T026 [P] Create `tests/unit/cv-hashes.test.ts`: key order, whitespace, NFC and NFD forms of the same text hash alike; an absent optional field hashes as absent, not `null`; a field outside a kind's list (a made-up extra key) doesn't move the hash; each hashed field, changed by one character, does; a PDF's bytes changed by one byte do; CRLF line endings and a YAML comment in the file don't move a parsed item's hash; `Page.listed` doesn't
- [X] T027 [P] Create `tests/unit/cv-dates.test.ts` for `parseWhen`: every form in `data-model.md` *Common fields* **When**; "now" is the end of `as_of`'s month; a month in a year other than `as_of`'s and a start after its end each give an issue with no value in it
- [X] T028 [P] Create `tests/unit/cv-phone.test.ts`: UK mobile and landline forms, `+44` and other international forms, spaced, dotted, hyphenated and bracketed digits, a `tel:` link each match; years, `2013–2016`, `2026-11-25`, `2026-11`, a 64-hex sha256, a 7-hex commit, "123 KB" and "50 changes" don't; two numbers in one text are both found (privacy-pipelines tips: plant each alone, then both)
- [X] T029 Create `tests/contract/cv-store.test.ts` through `tests/helpers/temp-repo.ts` and T021's writer: no `data/cv/` and no `page.yaml` give no CV; a full made-up set loads; an unexpected file, a missing approval, one character changed in each kind's hashed field, and a PDF swapped under the same name are each refused naming file, kind and id
- [X] T030 Create `tests/unit/cv-validate.test.ts` through `tempRepo()`, one test per refused case, **each planted alone**, asserting file, kind, id, rule and severity: every row of quickstart.md §2's table (no approval; text edited after approval; a phone number in a card, a block paragraph, a value story, a role label and `Page.location`; a change without a card; a one-change thread; a card of 281 characters; a `Page.title` of 61 characters; a PDF changed after approval), plus a dangling theme, thread and value story, two pitch blocks and none, a duplicate change id, a month outside `as_of`, two `plain` downloads, and a listed PDF missing (warning only). **Sentinel test**: one made-up sentinel word in every text field of every file, every refused case run through `validateCv`, `CvStore`, `importCv` and `compareCv`, and no message, warning or output line contains it (contracts/content-files.md *Messages*; privacy-pipelines tips)
- [X] T031 [P] Create `tests/unit/import-cv.test.ts` through `tempRepo()` over T020's exports: `typical` imports and loads through `CvStore` with every hash matching; `--dry-run` writes nothing; each refusal of T021 planted alone in a copy of the export (no `approved_on` on one item of each kind, a phone number, an over-budget label, a dangling reference, a one-change thread, a change without a card, a month outside `as_of`, no `sharing_rules_confirmed`, `--rules-checked` a day early) exits 1 naming file, kind, id and reason, and leaves `data/cv/` untouched; a second import with a newer PDF replaces it at the same name; output is counts and file names only
- [X] T032 [P] Create `tests/unit/compare-cv.test.ts` over planted HTML (built by hand with `data-cv-item` and `data-cv-field`): identical text gives `no differences`; extra whitespace and `&amp;` don't count; a changed word, a missing item, an extra item and a missing field are each reported by kind, id and field without text; two inline elements with no space between them count as a difference (testing tips)
- [X] T033 [P] Extend `tests/unit/scan-privacy.test.ts` (a planted phone number in `data/cv/` and in `dist/cv/index.html` is reported with file, line, column and rule, redacted; the same number in a Running page isn't a finding; any other rule's finding in `data/cv/` is redacted) and `tests/unit/check-links.test.ts` (a dead `#change-…` and `#value-…` on `/cv/` fail naming the item; a good one passes; a missing `/cv/<file>.pdf` fails)
- [X] T034 [P] Extend `tests/unit/validate-data.test.ts`: with no `data/cv/` the CV section reports nothing; a planted CV error fails `validateData` alongside Running's issues

### 2f. Ship the slice

- [X] T035 [P] Update `schemas/README.md` (the five CV schemas, what each file holds, that `data/cv/` is written by `import-cv` only) and the header comments of every touched file. No CV wording
- [X] T036 [P] The project skills assume Running's paths: add a short *Another section (the CV)* note to `.claude/skills/owner-data-file/SKILL.md` (the CV's files are imported, never hand-edited: `CV_SCHEMAS`, `CvStore`, `validateCv`, fixtures in `schemas/fixtures/cv/`, `importCv` in place of `approve-story`), `.claude/skills/gate-check/SKILL.md` (the CV's checks live in `validateCv`, the phone rule in `scan-privacy`) and `.claude/skills/tests/SKILL.md` (`tests/helpers/cv.ts`), so later slices' briefs name them
- [X] T037 Run quickstart.md §2 **for real**, not only as unit tests (gate-drill skill), as a one-off drill at `spikes/cv-gate/out/drill.ts` with the copy beside it: `copySite`, `importCv` of `typical` into the copy, `runGate` clean; then, one at a time, hand-edit a card (both `validateData(copyRoot)` and `buildFailure(copyRoot)` stop naming the item's approval, with `snapshotDist` equal before and after), remove an `approved` block, plant a phone number and re-hash the item in the copy (`validate-data` stops it as a phone number, not a hash), and swap a PDF's bytes; restore and see `runGate` pass. Then `--dry-run` and a full import of `typical` into a scratch folder, as quickstart.md §2 shows. Paste the drill's output into the PR. Then the PR routine's suites and the `dist/` comparison (expected byte-identical)
- [X] T038 Raise the PR by the PR routine. *How to view it*: nothing visible; the PR lists the refused cases with their messages and the drill's output

**Checkpoint**: approved CV text can be imported, stored and checked, and nothing else can reach a build.
Nothing is visible.

---

## Phase 3: User Stories 1 and 2 - Reading the CV; the phone drill (slice 2: the page and the phone form, PR 2) (Priority: P1) 🎯 MVP

**Goal**: The whole page over made-up previews: header, pitch, the timeline as the phone drill (themes,
a theme's changes, a change's card; roles, threads and next as lists; breadcrumb and hash routing), the
other blocks, contact; readable without scripts. At every width until slice 3 adds the landscape form.

**Independent Test**: In `/cv-preview/<state>/` at 320, 375 and 768 px: the first screen shows the name,
headline and the start of the pitch; every block in order; any change's card in two taps from the
overview; back control, browser back and Escape each go up one level with focus on the level's heading;
with scripts off every level reads in order with working anchors; no phone number and no joined email
address anywhere in the built page; axe clean in light and dark.

**Goes live**: nothing. A deploy build has no `/cv/` until Phase 8 (T064 proves it).

**How to view it**: screenshots in the PR of `typical`, `stress` and `minimal` at 360 px and on a
desktop, light and dark: the overview; a theme's list (`#theme-<id>`); a card (`#change-<id>`); a
thread's list; and the page with scripts off. Locally: `$env:SHELL_PREVIEW='1'; npm run build; npx
astro preview`, then `http://localhost:4321/cv-preview/typical/` on a phone-sized window (or a phone on
the same network): tap a theme, a change, "Follow this thread", then step back with the back control,
the browser's back button and Escape.

**Needs the owner**: a look at the screenshots, and **confirm Q4 (the email)** (T067).

**Not built yet**: the landscape form, zoom and label placement (slice 3), motion (slice 4), downloads
(slice 5), the share image and the unlisted switch's sitemap and headers (slice 6), real text (slice 7).

### Implementation for User Stories 1 and 2

- [ ] T039 [US1] Fonts (research.md R5, R17): check the npm registry that day for the current `@fontsource/inter-tight` and `@fontsource/space-grotesk` releases (plan.md read 5.3.0 for both) and their maintenance; install the exact current versions; configure them in `astro.config.mjs` through Astro's Fonts API with the local provider as Astro 7.4's documentation describes it that day (Space Grotesk 700, Inter Tight 400 and 600, latin only, generated fallback metrics, Space Grotesk preloaded on `/cv/` only). Record the versions and sizes in `DECISIONS.md`. Expected: no other page's output changes (the PR routine's `dist/` comparison; explain any font file Astro emits regardless)
- [ ] T040 [P] [US1] Create `src/sections/cv/styles/cv.css`, every rule under `.theme-cv` with a `.cv-` prefix (a global stylesheet, not scoped `<style>`: astro tips), starting with the section's tokens (research.md R5): the visual CV's palette and `lane-1` to `lane-8` (`data-model.md` `Theme.colour`) in light, and a dark set under `prefers-color-scheme: dark`; text tokens at WCAG AA on every surface and lane marks at 3:1. Extend `tests/unit/design-tokens.test.ts` to check the CV's tokens layered on the shared ones in both modes
- [ ] T041 [P] [US1] Add the display half of `src/sections/cv/domain/dates.ts`: `whenText(parsed)` exactly as the *Shown as* column of `data-model.md` *Common fields* **When** ("2014", "About 2014", "2013 to 2016", "2013 to now", "October 2026", "February to May 2026", "2025 to March 2026"), a duration in words for the list rows (contracts/timeline-ui.md level 2), and the `datetime` values for `<time>` (two `<time>` elements for a period: ui-accessibility tips)
- [ ] T042 [P] [US1] Create `src/sections/cv/domain/scale.ts`, pure (`data-model.md` *Derived values* **Career scale**; research.md R7): from the earliest `when` start to `Page.as_of`, years linear over the first part and the latest year month by month over the last fifth, continuous across the join; `x(date)` in 0..1 and the axis row's ticks (first year, a middle year, the latest year, its last month; contracts/timeline-ui.md level 1); `domain(from, to)` for zoom (T074). Moved here from slice 3 because the phone overview's strips need it
- [ ] T043 [P] [US1] Create `src/sections/cv/domain/pack.ts`, pure (`data-model.md` *Derived values* **Packing**): changes into the fewest rows without overlap, greedy by start, per theme, with a minimum mark width so dots and short bars never touch at 320 px (spec edge case: several changes in one year and lane). Used by the phone strips, the swimlanes (T071) and the share image (T097)
- [ ] T044 [P] [US2] Create `src/sections/cv/domain/lists.ts`, pure (`data-model.md` *Derived values* **Lists for the drill**): each theme's changes by start then end; roles; each thread's changes in time order; next; and `neighbours(list, id)` for previous and next within the list the reader came from. A thread with fewer than two changes never forms a list (spec edge case)
- [ ] T045 [US1] Create `src/sections/cv/data/cv.ts`: `loadCv(store)`, memoised, returning the page, the blocks (pitch separated out, the rest in file order: `data-model.md` *Text block*), the timeline with each item's parsed `when` and words, the drill's lists, and the downloads; `undefined` when there's no CV
- [ ] T046 [US1] In `src/sections/cv/integration.ts`, inject `{ pattern: '/cv', entrypoint: './src/sections/cv/pages/cv.astro' }` **only when `cvExists()`** (contracts/routes.md); create `src/sections/cv/pages/cv.astro` loading through `loadCv(new CvStore())` and rendering `CvPage`
- [ ] T047 [US1] Create `src/sections/cv/components/CvPage.astro` (props: the loaded CV; `Base` with `theme="theme-cv"`, the shared header and footer, `title` and `description` from `Page.title` and `Page.description`, and until T097 the site's share image (`image="/og/site.png"`, `imageAlt` as `src/pages/index.astro` has it), since `Meta.astro` requires both, imports `../styles/cv.css`) and `CvHeader.astro` (`Page.name` as the `<h1>`, `Page.headline`, `Page.location`) and `CvBlocks.astro`: in order the header, the pitch, the timeline, the other blocks in file order (value stories each `id="value-<story-id>"`), contact, and the downloads' place (slice 5) (FR-002). While `Page.listed` is false, `<meta name="robots" content="noindex">` through `Base`'s `head` slot (FR-004; done now rather than in slice 6 because it costs nothing). The canonical occurrence of each item (its card, block, header or download entry) carries `data-cv-item="<kind>:<id>"` and each compared field `data-cv-field="<field>"` (contracts/content-files.md *Compared fields*); other occurrences carry neither. No "Last updated" anywhere on the page (owner decision 7)
- [ ] T048 [US1] Create `src/sections/cv/components/CvContact.astro` (research.md R11; contracts/routes.md *Contact block*; owner decision 4, provisional): the address in words ("<user> at <domain>") with the parts in `data-user` and `data-domain` (`Page.email_user`, `Page.email_domain`), the joined address never in the HTML; LinkedIn as a link when `Page.linkedin` is set, nothing when it isn't; never a phone number
- [ ] T049 [US1] Create `src/sections/cv/components/ThemeOverview.astro` (contracts/timeline-ui.md level 1; research.md R6): the axis row, then one tile per theme in order (name, "N changes", "N ★" when any, a strip of its packed changes on the career scale, the tile an anchor link to `#theme-<id>`), then under "Also" tiles for roles (a strip of the roles), threads (count and line) and next (count and line). Strips are inline SVG with an accessible name; the star is a shape plus a word (FR-009)
- [ ] T050 [US2] Create `src/sections/cv/components/ThemeList.astro` (contracts/timeline-ui.md level 2): heading with the theme's colour mark, its line and count (`id="theme-<id>"`, `tabindex="-1"`), the axis row, then one row per item oldest first: label, dates in words and duration, "★ Added value", "Thread: <name>" in a theme or the theme's name in a thread, and a one-row bar on the career scale; each row an anchor to its card. The same component renders `#roles`, `#threads` (the threads, each linking to `#thread-<id>`), each `#thread-<id>` and `#next`. Rough dates draw a dashed edge and ongoing bars an arrow (`data-model.md` *Common fields* **When**)
- [ ] T051 [US2] Create `src/sections/cv/components/ItemCard.astro` (contracts/timeline-ui.md level 3; FR-010): the theme, "Role" or "Where next" as a label; the item's label as the heading (`id="change-<id>"`, `role-<id>`, `next-<id>`, `tabindex="-1"`); the details its kind has (FR-010, owner decision 9): a change's dates in words ("About", "to now" in words), lane and thread, a role's dates, a next item none; the axis row and bar (not for a next item); the card text; for a value change, a panel linking to `#value-<story-id>`; for a change in a thread, "Follow this thread"; previous and next within the current list, each naming the item, disabled at the ends (`aria-disabled`, not a dead link). Without scripts, "Follow this thread" links to `#thread-<id>` and each card ends with "Back to themes"; the script (T054) rewrites it to `#change-<id>-in-<thread>`, so every `href` in the HTML resolves for `check-links` (contracts/routes.md *Anchors*)
- [ ] T052 [US2] Create `src/sections/cv/components/Crumbs.astro` (contracts/timeline-ui.md *Where you are*): `<nav aria-label="Where you are in the timeline">` with a back control (44 x 44 px target) and `Themes › <list> › <item>`, the current item truncated with an ellipsis and `aria-current="page"`; sticky under the section heading, clear of the safe-area inset; rendered for the script to fill, hidden without scripts
- [ ] T053 [US1] Create `src/sections/cv/components/Timeline.astro` (`<section id="cv" aria-labelledby>`): the phone form in reading order without scripts (overview, then each list, then each card: contracts/timeline-ui.md *Without scripts*), the crumbs, and a marked place for the landscape container (slice 3). Loads `timeline.client.ts`
- [ ] T054 [US2] Create `src/sections/cv/components/timeline.client.ts` (no library; budget 10 KB gzip for the whole script by its end in slice 4): route on the hash (`#cv`, `#theme-<id>`, `#roles`, `#threads`, `#thread-<id>`, `#next`, `#change-<id>`, `#change-<id>-in-<list>`, `#role-<id>`, `#next-<id>`) showing one level at a time; fill the crumbs; back control, browser back (hash history) and Escape each go up one level; focus moves to the new level's heading, and going back returns focus to the tile or row that led in, scrolled into view (FR-013); previous and next walk the current list; "Follow this thread" opens the same change in its thread, which then shows "Thread · n of N", the thread's strip and "See it in <theme>". Also replace the contact's words with a `mailto:` link built from `data-user` and `data-domain` (owner decision 4, provisional). A timeline-shaped hash with an unknown id shows the overview. The back control and Escape go to the parent level (a change's theme list, or its thread for `-in-<thread>`; `#roles` for a role; `#next` for a next item; `#cv` for a list). They use `history.back()` only when the script pushed the current entry from that parent; otherwise they replace the current entry with the parent's hash, so a card opened from a shared link never leaves the page. Hashes that aren't the timeline's (`#main`, `#value-<id>`, any id outside `#cv`) are left to the browser: no level change, no focus move. Nothing is stored and nothing is sent (`data-model.md` *State*)
- [ ] T055 [US1] Add the phone form's layout to `src/sections/cv/styles/cv.css`: one column below 768 px, tiles in two columns from 768 to 1023 px (owner decision 1); `overflow-wrap: anywhere` on free text and no sideways scroll at 320 px; text blocks at `max-width: 66ch`; the value star and threads distinguishable without colour, and in forced colours (`CanvasText` bars, `Highlight` selection, borders on boxes drawn by background: contracts/timeline-ui.md *Forced colours*); focus visible on every tile, row and control; target sizes per WCAG 2.2
- [ ] T056 [US1] Add the previews (preview-state skill): `tests/fixtures/cv-preview/generate.ts` (deterministic; runs T021's `importCv` with `--root` over each of T020's exports, so previews go through the real import, writing `tests/fixtures/cv-preview/data/<state>/data/cv/`; output committed), `tests/fixtures/cv-preview/store.ts` (one `CvStore` per state, `PREVIEW_STATES` as a `const` tuple, no `import.meta.glob`), and `tests/fixtures/cv-preview/[state].astro` (`getStaticPaths` over the states, the real `CvPage`). In `astro.config.mjs`'s `shellPreview`, inject `{ pattern: '/cv-preview/[state]', entrypoint: './tests/fixtures/cv-preview/[state].astro' }` and add it to the comment
- [ ] T057 [P] [US1] Extend `scripts/process/screenshots.ts` with a per-path `,nojs` option (JavaScript disabled for that shot) and check that a path with a `#hash` is shot after the script has routed to it (one shot per drill level); update `.claude/skills/pr-screenshots/SKILL.md` to match

### Tests for User Stories 1 and 2 (straight after the code)

- [ ] T058 [P] [US1] Unit tests: extend `tests/unit/cv-dates.test.ts` for `whenText`, durations and `datetime` values for every form; create `tests/unit/cv-scale.test.ts` (scale and packing: the join across the magnified year is continuous, a bar crossing it is unbroken, `as_of` in January, December and mid-year, a single-change CV, fewest rows, no two marks in a row overlap at the minimum width) and `tests/unit/cv-lists.test.ts` (orders, `neighbours` at the ends, a one-change thread forms no list)
- [ ] T059 [P] [US1] Create `tests/unit/cv-page.test.ts` with the Astro container API over each preview state's loaded CV: blocks in FR-002's order with the pitch before the timeline wherever it sits in the file; every anchor of contracts/routes.md *Anchors* present once; every `href="#…"` resolves to an id on the page; every text field carries `data-cv-item` and `data-cv-field`; no phone pattern in the HTML (T013); the joined email address absent and its words present; LinkedIn absent without `Page.linkedin`; `noindex` with `listed: false` and absent with `true` (`unlisted-off`); one `h1`; `<b>` and `&` in text escaped; no "Last updated"; the axis's last tick shows `Page.as_of`'s month in words on the overview and the swimlanes (Principle V; owner, 2026-11-25)
- [ ] T060 [P] [US1] Add to `tests/unit/cv-validate.test.ts`: every preview state in `PREVIEW_STATES` passes `validateCv` and `CvStore` with no errors, and `generate.ts` is deterministic (its output equals the committed files)
- [ ] T061 [US2] Create `tests/e2e/cv-phone.spec.ts` (page-tests skill; quickstart.md §3) over `/cv-preview/<state>/`, in the `mobile-360` project at 320, 375 and 768 px: the first screen shows the name, headline and the start of the pitch (US1 scenario 1); the overview shows every theme, roles, threads and next; a tile leads to its list and a row to its card, any card in two taps (SC-007); the crumbs appear from the list on and name where you are; the back control, `page.goBack()` and Escape each go up one level, focus on the level's heading, and coming back out focus returns to the tile or row; previous and next walk the list and stop at the ends; "Follow this thread" then walks the thread; a value change's panel reaches `#value-<id>`; a shared `#change-<id>` link opens that card directly, and its back control and Escape go to its theme's list without leaving the page; following a value panel to `#value-<id>` leaves focus on the value story; two columns of tiles at 768 px; no sideways scroll and no two boxes overlapping at 320 px in any state (ui-accessibility tips: every state). Scope locators to `#cv`; `exact: true` on names
- [ ] T062 [US1] Create `tests/e2e/cv-noscript.spec.ts` (`javaScriptEnabled: false`; FR-014, SC-006): every level renders in reading order; every tile, row, "Back to themes" and "Follow this thread" anchor lands on an existing id; every card's text is readable; the email reads in words with no `mailto:`; the page makes no request outside its own origin (also with scripts on)
- [ ] T063 [P] [US1] Create `tests/a11y/cv.spec.ts` with `tests/helpers/a11y.ts`: zero axe violations at every drill level of `typical` and `stress`, light and dark, and forced colours on the phone project; heading outline; the crumbs' `nav` named; a Tab sweep reaches every link and control of each level with each focused element fully in view (page-tests skill)
- [ ] T064 [US1] Create `tests/e2e/cv-none.spec.ts`, the "nothing before the content PR" drill (gate-drill skill; pinned to the desktop project, timeout 240 s): a deploy build of a copy of the real site, with `data/cv/` removed from the copy so it still holds after Phase 8: no `dist/cv/`, `/cv/` answers with the 404 page, no `/cv/` in the sitemap, no link to `/cv/` on any page, `validateData(copyRoot)` reports nothing for the CV
- [ ] T065 [US1] Create `tests/e2e/cv-launch.spec.ts`, the launch drill (gate-drill skill; desktop project, 240 s per build): a copy of the real site with `data/cv/` replaced by `importCv` of `typical` (FR-021): `runGate` passes; `/cv/` is built and `compareCv` against the export prints no differences (SC-005, run for real); `checkLinks` passes; the built page has `noindex`; then a hand-edited card stops `validateData` and the build naming the item with `dist/` intact (SC-004), and a phone number planted in a card and re-hashed in the copy is stopped by `validate-data`, and, placed straight into the built HTML, by `scan-privacy` redacted. Print what it measured for the PR

### Ship the slice

- [ ] T066 [US1] Run the PR routine's suites (`SHELL_PREVIEW=1` build, both Playwright projects for the new specs), look at phone-width and desktop screenshots of every state and level in light and dark and with scripts off, and compare `dist/` against `main` (expected byte-identical in a deploy build)
- [ ] T067 [US1] (owner, guided by the agent) **Show-and-confirm Q4, the email (plan.md open question 4, provisional).** In this slice's PR, show the contact block of `typical` with scripts on (a `mailto:` link) and off (the address in words) at 360 px and on a desktop, light and dark (T057's `,nojs`), with the local steps to try both (the page as above; then the browser's settings to turn JavaScript off for `localhost`). Checkbox: "Keep: the address in words without scripts, a link with them, never the joined address in the HTML. *Recommended: keep.*" If the owner changes it (e.g. a plain `mailto:` link always), make the change on this branch before it merges: `CvContact.astro`, `timeline.client.ts`, T059 and T062's assertions, FR-003's wording if it's affected (with the owner's yes), and fresh screenshots. Record the pick in `DECISIONS.md`
- [ ] T068 [US1] (owner, guided by the agent) Raise the PR by the PR routine with the phase header's *How to view it* and the screenshots. The owner looks at them in the PR review. Nothing is visible on the live site

**Checkpoint**: the whole CV reads on a phone and without scripts, any change two taps away, in previews
only.

---

## Phase 4: User Story 2 - Exploring the timeline (slice 3: the landscape form, PR 3) (Priority: P2)

**Goal**: From 1024 px the visual CV's swimlanes, labelled where labels fit, as the first level, with the
drill's cards beneath; threads that light and dim; zoom by role.

**Independent Test**: In `typical` and `stress` at 1024, 1440 and 1920 px: every change, role and next
item is in the picture; no two labels, or a label and a mark, overlap; a label without room shows on hover
and focus; Tab enters at the first item, arrows move in time and between lanes, Enter opens the card
beneath with focus on it, Escape closes it with focus back on its mark; a thread lights and dims and
steps; a role zooms to its years and "Whole career" and Escape zoom out. At 320 to 1023 px the phone form
is unchanged.

**Goes live**: nothing.

**How to view it**: screenshots in the PR of `typical` and `stress` on a desktop (1280 and 1920 px),
light and dark: the whole picture; a label shown on hover (T076); a card open beneath; a thread followed;
a role zoomed. At 360 px, to show the phone form is unchanged. Locally: as in Phase 3, then
`http://localhost:4321/cv-preview/typical/` in a desktop window at least 1024 px wide: hover or Tab to a
mark with no label, choose a role and "Zoom to these years", then "Whole career".

**Needs the owner**: a look at the screenshots, and **confirm Q2 (zoom) and Q3 (labels)** (T082, T083).

**Not built yet**: motion (slice 4), downloads (slice 5), the share image (slice 6), real text (slice 7).

### Implementation for User Story 2

- [ ] T069 [US2] Create `scripts/gen-cv-metrics.ts` (and its npm script `gen-cv-metrics`), writing `src/sections/cv/domain/metrics.json`: advance widths per character for Inter Tight 400 and 600 at the swimlanes' label size, from the installed font files (research.md R7). If no existing dependency reads font tables, measure the same characters in Playwright's Chromium with the fonts loaded (no new dependency), and record which in `DECISIONS.md`. Committed; regenerated when the fonts update. Header comment says when to run it
- [ ] T070 [P] [US2] Create `src/sections/cv/domain/labels.ts`, pure (`data-model.md` *Derived values* **Label placement**; owner decision 3, provisional): for each change, the first row in its lane where the label's estimated width (from `metrics.json`, deliberately wide) fits before the next occupied span; otherwise "no room". Placement for the whole career and, computed at build, for each role's zoomed domain (contracts/timeline-ui.md *Zoom*)
- [ ] T071 [US2] Create `src/sections/cv/components/Swimlanes.astro` (research.md R7; contracts/timeline-ui.md *The landscape form*): one SVG built at build: the axis (years, the latest year month by month, joined), roles across the top as bars with labels, a lane per theme with its name, changes as bars or dots in T043's packed rows, "next" at the right. Value changes carry the star shape and "(adds value)" in their accessible names; rough dates a dashed edge; ongoing bars an arrow. Each change, role and next item is an `<a href="#change-<id>">` (and so on) with an accessible name of label, dates and theme, and `data-label-room="false"` with a tooltip text element where T070 found no room. Per-role zoom positions as data attributes, so the script never measures layout
- [ ] T072 [US2] In `src/sections/cv/components/Timeline.astro`, render `Swimlanes` once inside a landscape container shown from 1024 px, with the drill's lists and cards beneath it, and the phone overview hidden from 1024 px (contracts/timeline-ui.md *Widths*); both forms work without scripts. Measure the built HTML of `stress` against the 150 KB gzip page budget (the SVG is sent at every width: research.md R7) and record it in the PR
- [ ] T073 [US2] Extend `src/sections/cv/components/timeline.client.ts` for the landscape form (FR-011, FR-013; contracts/timeline-ui.md): activating a mark shows its card beneath the picture in the same `ItemCard` with the same crumbs, focus on the card's heading, and Escape or the close control returns focus to the mark; Tab enters the picture at its first item, left and right move in time order, up and down between lanes, Enter opens; "Follow this thread" lights the thread's marks, dims the rest to 20%, shows previous and next, and "Done" or Escape ends it; a label with no room shows on hover and focus. **Escape steps out one thing at a time**: an open card, then a followed thread, then a zoom (contracts/timeline-ui.md)
- [ ] T074 [US2] Zoom by role (research.md R8; owner decision 2, provisional): a role's card offers "Zoom to these years"; the x-axis then spans the role (T042's `domain`), marks and labels take the role's build-time positions (T070), the latest year's months stay magnified if inside; "Whole career" and Escape zoom out. On the phone form a role is a list like the others and there's no zoom (FR-012 is landscape-only)
- [ ] T075 [US2] Add the landscape form to `src/sections/cv/styles/cv.css`: lane colours from the tokens with the lane names always shown, thread dimming, the tooltip, the open card beneath, focus rings on SVG links; forced colours: lanes told apart by their names and order, value by the star, threads by the thread panel's text, bars in `CanvasText`, the selection in `Highlight` (contracts/timeline-ui.md *Forced colours*)
- [ ] T076 [P] [US2] Extend `scripts/process/screenshots.ts` with per-path `,hover=<selector>`, `,focus=<selector>` and `,click=<selector>` options (applied in order before the shot), so a label on hover, a card open and a zoomed view can be shown to the owner; update `.claude/skills/pr-screenshots/SKILL.md`

### Tests for User Story 2 (straight after the code)

- [ ] T077 [P] [US2] Create `tests/unit/cv-labels.test.ts` (labels fit or get "no room", never overlapping a mark or another label in the estimate; placement per role's domain; a label at its 72-character budget) and add to `tests/unit/cv-page.test.ts` the swimlanes' markup: every change, role and next item is a link to an existing anchor with an accessible name; value marks say "(adds value)"; rough and ongoing marks carry their edge and arrow; no-room labels carry their tooltip text
- [ ] T078 [US2] Create `tests/e2e/cv-landscape.spec.ts` (quickstart.md §4) in the desktop project at 1024, 1440 and 1920 px over `typical` and `stress`: every item in the picture; a label without room appears on hover and on focus; the keyboard path (Tab in, arrows in time and between lanes, Enter, Escape with focus back on the mark); a thread lights its marks, dims the rest and steps through them; a role zooms (its first and last mark span the width) and "Whole career" and Escape zoom out; the Escape order of T073; at 1023 px the phone form shows and the SVG is hidden
- [ ] T079 [US2] Create `tests/e2e/cv.spec.ts` with the cross-form overlap check (SC-003): for every preview state at 320, 375, 768, 1024, 1440 and 1920 px, no two visible label or mark boxes overlap (text measured by text-node ranges, testing and ui-accessibility tips), no sideways scroll, and no hidden label widening the page. Assert the geometry, not pixel counts, so CI's Linux fonts can't flip it
- [ ] T080 [P] [US2] Extend `tests/a11y/cv.spec.ts` to the landscape form: axe clean in light and dark with a card open, a thread followed and a role zoomed; forced colours keep lanes, value and threads distinguishable; the SVG's links have names (`toHaveAccessibleName`)

### Ship the slice

- [ ] T081 [US2] Run the PR routine's suites, look at the screenshots of every state at 1024, 1280 and 1920 px and at 360 px in light and dark, and compare `dist/` against `main` (expected byte-identical)
- [ ] T082 [US2] (owner, guided by the agent) **Show-and-confirm Q2, zoom by role (plan.md open question 2, provisional).** In this slice's PR, show `typical` on a desktop before and after zooming into a role (T076's `,click=`), light and dark, and at 360 px to show the phone form has no zoom, with the local steps (a desktop window from 1024 px wide; choose a role, "Zoom to these years", then "Whole career" or Escape). Checkbox: "Keep zoom by role, reached from the role's card ('Zoom to these years'): one step more than the plan's question described. *Recommended: keep; no new text to approve.*" If the owner changes it (e.g. zoom by a named era, which would be new approved text from the career record), make the change on this branch before it merges, or, if it needs new approved data, agree with him whether it holds this slice or follows as its own PR; update research.md R8 and contracts/timeline-ui.md *Zoom*, the tests and the screenshots. Record the pick in `DECISIONS.md`
- [ ] T083 [US2] (owner, guided by the agent) **Show-and-confirm Q3, landscape labels (plan.md open question 3, provisional).** In this slice's PR, show `typical` and `stress` on a desktop at 1280 and 1920 px with labels where they fit, and a label without room shown on hover and on focus (T076's `,hover=` and `,focus=`), light and dark, with the local steps (hover over or Tab to an unlabelled mark). Checkbox: "Keep labels where they fit, the rest on hover, focus and the card. *Recommended: keep.*" If he changes it (e.g. no labels, or every label on its own row), make the change on this branch before it merges (T070, T071, T077 to T079, fresh screenshots) and record the pick in `DECISIONS.md`
- [ ] T084 [US2] (owner, guided by the agent) Raise the PR by the PR routine with the phase header's *How to view it*. The owner looks at the screenshots in the PR review. Nothing is visible on the live site

**Checkpoint**: the timeline is explorable on every width, by touch, mouse and keyboard, in previews.

---

## Phase 5: User Story 3 - The timeline draws itself (slice 4: motion, PR 4) (Priority: P3)

**Goal**: The draw-in on first view on both forms, the level slides and the card, thread and zoom
transitions, a skip on any input, and no movement at all with reduced motion.

**Independent Test**: In `typical`, the timeline draws itself within 3 s of entering the viewport; a tap,
scroll past or key press mid-way shows the finished picture at once; with reduced motion, no animation
runs, no transition is longer than 0 s and every drill still works.

**Goes live**: nothing.

**How to view it**: motion doesn't show in screenshots, so the PR gives the local steps: build and preview
as in Phase 3, open `http://localhost:4321/cv-preview/typical/`, scroll down to the timeline (desktop
window from 1024 px, then a phone-sized one), tap mid-way to skip, then turn on the system's reduced-motion
setting and reload. The PR also gives the measured settle times from T087.

**Needs the owner**: a look, locally, if he wants one (offered in the PR).

### Implementation for User Story 3

- [ ] T085 [US3] Add the motion to `src/sections/cv/styles/cv.css` (research.md R10; contracts/timeline-ui.md *Motion*): the finished picture is the resting state; a class the script adds starts the draw-in: landscape a `clip-path` sweep left to right over 2.5 s with labels fading in behind it; phone each tile's strip growing left to right, staggered, 1.5 s in all; level changes slide 24 px and fade over 0.2 s (backwards the other way); card, thread and zoom 0.3 s. All of it inside `@media (prefers-reduced-motion: no-preference)`
- [ ] T086 [US3] Extend `src/sections/cv/components/timeline.client.ts`: start the draw-in the first time the timeline enters the viewport (`IntersectionObserver`), once per page view, only when motion is allowed; any pointer down, wheel, key press or scroll past the timeline ends it at once (FR-015); with `prefers-reduced-motion: reduce` the script starts nothing and changes drill states without transitions (FR-016). Check the script's size against the 10 KB gzip budget and record it in the PR

### Tests for User Story 3 (straight after the code)

- [ ] T087 [US3] Extend `tests/e2e/cv.spec.ts` (quickstart.md §5) on both forms: the draw-in's animations all finish within 3 s of the timeline entering the viewport (read from the animations' end times, SC-002); a pointer down mid-way leaves no running animation; it plays once per page view; with `reducedMotion: 'reduce'` no animation runs, every computed transition duration is 0 s, and the drill and zoom still work; with scripts off the finished picture shows. Print the settle times for the PR

### Ship the slice

- [ ] T088 [US3] (owner, guided by the agent) Run the PR routine's suites, compare `dist/` against `main` (expected byte-identical), and raise the PR by the PR routine with the phase header's *How to view it* and the measured times. Nothing is visible on the live site

**Checkpoint**: the timeline unfolds once, skippably, and never moves for a reader who asked it not to.

---

## Phase 6: User Story 4 - Downloading the CV (slice 5: downloads, PR 5) (Priority: P4)

**Goal**: The plain and visual PDFs served at `/cv/<file>`, each with its title, size and "Last updated"
date; the build refusing a PDF with a phone number in its text or metadata; a missing PDF hidden with a
warning.

**Independent Test**: In `typical`, each PDF downloads under its file name and the page shows its approval
date; a phone number planted in a PDF's text or metadata fails validation naming the file; a swapped PDF
fails its approval; replacing a PDF with a newer approved one keeps the link and updates the date; a
missing PDF hides its download and warns.

**Goes live**: nothing.

**How to view it**: screenshots in the PR of `typical`'s downloads block (and `minimal`, which has none)
at 360 px and on a desktop, light and dark. Locally: as in Phase 3, then
`http://localhost:4321/cv-preview/typical/`, scroll to the downloads and open each made-up PDF.

**Needs the owner**: a look at the screenshots, and **confirm Q7 ("Last updated")** (T095).

### Implementation for User Story 4

- [ ] T089 [US4] Check the npm registry that day for `unpdf`'s current release, maintenance and open issues (research.md R9 read 2.2.2 on 2026-11-23); install the exact current version and record it in `DECISIONS.md`
- [ ] T090 [US4] Add the PDF check to `src/sections/cv/validate.ts` (FR-019; research.md R9; contracts/gate.md *PDFs*): for each listed PDF, extract the text and the document metadata with `unpdf` and apply T013's patterns to both, an error naming the file and "phone number" (never the match); an unreadable PDF is an error; a missing one stays a warning (T016). Use the same check in `scripts/import-cv.ts` for the export's PDFs (T021's refusal list)
- [ ] T091 [US4] Create `src/sections/cv/pages/download.ts`: a static endpoint with `getStaticPaths` over the downloads present in `data/cv/downloads/`, serving each at `/cv/<file>` with `Content-Type: application/pdf` (contracts/routes.md); inject `{ pattern: '/cv/[file]', entrypoint: './src/sections/cv/pages/download.ts' }` in `src/sections/cv/integration.ts` beside `/cv` only when `cvExists()`. A listed PDF that's missing gets no route
- [ ] T092 [US4] Create `src/sections/cv/components/CvDownloads.astro` (contracts/routes.md *Downloads block*; FR-018; owner decision 7, provisional): for each present PDF, `Download.title` as the link text, "PDF", its size in KB and "Last updated <d Mon yyyy>" from `Download.approved`'s date; a kind with no file left out; no block at all when there's none. Render it in `CvPage.astro` after the contact block. "Last updated" appears nowhere else on the page
- [ ] T093 [P] [US4] Make the made-up PDFs of T020 carry real extractable text (headings and paragraphs of lorem words, one hyphenated word across a line end) so the extraction check means something; regenerate T020 and T056's outputs and check `git diff --stat` shows only the PDFs and their hashes
- [ ] T094 [US4] Tests: create `tests/unit/cv-pdf.test.ts` (T019's `minimalPdf`: a phone number in the text, in the title metadata and in the author metadata each fail naming the file without the number; an unreadable file fails; a clean PDF passes; `unpdf` extracts the plain PDF's headings as written, quickstart.md §6); add to `tests/e2e/cv.spec.ts`, creating it if absent (each download in `typical` answers 200 with `application/pdf`, its file name and its date as shown; `minimal` has no downloads block); add to `tests/e2e/cv-launch.spec.ts` (a newer approved PDF imported over the old one keeps `/cv/<file>` and shows the new date, FR-020; a listed PDF removed from the copy hides its download, `validateData` warns, and `checkLinks` still passes; a PDF with a planted phone number stops `validate-data`)

### Ship the slice

- [ ] T095 [US4] (owner, guided by the agent) **Show-and-confirm Q7, "Last updated" (plan.md open question 7, provisional).** In this slice's PR, show `typical`'s downloads block with its two "Last updated" dates, and the page's header and blocks without any date, at 360 px and on a desktop, light and dark, with the local steps. Checkbox: "Keep 'Last updated' only beside the downloads. *Recommended: keep; a date on the page would invite 'is this current?'*" (Principle V is met by the axis's `as_of` month, agreed 2026-11-25; a pick that removes it needs a constitution amendment) If he changes it (e.g. a date under the header too), make the change on this branch before it merges (`CvPage.astro` or `CvHeader.astro` with the date from `Page.as_of`, T059's "no Last updated" assertion, fresh screenshots), and record the pick in `DECISIONS.md`
- [ ] T096 [US4] (owner, guided by the agent) Run the PR routine's suites, compare `dist/` against `main` (expected byte-identical), and raise the PR by the PR routine with the phase header's *How to view it* and the screenshots. Nothing is visible on the live site

**Checkpoint**: every user story the repository builds is built and tested on made-up text.

---

## Phase 7: Polish & Cross-Cutting Concerns (slice 6: polish and graduation, PR 6)

**Purpose**: The share image, the unlisted switch, print, Lighthouse, the last quality bars, the
adversarial review and the design note: the feature graduates on made-up text.

**Goes live**: nothing.

**How to view it**: the PR gives the share image of `typical` (rendered PNG), the Lighthouse and axe
results, the unlisted test's results both ways, and the review's findings.

**Needs the owner**: no (PR review only).

- [ ] T097 [P] Create `src/sections/cv/og/cv.png.ts` with `ogEndpoint` (research.md R12; FR-005): `Page.title` and the theme strips drawn as on the phone overview (T043's packing), no other words, in the section's palette, with the fonts' WOFF files from the `@fontsource` packages (satori can't read WOFF2); inject `/og/cv.png` in `src/sections/cv/integration.ts` when `cvExists()`, and pass `image={ogPath('/cv/')}` and an `imageAlt` from `Page.title` in `CvPage.astro` (replacing T047's interim image). Add a preview share image for `/cv-preview/[state]` in `shellPreview`. Look at the rendered PNG before trusting it (share-images tips). Extend `tests/unit/og.test.ts`
- [ ] T098 The unlisted switch (research.md R14; contracts/routes.md *Unlisted*; FR-004): `cvSettings()` in `src/sections/cv/integration.ts` reads `Page.listed` from files at config time; the sitemap integration's `filter` in `astro.config.mjs` drops `/cv/` and `/cv/*.pdf` while it's false; an `astro:build:done` hook appends to `dist/_headers` (creating it if absent, never overwriting what the build copied from `public/`) `X-Robots-Tag: noindex` for `/cv/*.pdf` while it's false. First read Cloudflare's documentation that day to confirm that Workers static assets with a Worker main script (`wrangler.jsonc`) apply a `_headers` file in the assets directory to asset responses, and that the file itself isn't served, and record it in `DECISIONS.md`; if they don't, raise it with the owner before building an alternative. `listed: true` reverses all of it; the top-level navigation is untouched here (contracts/routes.md: "CV" joins it in the PR that sets `listed: true`, T118)
- [ ] T099 [P] Tests for the switch: create `tests/unit/cv-unlisted.test.ts` (quickstart.md §7) for the pure parts (the sitemap filter and the headers text, both ways); add to `tests/e2e/cv-launch.spec.ts` a build of the copy each way: with `listed: false` the page has `noindex`, `dist/_headers` holds the PDFs' `X-Robots-Tag`, the sitemap lacks `/cv/` and no page links to it; with `listed: true` (`unlisted-off`'s export) none of those
- [ ] T100 [P] Print (spec edge case; contracts/timeline-ui.md *Print*): print rules in `src/sections/cv/styles/cv.css`: the no-script order (overview, lists, cards) with the landscape SVG on the first page, crumbs and controls hidden, and a line pointing to the PDFs (rendered only when downloads exist); add a check under `page.emulateMedia({ media: 'print' })` to `tests/e2e/cv.spec.ts`
- [ ] T101 Add `{ type: 'cv', path: () => '/cv/' }` to `PAGE_TYPES` in `scripts/lighthouse-budget.mjs` (skipped until the page exists, so the nightly Quality run checks the real page from launch). Run `node scripts/lighthouse-budget.mjs --path=/cv-preview/typical/ --path=/cv-preview/stress/` on a `SHELL_PREVIEW=1` build (quickstart.md §7). Expected: performance 90 or more, accessibility 100, LCP within 2.5 s, same-origin JS within 10 KB gzip, the page within 150 KB gzip, no third-party request (SC-001, SC-006, FR-025's no-request part). Record the figures in the PR
- [ ] T102 [P] Check the last quality bars across every preview state: axe clean in light, dark and forced colours at every level and with a card, thread and zoom open; no sideways scroll at 320 px; the keyboard reaches every link and control on both forms; all content with scripts off; `git diff origin/main --stat -- src/shared` is empty and `npm run check-boundaries` passes (Principle VII)
- [ ] T103 Run the graduation self-review (constitution *Review at graduation*; plan.md *Graduation plan*) as an adversarial pass over the whole feature, recording findings with evidence in the PR and fixing what it finds: can any build path (the store, `validate-data`, a plain `astro build`, a preview, `import-cv`) render or write text that isn't approved or has changed; can any message, warning or log line from the store, `validate-data`, the build, `import-cv`, `compare-cv`, `check-links` or `scan-privacy` quote CV text; can a phone number reach the page, a PDF's text or metadata, or the share image; can the joined email address appear in the HTML; can `/cv/` or a PDF exist before `data/cv/page.yaml`, or be indexed, linked or in the sitemap while unlisted; can a shared `#change-…` link break after a re-import; can the page make a third-party request; does a reader with reduced motion see any movement
- [ ] T104 [P] Create `src/sections/cv/README.md`, the graduation design note (docs tips), with no CV wording: the files and what each holds, the export and `import-cv` (with `--rules-checked` and the sharing rules' re-confirmation, FR-023), per-item approval hashes and what each covers, `compare-cv` and where its output goes, the two forms and their anchors, motion and reduced motion, downloads and replacing a PDF, the unlisted switch, the previews and drills, the checks and their messages, and what changes when the owner wants the page fully public. Note that drafts and the export stay outside the repository
- [ ] T105 Run every scenario in `specs/004-interactive-cv/quickstart.md` that can run on made-up text (§1 to §7) and add a *Result* line to each, correcting any command or path that differs from what was run
- [ ] T106 Raise the PR by the PR routine. After the merge, write Phase 8 into `PROJECT_MEMORY.md`'s *Next session*: the content PR is a session with the owner (T107–T117), gated on his re-confirming the sharing rules and approving the set in the private career record; the export's location outside the repository; then offer `/speckit-house-process-harvest-lessons` in the main conversation for the *Upstream candidates* gathered since the last harvest

**Checkpoint**: the feature has graduated on made-up text. Only the real content remains.

---

## Phase 8: User Story 5 - Publishing approved text (slice 7: the content PR, PR 7, with the owner) (Priority: P5)

**Purpose**: The real CV comes in, exactly as approved, through `import-cv`, and goes live at `/cv/`,
still unlisted.

**Gate**: **no task in this phase starts until T107 and T108 are done.** Until then nothing real enters
the repository (FR-023).

**Privacy**: the export, the sharing rules and the owner's approvals stay outside the repository (their
location is in `PROJECT_MEMORY.md`'s *Next session*). Only the imported, approved files enter it. The PR
body and commit messages describe the content by shape only (counts, files).

**Goes live**: `/cv/` (unlisted: `noindex`, out of the sitemap and menus), `/cv/alexander-webber-cv.pdf`,
`/cv/alexander-webber-cv-visual.pdf` (each with `X-Robots-Tag: noindex`) and `/og/cv.png`.

**How to view it**: https://alexanderwebber.com/cv/ on a phone and a desktop, once deployed: the header
and pitch on the first screen; the themes, a theme, a change's card and "Follow this thread" on the
phone; the swimlanes, a label on hover, a card, a thread and a role's zoom on the desktop; the blocks,
contact and both downloads. Share the link in a messaging app to see the preview. **Not built**: the
listed switch (the page stays unlisted until the owner wants it public, T118), use counts (outside this
repository).

**Needs the owner**: **yes**: the sharing rules and the approval before the PR, then a guided review
after launch.

- [ ] T107 [US5] (owner, guided by the agent) **Re-confirm the sharing rules (FR-023)**, in the private career record, outside this repository: the agent shows the owner his current rules, asks a focused question round on anything that has changed, and the date of his re-confirmation is recorded there, so the export carries it as `page.sharing_rules_confirmed`; the date (only) goes into `PROJECT_MEMORY.md`'s *Next session* for T110
- [ ] T108 [US5] (owner, guided by the agent) **Approve the set in the private career record**: the blocks, themes, threads, roles, changes, next items and one card per change, role and next item, within their budgets (owner decision 5), and the plain and visual PDFs without a phone number. The career record's own script then produces the export and the PDFs into a local folder outside every repository (contracts/content-files.md *The career record's export*); that folder's location goes into `PROJECT_MEMORY.md`'s *Next session*, never its contents
- [ ] T109 [US5] Check the approved text against the sharing rules, item by item, outside the repository (FR-023, US5 scenario 3). Anything that doesn't pass goes back to the owner in the career record, for a fresh approval and a fresh export; nothing is edited on the way in. The PR body (T115) says the check was done and how many items it covered, never what they say
- [ ] T110 [US5] Import (quickstart.md §8): `node scripts/import-cv.ts --from=<export> --rules-checked=<date of T107> --dry-run`, then without `--dry-run`, writing `data/cv/` (FR-021). Normalise line endings first (`core.autocrlf`). A refusal goes back to the owner as T109 does; the import is never forced
- [ ] T111 [US5] Build (deploy build) and run `node scripts/compare-cv.ts --from=<export>`: expected `no differences` (SC-005, US5 scenario 2). Its summary (counts and "no differences", no text) goes in the PR
- [ ] T112 [US5] Capture the owner's edits made while approving in `VOICE.md` (FR-024; Principle VIII): style lessons only (phrasing, tone, structure, what he changed and why, in general terms), no private facts, no quotes from drafts, no names. Read it in full and search it for private terms before committing
- [ ] T113 [US5] Run the full gate locally on the real files (`validate-data`, `scan-images`, `check-boundaries`, `build`, `check-links`, `scan-privacy`), then `/pr-ready --suites` (Vitest doesn't run in CI for a `data/`-only change), the e2e and a11y suites and both drills (`cv-none` removes `data/cv/` itself; `cv-launch` replaces it), Lighthouse on `/cv/` (`node scripts/lighthouse-budget.mjs --path=/cv/`) and axe on the real page in light and dark. If a privacy rule trips on approved wording, stop: the owner rewords it under a fresh approval
- [ ] T114 [US5] Privacy pass before the PR: read every new and changed file in full; search the repository, the branch's diff and its commit messages for anything from the export that isn't in the imported files, and for the private terms (`/pr-ready`); write the PR body by shape only (counts per kind, files, the comparison's summary). Update `README.md`'s pages table with a CV row described by structure
- [ ] T115 [US5] (owner, guided by the agent) Raise the PR by the PR routine, with the phase header's *How to view it*. Checkbox questions: anything still open from T109; and confirmation that the text may go public (it stays in git history even if later removed)
- [ ] T116 [US1] After the merge, wait for `main`'s Gate run to finish, deploy included (`/after-merge`), then the live checks (quickstart.md §8 step 5): `/cv/` answers 200 with every block, theme and card; `noindex` on the page; `curl.exe -sI https://alexanderwebber.com/cv/alexander-webber-cv.pdf` shows `X-Robots-Tag: noindex` (and the visual PDF too); `/cv/` isn't in the sitemap or linked from any page; `/og/cv.png` loads; the page makes no third-party request; no sideways scroll at 320 px; the email isn't in the HTML as a joined address. Update `PROJECT_MEMORY.md` (*Next session*: the next session starts with a guided review of the live page and a question round) and `DECISIONS.md`
- [ ] T117 [US1] (owner, guided by the agent) At the next session start, a short guided review of the live page on a phone and a desktop, light and dark, and a question round on what the owner saw, including SC-007 (any change's "why" in two taps or fewer from the first screen). Fix anything raised in a small PR by the PR routine; any text change goes back through the career record and `import-cv`

**Checkpoint**: the CV is live at its address, exactly as approved, unlisted.

---

## Standing follow-ups (triggered by an event; nothing above depends on them)

**Purpose**: Each has a trigger. The agent checks them at session start from `PROJECT_MEMORY.md`'s
*Next session* block (written by T106 and T116), and raises each at a review the owner is already
doing, never as a chore.

- [ ] T118 (owner, guided by the agent) **Going fully public**, when the owner says so: one PR setting `listed: true` through the career record's export and `import-cv` (the setting isn't hashed, `data-model.md` `Page.listed`, but every CV change comes through the import), adding "CV" to the site's top-level navigation and a link from the home page (contracts/routes.md *Unlisted*), with the PR routine and the unlisted test's `listed: true` half as the proof; after the merge, the live checks of T116 reversed (indexable, in the sitemap, PDFs without `X-Robots-Tag`)
- [ ] T119 [US4] **A new approved version of either PDF, or changed text** (FR-020, FR-021): whenever the owner approves one in the career record, re-run T108's export, T109's check against the sharing rules (and T107 if the rules changed since `page.sharing_rules_confirmed`), T110 to T116, and extend `VOICE.md` from his edits. The link stays the same; the download's date updates

---

## Traceability

| Requirement or criterion | Tasks |
|---|---|
| FR-001 | T018, T046, T064 |
| FR-002 | T045, T047, T059 |
| FR-003 | T048, T054, T059, T062, T067, T116 |
| FR-004 | T047, T098, T099, T116, T118 |
| FR-005 | T047, T097 |
| FR-006 | T039, T040, T047 |
| FR-007, FR-008 | T042, T043, T049–T055, T061, T071, T072 |
| FR-009 | T049, T050, T071, T075 |
| FR-010 | T041, T051, T073 |
| FR-011 | T044, T054, T073, T078 |
| FR-012 | T042, T070, T074, T078, T082 |
| FR-013 | T054, T061, T063, T073, T078 |
| FR-014 | T051, T053, T062 |
| FR-015, FR-016, FR-017 | T085–T087 |
| FR-018 | T091, T092, T094 |
| FR-019 | T011, T015, T090, T094 |
| FR-020 | T007, T021, T094, T119 |
| FR-021 | T021, T022, T065, T110, T111, T119 |
| FR-022 | T013–T016, T023, T030, T037, T065 |
| FR-023 | T020, T021, T107, T109, T110 |
| FR-024 | T112, T119 |
| FR-025 | Outside this repository (Notes); no third-party request: T062, T101, T116 |
| SC-001 | T101, T113 |
| SC-002 | T087 |
| SC-003 | T043, T061, T078, T079 |
| SC-004 | T029, T030, T037, T065, T094 |
| SC-005 | T022, T032, T065, T111 |
| SC-006 | T062, T101 |
| SC-007 | T061, T117 |

| Contract or guide | Tasks |
|---|---|
| contracts/content-files.md: files, hashed fields, messages, sentinel | T004–T011, T015, T030 |
| contracts/content-files.md: export, `import-cv`, `compare-cv` | T008, T019–T022, T031, T032 |
| contracts/gate.md | T016, T017, T018, T023, T024, T033, T034, T037, T090 |
| contracts/routes.md: routes, head, anchors, contact, downloads | T046–T048, T051, T091, T092, T097 |
| contracts/routes.md: unlisted | T047, T098, T099 |
| contracts/routes.md: previews | T056 |
| contracts/timeline-ui.md: the drill | T049–T055, T061–T063 |
| contracts/timeline-ui.md: the landscape form, threads, zoom | T069–T075, T077–T080 |
| contracts/timeline-ui.md: motion | T085–T087 |
| contracts/timeline-ui.md: forced colours, print | T055, T075, T100 |
| quickstart.md §1–§2 | T025–T034, T037 |
| quickstart.md §3 | T059–T063 |
| quickstart.md §4 | T077–T080 |
| quickstart.md §5 | T087 |
| quickstart.md §6 | T094 |
| quickstart.md §7 | T097–T101, T105 |
| quickstart.md §8 | T107–T117 |

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** and **Phase 2 (Foundational)**: one PR (slice 1). BLOCK every other phase.
- **Phase 3 (US1, US2 phone; slice 2)**: depends on Phase 2 (store, hashes, import, export fixtures).
- **Phase 4 (US2 landscape; slice 3)**: depends on Phase 3 (scale, packing, cards, the script, previews).
- **Phase 5 (US3; slice 4)**: depends on Phases 3 and 4 (both forms to animate).
- **Phase 6 (US4; slice 5)**: depends on Phase 3 (the page and previews). Independent of Phases 4 and 5.
- **Phase 7 (Polish; slice 6)**: depends on Phases 3 to 6.
- **Phase 8 (US5 content; slice 7)**: depends on Phases 1 to 7, **and on the owner's T107 and T108**.
- **Standing follow-ups**: after Phase 8.

### User story dependencies

- **US1 (P1)**: after Phase 2. The MVP: the page and the phone form.
- **US2 (P2)**: the phone drill comes with US1 in slice 2; the landscape form after it.
- **US3 (P3)**: after US1 and US2's forms.
- **US4 (P4)**: after US1's page.
- **US5 (P5)**: its checks are Phase 2's; its live run is Phase 8, after everything else.
- **US6 (P6)**: outside this repository.

### Within each phase

- Code first, then its tests (TDD isn't required).
- T001 before any schema task; T009 and T010 in one commit.
- T011 (hashes) and T013 (phone) before T015, T016, T021.
- T019 and T020 before T021's tests (T031) and T056.
- T042 and T043 before T049; T044 before T050 and T054.
- T046 before T064 and T065.
- T069 before T070; T070 before T071.
- T091 before T094's e2e checks.

### Parallel opportunities

- **Phase 1**: T001, T002 and T003 together.
- **Phase 2**: T004 to T008 together; T011 to T014 together; T023 and T024 beside T015 to T022; T025 to
  T028 and T031 to T034 together once the code exists; T035 and T036 any time.
- **Phase 3**: T040 to T044 together; T057 any time; T058, T059, T060 and T063 together after the code.
- **Phase 4**: T070 beside T069's script; T076 any time; T077 and T080 together.
- **Phase 6**: T093 beside T090 to T092.
- **Phase 7**: T097, T099, T100, T102 and T104 alongside each other.
- **Across phases**: Phase 6 (downloads) can run beside Phases 4 and 5, except for `CvPage.astro`,
  `integration.ts` and `tests/e2e/cv.spec.ts`: merge one before starting the other's edits there.

---

## Parallel Example: Phase 2

```text
# Schemas together:
Task: "Create schemas/cv/page.schema.json"
Task: "Create schemas/cv/blocks.schema.json"
Task: "Create schemas/cv/timeline.schema.json"
Task: "Create schemas/cv/downloads.schema.json"
Task: "Create schemas/cv/export.schema.json"

# Pure domain functions together:
Task: "Canonical JSON and item hashes in src/sections/cv/domain/hashes.ts"
Task: "parseWhen in src/sections/cv/domain/dates.ts"
Task: "Phone patterns in src/sections/cv/domain/phone.ts"
Task: "Budgets in src/sections/cv/domain/budgets.ts"
```

## Parallel Example: User Stories 1 and 2 (slice 2)

```text
Task: "Section tokens in src/sections/cv/styles/cv.css and tests/unit/design-tokens.test.ts"
Task: "whenText in src/sections/cv/domain/dates.ts"
Task: "Career scale in src/sections/cv/domain/scale.ts"
Task: "Packing in src/sections/cv/domain/pack.ts"
Task: "Drill lists in src/sections/cv/domain/lists.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1, slice 2)

1. Slice 1 (Phases 1 and 2): files and checks; nothing visible.
2. Slice 2 (Phase 3): the whole CV on a phone and without scripts, in previews. **Stop and review the
   screenshots, and settle Q4.** This is a complete CV at every width, the landscape form aside.

### Incremental delivery

Each slice is one PR and one session, and each leaves the live site unchanged until slice 7.

1. Slice 1 → approvals, import, compare and checks, invisible.
2. Slice 2 → US1 and the phone drill, in previews (Q4).
3. Slice 3 → US2's landscape form, threads and zoom (Q2, Q3).
4. Slice 4 → US3's motion.
5. Slice 5 → US4's downloads (Q7).
6. Slice 6 → share image, unlisted switch, print, Lighthouse, the adversarial review, the design note.
7. Slice 7 → the content PR with the owner, gated on the sharing rules and his approval, then the
   guided review.

---

## Notes

- Tasks marked [P] touch different files, with no dependency on an incomplete task.
- Every fixture, preview, PDF and test uses generated words. No real CV text, PDF, employer, role or date
  enters the repository before Phase 8, and then only through `import-cv` from the approved export.
- No message, log or scan output may quote CV text; the sentinel test (T030) holds it.
- **US6 (use counts) lives in the owner's private tooling**, outside this repository (plan.md *Summary*,
  research.md R13); nothing here builds or depends on it.
- The paper CVs' pointer to `/cv/` (with its QR code) is made in the private career record once the page
  is live (spec *Assumptions*); nothing here changes for it.
- On a commit from PowerShell, avoid piping a here-string to `git commit -F -` (it adds a BOM). Write
  files containing backslashes with the Write tool, not a Bash heredoc.
