# Running section

A self-contained section (constitution Principle VII): it owns its pages, components, data
store, validation and share images, and uses only `src/shared/` (layout, design system, charts,
formatting and the generic storage machinery).
`integration.ts` injects the routes of each shipped area; `astro.config.mjs` is the one line that
adds the section to the site.

This is the section's graduation design note (T110, for the MVP: Goals and the landing page;
extended for Training and run detail, US3, Races and PBs, US4, and Health, US5).
The contracts it builds on are [routes](../../../specs/001-running-section/contracts/routes.md),
[data files](../../../specs/001-running-section/contracts/data-files.md) and
[pipeline](../../../specs/001-running-section/contracts/pipeline.md) (freshness endpoint). The
shared plumbing's note is [`src/shared/README.md`](../../shared/README.md).

## Contract

- **Input:** only the store (`RunningStore` over `data/running/`): published runs and health
  series, the owner's YAML (goals, upcoming races, races, run overrides, manual Garmin metrics,
  lab results, `section.yaml`) and `refresh.json`. No page calls a third-party API (Principle III).
- **Output:** static pages and share images, built for one Europe/London "today". The pages
  are `/running/`, `/running/goals/`, `/running/training/`, `/running/training/<year>/`,
  `/running/runs/<id>/`, `/running/races/`, `/running/races/<slug>/` (plus each mapped race's
  `route.json`) and `/running/health/`; the share images are `/og/running.png`,
  `/og/running-goals.png`, `/og/running-training.png`, `/og/running-races.png`,
  `/og/running-health.png`, one per race
  (`/og/running-races-<slug>.png`), and the shared `/og/running-year.png` and
  `/og/running-run.png`.
- **Figures mean what the owner's Garmin Connect means** (owner review, 2026-10-23):
  - **Best efforts** use timer time (watch pauses left out); races use the official time.
  - **Weight and body fat** are 7-day averages throughout a card.
  - **Garmin's predictions** are "at current fitness", dated, not race-day forecasts.
  - **Race targets** read "sub-3:20" and count only a time under 3:20:00 to the second.
  - **Unreached targets** never show as beaten or as 100%.
  - **Heart-rate zones** are Garmin's own five, read from the watch's original FIT file, with
    Garmin's names and bpm ranges (owner, 2026-10-24). Time below zone 1 is left out, as on
    Garmin Connect's chart; time above the top boundary counts in zone 5.
  - **Health headlines** for body fat, resting HR and HRV are 7-day averages, labelled so; each
    reading is a faint dot under the average line. Weight is only ever its 7-day average.
  - **Fitness, fatigue and form** are intervals.icu's model, never called Garmin's training load,
    and their chart starts 42 days after intervals.icu's history does.
  - **Training totals** count treadmill runs; average pace is distance-weighted; a period's
    elevation is the sum of the runs that recorded it, else "Not recorded".
- **Goal logic is pure** (`domain/`): every function takes "today" as an argument, so tests pin
  dates without a clock.

## Failure behaviour

- **Bad owner data stops the build, not the site.** `integration.ts` validates everything in
  `astro:build:start`, before Astro empties `dist/`, so the deploy keeps the last good build.
  The error names the file, entry and field (FR-070).
- **Missing data renders as "no data yet",** never as zeros. Examples: a goal with no effort, the
  training build before the first run, a page before `section.yaml` exists. On a run page each
  panel (charts, zones, splits, best efforts, dynamics) and each figure is left out when the
  watch didn't record it (FR-048).
- **Stale data says so.** "Last updated" and the stale notice are decided at build time, then
  corrected by the freshness script. If `/running/api/freshness` fails, the build-time text
  stays (FR-005/006/074). The SC-003 drill (`tests/e2e/stale.spec.ts`) builds a scratch copy of
  the site with 7-day-old freshness and checks the gate passes, every Running page carries the
  notice in its HTML, and a 503 or no JS keeps the build-time text.
- **A missing page is the site's own 404** (`src/pages/404.astro`, served with a 404 status by
  `not_found_handling` in `wrangler.jsonc`), with links home and to Running. A run the owner hides
  (`run-overrides.yaml`) or a mistyped address lands there, not on a blank page.
- **Day-based text follows the UK date.** The 00:17 UTC refresh deploys daily (T105), and
  `Countdown` corrects the day count in the browser.
- **Without JavaScript** every figure, chart table and goal is still there. JS only refreshes
  "Last updated" and the countdown. The week/month/year, all runs/races only and
  distance/time switches are CSS (`:has()` over native radios, shared `Toggle`).

## Tests and budgets

