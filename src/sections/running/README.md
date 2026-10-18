# Running section

A self-contained section (constitution Principle VII): it owns its pages, components, data
loader and share images, and uses only `src/shared/` (layout, design system, charts, storage).
`integration.ts` injects the routes of each shipped area; `astro.config.mjs` is the one line that
adds the section to the site.

- `components/SectionLayout.astro`: the layout for every Running page. Shared `Base` in the warm
  Running theme (`styles/theme.css`), the section nav from the route registry, the page heading,
  Garmin attribution (below) and "Last updated".
- `components/LastUpdated.astro`: FR-005/006. It shows the build-time value from `refresh.json`,
  then fetches the live one from `/running/api/freshness`.
- `data/load.ts`: the only way Running code reads data (`runningStore()`, `sectionSettings()`,
  `buildFreshness()`), memoised per build.

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
