# Running section

A self-contained section (constitution Principle VII): it owns its pages, components, data
loader and share images, and uses only `src/shared/` (layout, design system, charts, storage).
`integration.ts` injects the routes of each shipped area; `astro.config.mjs` is the one line that
adds the section to the site.

This is the section's graduation design note (T110, for the MVP: Goals and the landing page).
The contracts it builds on are [routes](../../../specs/001-running-section/contracts/routes.md),
[data files](../../../specs/001-running-section/contracts/data-files.md) and
[pipeline](../../../specs/001-running-section/contracts/pipeline.md) (freshness endpoint). The
shared plumbing's note is [`src/shared/README.md`](../../shared/README.md).

## Contract

- **Input:** only the store (`RunningStore` over `data/running/`): published runs and health
  series, the owner's YAML (goals, upcoming races, races, run overrides, manual Garmin metrics,
  `section.yaml`) and `refresh.json`. No page calls a third-party API (Principle III).
- **Output:** static pages and share images, built for one Europe/London "today". The pages
  are `/running/`, `/running/goals/` and `/running/runs/<id>/`; the share images are
  `/og/running.png`, `/og/running-goals.png` and `/og/running-run.png`.
- **Figures mean what the owner's Garmin Connect means** (owner review, 2026-10-23):
  - **Best efforts** use timer time (watch pauses left out); races use the official time.
  - **Weight and body fat** are 7-day averages throughout a card.
  - **Garmin's predictions** are "at current fitness", dated, not race-day forecasts.
  - **Race targets** read "sub-3:20" and count only a time under 3:20:00 to the second.
  - **Unreached targets** never show as beaten or as 100%.
- **Goal logic is pure** (`domain/`): every function takes "today" as an argument, so tests pin
  dates without a clock.

## Failure behaviour

- **Bad owner data stops the build, not the site.** `integration.ts` validates everything in
  `astro:build:start`, before Astro empties `dist/`, so the deploy keeps the last good build.
  The error names the file, entry and field (FR-070).
- **Missing data renders as "no data yet",** never as zeros. Examples: a goal with no effort, the
  training build before the first run, a page before `section.yaml` exists.
- **Stale data says so.** "Last updated" and the stale notice are decided at build time, then
  corrected by the freshness script. If `/running/api/freshness` fails, the build-time text
  stays (FR-005/006/074).
- **Day-based text follows the UK date.** The 00:17 UTC refresh deploys daily (T105), and
  `Countdown` corrects the day count in the browser.
- **Without JavaScript** every figure, chart table and goal is still there. JS only refreshes
  "Last updated" and the countdown.

## Tests and budgets

- **Vitest** (`tests/unit/`, `tests/contract/`): goal evaluation and card text (`goals.test.ts`,
  `goal-cards.test.ts`), races, weeks, manual metrics, attribution, the landing page rendered
  with only `Date` faked (`landing.test.ts`), data validation and the schemas.
- **Playwright** (`tests/e2e/`, `tests/a11y/`): each page at 360 px and on desktop, axe (WCAG 2.2
  AA) in light and dark, heading order, and the keyboard path through every link and control.
- **Lighthouse** (`scripts/lighthouse-budget.mjs`, also local on Windows): at graduation every
  built page scored 100 for performance and accessibility on mobile. The landing LCP was
  1.06 s, the largest page 11.2 KB gzip, with no script files and no third-party requests.
- **Gate:** the site build, `validate-data`, `check-boundaries`, `scan-images` and
  `scan-privacy`, on every push and every bot commit.

## Known limits

- **Share images are built daily.** Messaging apps cache them, so a shared link can show an
  older day count.
- **Share previews can't be checked until go-live.** Canonical and `og:image` URLs point at
  `alexanderwebber.com`, so the two-app check (T111) runs after the domain is live (T112).
- **The screen-reader pass** of the progress bar and the bar chart is the owner's check (T111).

- `components/SectionLayout.astro`: the layout for every Running page. Shared `Base` in the warm
  Running theme (`styles/theme.css`), the section nav from the route registry, the page heading,
  Garmin attribution (below) and "Last updated".
- `components/LastUpdated.astro`: FR-005/006. It shows the build-time value from `refresh.json`,
  then fetches the live one from `/running/api/freshness`.
- `data/load.ts`: the only way Running code reads data (`runningStore()`, `sectionSettings()`,
  `buildFreshness()`), memoised per build. `data/goals.ts` (`loadGoals()`) evaluates every goal
  for today from it.
- `domain/`: pure functions, unit-tested with "today" passed in. `efforts.ts` (the Best Effort
  index), `composition.ts` (body fat's build-time 7-day mean), `manual-metrics.ts` (the owner's
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
- Run pages: `pages/runs/[id].astro` (minimal until US3) with `TreadmillBadge.astro`, and the one
  shared share image `og/run.png.ts` (`/og/running-run.png`). Their routes sit in the landing
  area of the registry until US3's Training area takes them.
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

They were re-read on 2026-10-17 through published excerpts, because the cloud sandbox can't reach
developer.garmin.com. Re-check the PDF itself before go-live (T112).

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
- **In share images:** a share image showing Garmin data passes `attribution` to the OG renderer.
- **Manual figures:** the owner's manual Garmin figures (training status, race predictions) are
  attributed the same way.

The story e2e specs (T095, T109, T123, T137, T144) assert it on each page.