- **Vitest** (`tests/unit/`, `tests/contract/`): goal evaluation and card text (`goals.test.ts`,
  `goal-cards.test.ts`), races, weeks, periods, manual metrics, attribution, the landing,
  training, run and health pages rendered with only `Date` faked (`landing.test.ts`,
  `training.test.ts`, `run-detail.test.ts`, `health.test.ts`), data validation and the schemas.
- **Playwright** (`tests/e2e/`, `tests/a11y/`): each page at 360 px and on desktop, axe (WCAG 2.2
  AA) in light and dark, heading order, and the keyboard path through every link and control.
- **Lighthouse** (`scripts/lighthouse-budget.mjs`, also local on Windows): at graduation every
  built page scored 100 for performance and accessibility on mobile. The landing LCP was
  1.06 s, the largest page 11.2 KB gzip, with no script files and no third-party requests. The
  health page (2026-10-24) scored 100 and 100, LCP 1.21 s, 54.1 KB gzip: its data tables hold
  every reading and the all-time charts every point, so it is the heaviest page and grows by
  roughly 40 KB gzip per year of data. It meets the 150 KB budget for about two more years; before
  then the tables (or the all-time charts) need bounding, e.g. weekly rows past a year.
- **Gate:** the site build, `validate-data`, `check-boundaries`, `scan-images` and
  `scan-privacy`, on every push and every bot commit.
- **Final graduation review (T147, 2026-10-25), the whole section:**
  - **Lighthouse (mobile, local, deploy build):** every page type scored 100 for performance and
    accessibility, with no script files and no third-party requests. HTML+CSS+JS gzip and LCP:
    site home 2.3 KB (0.91 s), landing 11.6 KB (1.06 s), goals 6.6 KB, training 16.0 KB, a year
    page 7.5 KB, a run page 14.2 KB, races 5.6 KB (each 0.90-0.91 s), health 45.7 KB (1.05 s).
    There is no real race page yet; the race preview pages scored 100 at 25-26 KB with the 1.6 KB
    map loader (LCP 1.21 s), and the health preview 100 at 80.6 KB (its synthetic data is denser).
  - **axe (WCAG 2.2 AA tags) on every built page**, not one per type: 216 pages (the deploy pages
    plus the test previews), with every data table open, at 360 px in light and dark and on
    desktop in light: 648 checks, 0 violations. No page logged a console error or a failed request.
  - **SEO:** all 207 deploy pages have a unique title and description, a canonical URL on the
    domain and a share image that exists in `dist/`.
  - **Privacy:** `scan-privacy` 0 findings on the deploy build (CI also checks the R2 run-ID map).
  - **Found and fixed:** a blank 404 on the live site (now the 404 page above), and the health
    keyboard test still expecting "All time" after #59 (it now walks the ranges on offer).

- **Scale (SC-011, T124):** `tests/fixtures/generate-runs.ts` writes 5,000 synthetic runs (every
  series at the 600-point cap) into a scratch copy of the repo, never this one. On 2026-10-24:
  build 48 s for 5,019 pages, 5,032 deployed files (limit 20,000); Lighthouse 100 on the hub
  (LCP 1.15 s, 34.5 KB gzip), a year page (LCP 0.90 s) and a run page (LCP 1.06 s, 19.5 KB).

## Known limits

- **Share images are built daily.** Messaging apps cache them, so a shared link can show an
  older day count.
- **Share previews and the screen-reader pass** were the owner's checks at go-live (T111,
  2026-10-24), and both were fine. The fuller hallway test (T148) was skipped: the phase-by-phase
  live reviews on phone and desktop covered it.
- **Training runs share one share image** (`/og/running-run.png`), by design: a per-run image
  would add a file per run for little gain.
- **The health page grows** by roughly 40 KB gzip a year (see the budgets above); bounding its
  tables is in `BACKLOG.md`.

- `components/SectionLayout.astro`: the layout for every Running page. Shared `Base` in the warm
  Running theme (`styles/theme.css`), the section nav from the route registry, the page heading,
  Garmin attribution (below) and "Last updated".
- `components/LastUpdated.astro`: FR-005/006. It shows the build-time value from `refresh.json`,
  then fetches the live one from `/running/api/freshness`.
- `data/store/`: Running's store (contracts/storage.md). `running-store.ts` is the `RunningStore`
  interface, `json-file-store.ts` implements it over `data/running/`, `files.ts` maps each file
  to its schema and loads it, and `schemas.ts` lists the schemas (`RUNNING_SCHEMAS`), whose types
  `scripts/gen-types.ts` writes into `generated/` (gitignored).
