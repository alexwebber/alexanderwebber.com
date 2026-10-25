# Maintainability review (2026-10-25)

A read-only review of the Running section after its eight build slices (BACKLOG, *Maintainability
review and refactor*). The earlier reviews (T110, T147) checked correctness, speed, accessibility,
privacy and SEO. This one checks simplicity: drift between phases, duplication, dead code, Running
details in shared code, the ingest package, the tests and the docs.

**How it was done:** every source file was read or skimmed, with knip (TypeScript) and vulture
(Python) run for dead code. pytest, Vitest and Playwright were timed locally, and CI job durations
were read from the last 30 Tests runs. Nothing was changed.

Findings are ranked by payoff against risk. Each refactor is its own small PR, with no change
visitors can see and no change to published data. The existing tests and the gate are the safety
net.

## Owner picks and order

The owner picked **all ten** (2026-10-25). Finding 7 was added once a before/after computed-style
check removed its risk. The work is small PRs, one concern each, over four sessions:

1. **Tests first**, so every later PR runs the faster Playwright job: 5 (Playwright), 10 (archive
   test), then 9 (dead code).
2. **Storage out of shared:** 1, as two PRs (the store, then validate-data).
3. **Simplify the section:** 2 (page-by-page shims), then 3 (loaders).
4. **Tidy-ups:** 4 (distances), 6 (number formatting), 7 (goal-card CSS, with the computed-style
   check), 8 (remove `backfill`).

For every PR: the built `dist/` is diffed against `main`'s, and any difference is explained.
Published data doesn't change. All checks must be green before the PR is called ready.

## Findings

### 1. Running's storage layer lives in `src/shared/` (Principle VII)

**What:** `src/shared/storage/` is entirely Running's:

- **The store:** `RunningStore`, `OwnerData` and `JsonFileStore`.
- **The file map:** `load.ts` maps every `data/running/` path to its schema.
- **The schema list:** `SCHEMA_NAMES` lists Running's 13 schemas, and `gen-types` writes their
  types under `src/shared/`.

The boundary check passes only because it checks imports, not content. Smaller leaks:

- `shared/format/parse.ts` holds race distances (`DISTANCES_M`, `parseDistance`).
- `units.ts` holds `formatPace`.
- `XYChart` defaults to the Running token `--running-series`.
- `scripts/validate-data.ts` is all Running referential checks.

CV & Blog would have to edit all of these to add its own data.

**Fix:**

- **Shared keeps the generic machinery:** `SchemaSet` (given the schema names), `toIssues`,
  `DataIssue`/`DataValidationError`, the YAML 1.2 and JSON parsing, and the file listing.
- **Running gets its own `data/store/`:** the interface, `JsonFileStore`, the file map and the
  generated types.
- **Running owns its rules:** distances and pace formatting move into Running's domain. The
  referential checks move to `src/sections/running/validate.ts`, and `validate-data.ts` becomes a
  runner over each section's validator.
- **Docs follow:** `contracts/storage.md` and `src/shared/README.md` are amended to match.

**Payoff:** high. This is the coupling CV & Blog would hit first, and it is cheapest to fix while
there is one section.

**Risk:** medium. About 58 files change their imports, mostly type-only. It is mechanical, and
`astro check`, Vitest and the gate catch every miss. Two PRs: the store, then validate-data.

### 2. Phase-by-phase shipping code is still there

**What:** these existed so an increment never linked to an unbuilt page (FR-027). Every area has
shipped, so they now only add branches:

- **`shippedAreas()`** just returns `runningAreas`.
- **`links.ts` `runHref`/`raceHref`** return `string | undefined` "until run pages ship", scanning
  the route registry on every call.
- **Callers:** 14 files call these, mostly to handle the `undefined`. `src/pages/index.astro` and
  `404.astro` link to Running "once its landing page ships".

**Fix:** export `runningAreas` and drop `shippedAreas()`. The link helpers return a string, and the
dead branches go. A future section or area still joins the registry only when it ships.

**Payoff:** medium. Simpler components, and fewer "what if this is undefined" paths to reason
about.

**Risk:** low. The built HTML should be byte-identical (checked by diffing `dist/`).

### 3. The data loaders drifted between phases

**What:**

- **Three caching patterns:**
  - Goals, health and races take a store and cache per store and day.
  - Landing and training use the global store, cache per day, and need `clearLandingCache()` and
    `clearTrainingCache()` in tests.
  - `load.ts` resets its own settings and freshness caches.
- **Section defaults in three places:** the schema, `SECTION_DEFAULTS`, and validate-data's
  `DEFAULT_FEATURED_GOAL_LIMIT`. `goals.ts` and `races.ts` read
  `owner.section?.recent_highlight_days?.… ?? SECTION_DEFAULTS…` instead of `sectionSettings()`,
  and ajv already fills the schema defaults whenever `section.yaml` exists.

**Fix:** one small memo helper (per store and day) used by every loader, with every loader taking
a store. Defaults get one source: the schema's, applied to an empty `section.yaml` when the file is
absent. The `clear…Cache` functions go.

**Payoff:** medium. One way to add the next loader, and the test-only previews can use any of
them.

**Risk:** low. Unit tests cover every loader.

### 4. Race distances are defined in four places across two languages

**What:**

