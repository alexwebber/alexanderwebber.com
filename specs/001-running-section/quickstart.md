# Quickstart & Validation Guide: Running Section

**Feature**: 001-running-section | Contracts: [contracts/](contracts/) | Data: [data-model.md](data-model.md)

Validation scenarios that prove the feature end to end. Commands are indicative of the layout in
plan.md; the agent runs them (owner only supplies the few account actions flagged **Owner**).

## 0. Prerequisites

- Node >= 22.23.4 (24.15 local), Python >= 3.12 + `uv`, `gh` authenticated, `wrangler`.
- **Owner (one-off, agent walks through it)**:
  - Done (2026-10-17): Cloudflare account; private R2 bucket `alexanderwebber-private` + R2 API
    token (`R2_*`); Workers deploy token (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`);
    Garmin Connect connected to intervals.icu (official sync); intervals.icu personal API key
    (*Settings → Developer Settings*) stored as `INTERVALS_API_KEY`. All are GitHub Actions secrets
    (names in contracts/pipeline.md) and user env vars on the owner's PC for local runs.
  - Pending: move the `alexanderwebber.com` nameservers from Namecheap to Cloudflare; request the
    Garmin data export and, when it arrives, import it in *intervals.icu → Settings → Import all
    Garmin data* (full history before intervals.icu's 1-year sync window).
  - Nothing is committed. There are no Garmin credentials or tokens anywhere.

## 1. Spike 0 — intervals.icu coverage check (DONE, passed 2026-10-17)

Throwaway code: `spikes/intervals/probe.py` (stdlib only; needs `INTERVALS_API_KEY`). Results:
[spikes/intervals/RESULTS.md](../../spikes/intervals/RESULTS.md); rationale: research.md R0.

- Locally and from a throwaway `ubuntu-latest` workflow (since removed), every required field was
  returned for Garmin-synced data: activities (HR zones, running dynamics incl. GCT, power, load,
  streams, FIT) and wellness (weight, body fat, resting HR, HRV rMSSD, VO2 max, ctl/atl).
- Missing, so owner entries: Garmin training status and race predictions
  (`data/running/owner/manual-metrics.yaml`).
- Gotcha: requests MUST send a descriptive User-Agent; Python's default `Python-urllib/x.y` gets a
  Cloudflare 403 HTML challenge (a bot block, not an auth failure).
- Outcome: fetch runs on GitHub Actions; no `FETCH_MODE`, no PC fallback. Re-run the probe
  (`python spikes/intervals/probe.py`) only if coverage is ever in doubt; raw output stays in the
  gitignored `spikes/intervals/out/`.

**Spike 1 (parallel, 1 h)**: Workers static-assets file limit on the free plan (deploy a
12,000-file dummy asset set, 2x the ~6,000-file estimate for 5,000 runs), and published-JSON size for 5,000 synthetic runs (<= 600-point
series). Adjust inlining/downsampling if needed.

## 2. Backfill and first publish

Prerequisite: the owner's Garmin export has been imported into intervals.icu (otherwise history
starts at 2025-10-18).

```text
cd ingest && uv sync
uv run awingest backfill            # agent-run locally (owner's R2_*/INTERVALS_API_KEY env vars), resumable
uv run awingest process --all       # R2 raw -> data/running/published/
uv run awingest publish-check
```

Expected: all running activities and approved health history present (SC-009: spot-check 20 runs
against intervals.icu for distance/time/HR); no file under `data/` contains a start time, lat/lon
(outside race tracks), a training run's free-text name/description, or sleep/steps/SpO2/stress/
Body Battery data; R2 wellness objects contain approved keys only.

## 3. Run the site locally

```text
npm install
npm run validate-data               # schemas + referential checks, file/entry/field errors
npm run dev                         # http://localhost:4321/running/
npm run build && npm run preview
```

Scenarios (map to spec stories):

| # | Check | Expected |
|---|---|---|
| 1 | Open `/running/` at 360 px width | Brighton hero (date, days left, target, Garmin prediction "as of <date>" from `manual-metrics.yaml`, "For Martlets hospice"), featured goals in priority order, this-week snapshot, latest run card, Garmin attribution; first two screens answer SC-001 |
| 2 | Edit the Brighton goal/upcoming-race target 3:30 -> 3:20 (`goals.yaml` / `upcoming-races.yaml`), rebuild | 3:20 everywhere, 3:30 nowhere |
| 3 | Add a goal with time `3:7x` | `validate-data`/build fails naming file, goal, field; `dist/` untouched; live site unchanged |
| 4 | Add a run fixture with a 44:41 continuous 10 km inside a longer run | Goal "10k under 45:00" shows achieved with that date and run link |
| 5 | Open any training run | Full detail, panels without data omitted, charts x-axis distance/elapsed, **no start time, map, place name or provider free-text name**; Garmin attribution |
| 5b | Open a treadmill (`VirtualRun`) run; mark another `include_in_records: true` | "Treadmill" label in list and detail, counted in totals, no map; excluded from PBs/race-time goals unless marked |
| 6 | Open a race with GPS + 3 photos | Static route SVG + "Load interactive map" button; gallery with alt text; no EXIF in `dist/` images |
| 7 | Add two hand-entered pre-Garmin races + one official time | History shows all once, PB table uses official time (US4) |
| 7b | Add a hand-entered race (no `run_id`) on the same date/distance as a Garmin race | `validate-data` fails telling you to add `run_id`; with `run_id` it shows once with official details winning |
| 7c | Search `data/` and `dist/` for the intervals.icu activity ID (and Garmin `external_id`) of any run | Zero hits; run URLs are `/running/runs/YYYY-MM-DD-xxxx/` |
| 7d | Set the Brighton `date` to yesterday / today / tomorrow in `upcoming-races.yaml` | Hero shows "result coming soon" / "Race day" / "N days"; setting `result_ref` moves it to completed |
| 8 | Health page | Trend charts with range toggle; weight is 7-day average only; fitness/fatigue/form labelled as intervals.icu's model; training status and predictions show "as of <date>" (and "not recorded yet" with no entries); lab marker labelled with device/lab/difference; no sleep/stress/Body Battery; Garmin attribution |
| 9 | Disable JS | All key figures, text alternatives and data tables still present (FR-074); "as of last site update" shown |
| 10 | Make `fetch` fail for >12 h (fixture) | Stale notice appears; site fully renders; after >24 h a GitHub issue `ingest-failing` opens, closes on recovery |

## 4. Validation

**The gate** (mandatory on every push and ingest commit; constitution = site build + data-schema
validation, with the privacy scan and boundary check as validation steps):

```text
npm run validate-data               # schemas + referential checks (incl. duplicate races, IDs)
npm run scan-images                 # fails on any EXIF/GPS in repo images
npm run check-boundaries            # shared !-> sections; section !-> section
npm run build                       # astro check + astro build
npm run scan-privacy                # SC-004: no start times, training coords, banned categories, provider IDs/URLs, photo EXIF in data/ + dist/
```

**Run locally and at graduation (not in the gate; broader CI is deferred)**:

```text
npm test                            # vitest: goals, PBs, best efforts, period maths, formatting, stores
uv run pytest                       # adapter + archive + writer contract tests, sanitiser/run-ID property tests
npx playwright test                 # e2e, keyboard path, freshness UI
```

Non-blocking quality signals (`quality.yml` and locally):

```text
node scripts/lighthouse-budget.mjs  # Lighthouse 13 CLI: mobile >= 90 on every page type; landing LCP <= 2.5 s
npx playwright test tests/a11y      # axe across all pages + keyboard path per chart type
```

On PRs, `tests.yml` runs these suites as path-filtered jobs (adopted 2026-10-04).

Manual: screen-reader pass for each chart type (line, bar, progress, splits table, map fallback),
share-preview check of each page type in two messaging apps (SC-008; training runs show the shared card).

## 5. Operate

- Manual refresh: `gh workflow run refresh.yml` (optionally `-f reimport_from=2027-03-01
  -f reimport_to=2027-03-14`); site updated within ~10 min (SC-002 allows 30).
- Add a goal/race/lab result, or a new Garmin training status / race prediction reading
  (`manual-metrics.yaml`, dated `as_of`): edit the YAML under `data/running/owner/` (agent does it
  on request, opens a PR); merge -> `refresh.yml` runs on the push and deploys.
- intervals.icu API key replaced: `gh secret set INTERVALS_API_KEY` (agent supplies the command).
- Add a race photo: give the agent the file; `scripts/add-race-photo` strips metadata/resizes,
  writes it beside `race.yaml`.
- Failure signal: a GitHub issue `ingest-failing` (the agent checks open issues at session start);
  the issue body names the failure class and action (contracts/pipeline.md table).
- Tweak thresholds/limits or the focus race: edit `data/running/owner/section.yaml`.

## 6. Performance & privacy budget checklist (per page type)

JS <= 10 KB gzip (map script excepted, click-to-load); HTML+CSS+JS <= 150 KB; Lighthouse mobile
perf >= 90; LCP <= 2.5 s on simulated mid-range phone; zero third-party requests on load;
0 privacy-scan findings.