- `validate.ts`: the referential checks of contracts/data-files.md on top of the schemas.
  `scripts/validate-data.ts` runs it in the gate.
- `data/load.ts`: the only way Running code reads data (`runningStore()`, `sectionSettings()`,
  `buildFreshness()`), memoised per build. `data/goals.ts` (`loadGoals()`) evaluates every goal
  for today from it.
- `domain/`: pure functions, unit-tested with "today" passed in. `distances.ts` (the named race
  distances, from `schemas/distances.json`, which ingest reads too), `pace.ts` (`formatPace`),
  `efforts.ts` (the Best Effort index), `composition.ts` (body fat's build-time 7-day mean), `manual-metrics.ts` (the owner's
  Garmin training status and race predictions, latest per distance), `goals.ts` (goal status and
  progress, data-model §5) and `goal-text.ts` (the words and figures cards show).
- `links.ts`: links to another area (e.g. a run page) only once that area has shipped.
- Goals (US2): `pages/goals.astro` at `/running/goals/`, `components/GoalCard.astro`,
  `AchievedGoalCard.astro` and `AsOf.astro`, and the share image `og/goals.png.ts`.
- Landing (US1): `pages/index.astro` at `/running/`, fed by `data/landing.ts` (`loadLanding()`).
  `components/Hero.astro` (focus race, `Countdown.astro`, target, Garmin prediction, charity, a
  reserved `fundraising` slot that nothing fills yet, and `TrainingBuild.astro`), the featured
  goals as compact `GoalCard`/`AchievedGoalCard`s (lead card full width on wide screens),
  `ThisWeek.astro`, `RunCard.astro`, `StoryLink.astro` and `SectionLinks.astro`. Share image:
  `og/landing.ts` (`/og/running.png`, "N days to Brighton"). Domain: `domain/races.ts` (the
  upcoming-race state machine, days remaining, target labels) and `domain/weeks.ts` (this week,
  the training build, the latest run).
- Training (US3): `pages/training.astro` at `/running/training/` and `pages/training/[year].astro`,
  fed by `data/training.ts` (`loadTraining()`): `PeriodTotals.astro` (week/month/year columns and
  all-time totals, `domain/periods.ts`), `RunList.astro` (by month, all runs or races only) and
  `YearLinks.astro`. Share images `og/training.png.ts` and the shared `og/year.png.ts`.
- Run pages: `pages/runs/[id].astro` (in the Training area since US3) with `RunSummary`,
  `RunSeriesCharts` (shared `XYChart`, against distance or elapsed time), `HrZones`,
  `SplitsTable`, `RunBestEfforts`, `RunDynamics` and `TreadmillBadge`; their figures come from
  `domain/run-detail.ts`. One shared share image, `og/run.png.ts` (`/og/running-run.png`).
- Races (US4): `pages/races.astro` at `/running/races/` and `pages/races/[slug].astro`, both thin
  wrappers round `RacesPage.astro` (`UpcomingRaces`, `PBTable`, `RaceHistory`) and
  `RacePage.astro` (the result, `RaceMap`, the run detail components above, `PhotoGallery`), fed
  by `data/races.ts` (`loadRaces(today, store)`) over `domain/races.ts` (`raceHistory()`) and
  `domain/pbs.ts`. The PB table's any-run efforts come from the goals' Best Effort index
  (`domain/efforts.ts`), so PBs and race-time goals follow one set of rules. `RaceMap` is a
  build-time SVG (`domain/race-map.ts`) with MapLibre and OpenFreeMap tiles loaded only on a click
  (the one JS-budget exception); photos come from `data/photos.ts` through `astro:assets`.
  Share images `og/races.png.ts` and `og/race.ts`.
- Health (US5): `pages/health.astro` at `/running/health/`, a thin wrapper round
  `HealthPage.astro`, fed by `data/health.ts` (`loadHealth(today, store)`) over
  `domain/health.ts` (ranges, daily readings and their 7-day average, targets from the goals, lab
  comparisons within 7 days, the HRV start note, fitness/fatigue/form). Charts are
  `MetricTrendChart` (shared `LineChart` + `RangeToggle`, opening on 1 year, with target lines and
  diamond lab markers), `FitnessChart` (fitness and fatigue, then form on its own axis) and
  `HrvChart`; `MetricNow` holds each headline, `LabComparison` the lab-against-Garmin lines,
  `RacePredictions` the four distances beside their goals (a trend per distance once there are two
  dated entries) and `TrainingStatus` the latest status and its history. Share image
  `og/health.png.ts` (generic words, no figures). Owner exclusions are removed by the processor,
  before publishing.