- `schemas/defs.schema.json` (the enum)
- `shared/format/parse.ts` (`DISTANCES_M`)
- `ingest/src/awingest/distances.py` (`DISTANCES_M`)
- `domain/manual-metrics.ts` (`PREDICTION_DISTANCES`), plus `goal-text.ts`'s display labels

No test keeps the TypeScript and Python tables in step. `distances.py`'s `parse_time` is unused.

**Fix:** one `schemas/distances.json` (name → metres), read by both languages, with a test that the
schema enum matches it. Delete `parse_time`.

**Payoff:** low to medium. Distances rarely change, but a silent mismatch would put a best effort
under the wrong name.

**Risk:** low.

### 5. Playwright repeats its most expensive work in both browser projects

**What:** the PR job averages 4 min 16 s (about 5 billed minutes), almost all of it `npm run
e2e`. Timed locally, the suite takes about 650 s of worker time (175 s wall time on 4 workers;
CI's 2-core runner has much less parallelism).

- **axe sweeps:** the full sweeps take about 370 s of that. The health page is opened in every
  range, then with every data table open (about 250 KB of HTML), in light and dark, over the real
  page and the preview. The training and races pages get the same treatment. Each sweep runs in
  both the phone and desktop projects. axe's rules (contrast, names, roles) don't change with the
  viewport, which the layout tests already cover.
- **The stale-data drill** (`tests/e2e/stale.spec.ts`) copies the repo, runs the gate and builds
  the copy in its `beforeAll`, about 45–70 s. Playwright runs that once per project, so every run
  builds it twice. It checks built HTML and gate results, which don't depend on the viewport.
- **Copied helpers:** the four a11y specs each define the same `axe`, `outline` and `WCAG`
  helpers.

**Fix:**

- **Sweeps:** run the full axe sweeps in the phone project only (mobile first). Desktop keeps one
  axe run per page in its default state.
- **Drill:** run it in the desktop project only, as `goals.spec.ts` already does for its build
  test.
- **Helpers:** move them to `tests/helpers/a11y.ts`.

**Payoff:** medium. About 45% less worker time. That's an estimated 2 billed minutes off each PR
that touches the site, and faster feedback.

**Risk:** low. Every check still runs, just not twice. The nightly Quality run's Lighthouse
accessibility audits stay as they are.

### 6. Numbers are formatted by hand in six places

**What:** `src/shared/README.md` says pages format through `shared/format`, "never ad hoc", but:

- `FitnessChart`, `LabComparison`, `goal-text.ts` and `run-detail.ts` each build their own
  `Intl.NumberFormat`.
- Four components define their own axis "km" label, two with `toFixed`.

`units.ts` already has the helper, but it's private.

**Fix:** export `formatNumber(value, decimals)` and one axis-label helper, then use them.

**Payoff:** low to medium. One place to change number style.

**Risk:** low. The output stays the same (checked by diffing `dist/`).

### 7. The two goal cards share half their CSS

**What:** `GoalCard.astro` and `AchievedGoalCard.astro` each define the card shell, header, title,
description and facts grid. Three pages each repeat the `.breadcrumb` rule.

**Fix:** a shared `styles/goal-card.css` for the common rules, and `.breadcrumb` in the section
theme.

**Payoff:** low to medium. A style change to goal cards is made once.

**Risk:** medium. There are no visual-regression tests, so the check is a diff of the built CSS
plus a look on a phone and a desktop.

### 8. The `backfill` command has been superseded

**What:** `awingest backfill` (196 lines plus 134 of tests) was the local, whole-history fetch.
Since the full Garmin import was dropped (2026-10-23), every re-import has used `refresh.yml`'s
`reimport_from`/`reimport_to` windows, which also cover rebuilding a lost archive.

**Fix:** remove it and point the quickstart and the ingest README at the re-import windows.

**Payoff:** low to medium. Less code to keep working.

**Risk:** low. Your call: it is a second recovery path, but nothing uses it now.

### 9. Small dead code

**What:**

- **Unused functions:** `weightAverage` (composition.ts) and `hasData` (goals.ts) are never
  called.
- **A trivial wrapper:** `bodyFatAverage` just calls `trailingMean`.
- **Needless exports:** 17 exports are used only inside their own file.

**Fix:** delete the unused functions and the wrapper, and unexport the in-file helpers.

**Payoff:** low.

**Risk:** very low.

### 10. A slow archive test

**What:** `test_listing_5000_objects` writes 5,000 objects to each of two backends: 38.5 s of
pytest's 80 s locally. It only needs to cross S3's 1,000-key page to test pagination. CI bills
the 44 s pytest job as 1 minute either way, so this saves only local time.

**Fix:** use 1,001 objects.

**Payoff:** low (local runs only).

**Risk:** very low.

## Checked and fine

- **Docs:** every file named in the Running, shared and schemas READMEs exists, and every Running
  component is described. The deprecated `hr_zones` schema branch is already gone. There are no
  TODOs or FIXMEs.
- **Ingest:** the package is cleanly split:
  - fetch, process and publish stages;
  - one error hierarchy (`IngestError`);
  - pure normalisers;
  - one writer.
- **Domain code:** pure, dated by a `today` argument, and documented.
- **Share images:** the endpoints are small and explicit; merging them would hide more than it
  saves.
- **Workflows:** `refresh.yml`, the gate action and the Worker are long, but every step carries
  its reason. Nothing to simplify.
- **Out of scope:** `spikes/` belongs to the public-readiness sweep, not this review.