- **Health preview (tests only):** with `SHELL_PREVIEW=1`, `/health-preview/` renders the same
  `HealthPage` over `tests/fixtures/health-preview/` (synthetic series, lab results, several dated
  manual entries and an HRV baseline band; `generate.ts` writes them), because the owner has no lab
  results yet and only one dated entry of each manual figure.
- **Race preview (tests only):** with `SHELL_PREVIEW=1`, `/race-preview/` renders the same
  `RacesPage` and `RacePage` over the synthetic races in `tests/fixtures/race-preview/`
  (`generate.ts` writes them), so race pages, maps and photos are tested before there is a real
  race. Deploy builds never include it.
- **Heart-rate zones** are Garmin's on every published run since the refresh after #53 (T159);
  the run schema's transitional old-zone shape was removed in #54.
- Dates: pages are built for today in Europe/London. The 00:17 UTC refresh run deploys every day
  (T105), so countdowns and "New" badges follow the UK date; `Countdown` corrects the day count
  in the browser.
- `integration.ts` also validates all Running data when a build starts, so bad owner data stops
  the build before Astro empties `dist/` (US2.7).

## Garmin attribution (FR-077, T152)

A condition of the intervals.icu API terms (effective 2025-10-23): every view of Garmin-sourced
data follows Garmin's API brand guidelines.

**Source:** the Garmin Developer API Brand Guidelines, V 6.30.2025:

- <https://developer.garmin.com/brand-guidelines/api-brand-guidelines/>
- <https://developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf>

They were first read on 2026-10-17 through published excerpts, because the cloud sandbox can't
reach developer.garmin.com. The PDF itself (still V 6.30.2025, one page) was read in full at
go-live (T112, 2026-10-24) and matches what follows; nothing changed.

**What the guidelines ask:**

- **Wording:** "Garmin [device model]" on every use of Garmin device-sourced data. That covers
  dashboards, activity feeds, overview cards and summary views, and also detailed views, reports
  and historical views. When the device model isn't known, Garmin is listed as the source.
- **Derived data:** use wording like "Insights derived in part from Garmin device-sourced data",
  never a made-up "Garmin … model".
- **Form:** either the Garmin tag logo followed by the device, or appropriately sized text.
- **Placement:** title level, directly beneath or next to the primary heading of the data view.
  Exported images (charts, social images) carry it too.

**How this section follows them** (`components/GarminAttribution.astro`):

- **Text only:** "Source: Garmin" or "Source: Garmin <device>", and for intervals.icu's
  fitness/fatigue/form, "Derived in part from Garmin device-sourced data". There is no logo, so
  there are no brand assets in the repo.
- **Which device** (owner decision, 2026-10-18):
  - **Runs** carry the watch that recorded them (published `device`, from intervals.icu's
    `device_name`), so a run page names its own watch (`device={run.device}`).
  - **Multi-run views** name each watch in view, newest first (`device={runDevices(runs)}`,
    `domain/attribution.ts`). With more than three watches they fall back to plain "Garmin".
  - **Weight and body fat** name the scale from `section.yaml` `garmin_devices.scale`
    (`<GarminAttribution scale />`).
  - **Watch wellness** (VO2 max, HRV, resting HR) and the manual figures say plain "Garmin",
    because no per-day device is recorded.
  - **The HRM 600 strap** isn't named, because the recording device is the watch.
- **Under every page heading:** each page that shows Garmin data passes `garmin` to
  `SectionLayout`, which puts the attribution directly under the `<h1>`.
- **On every chart, tile and card:** each one showing Garmin data also carries it at its own
  heading. Charts use `ChartFigure`'s `source` slot, which puts it right under the chart title.
- **In share images:** a share image showing Garmin data passes `attribution` to the OG renderer
  (a race's card does when its time is the watch's; an official or hand-entered time isn't Garmin
  data).
- **Races:** the races page names the watches behind the PB table and history at each heading;
  a race page names its watch under the `<h1>` and at the route map (the GPS is the watch's). A
  hand-entered race shows no Garmin attribution. The interactive map also carries
  OpenFreeMap/OpenMapTiles/OpenStreetMap attribution.
- **Manual figures:** the owner's manual Garmin figures (training status, race predictions) are
  attributed the same way.
- **Health:** plain "Source: Garmin" under the heading, because the page mixes the scale, the
  watch's wellness and the manual figures; each chart then names its own source (the scale for
  weight and body fat, plain "Garmin" for VO2 max, resting HR and HRV, and "Derived in part from
  Garmin device-sourced data" for fitness/fatigue/form). The lab comparisons name the device side
  the same way.

The story e2e specs (T095, T109, T123, T137, T144) assert it on each page.
