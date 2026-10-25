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
  - Done (2026-10-24): the `alexanderwebber.com` nameservers moved from Namecheap to Cloudflare
    (`nikon`/`pam.ns.cloudflare.com`; the zone is on the Free plan, AI crawlers allowed, DNSSEC
    off). The domain stays registered at Namecheap. Dashboard-only settings on the zone (not in
    git): the Redirect Rule "Redirect from WWW to root [Template]" (`https://www.*` → 301
    `https://${1}`, query string kept), *SSL/TLS → Always Use HTTPS*, and Real User Monitoring
    **disabled** (*Speed → Observatory*). Cloudflare turns RUM on by default for new Free zones,
    excluding EU/UK visitors, which injects a `static.cloudflareinsights.com` beacon into pages
    served to everyone else. That breaks the zero-third-party budget, and the nightly Quality run
    catches it.
    `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" template, All zones) needed no change:
    attaching a custom domain needs only Workers Scripts Write, and Cloudflare creates the DNS
    records itself.
  - The Garmin data export was audited instead of imported (T150, 2026-10-23).
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

**Spike 1 (DONE, passed 2026-10-17)**: Workers static-assets file limit on the free plan, and
published-JSON size for 5,000 synthetic runs (<= 600-point series). A 12,000-file dummy set
deployed; 20,001 files were refused (the Free limit is 20,000 per version, so ~6,000 files at
5,000 runs is ~30% of it). 5,000 worst-case runs are ~109 MB as compact JSON, so the writer
emits compact JSON and the 600-point cap stays.

## 2. Backfill and first publish

History is what intervals.icu holds (owner decision, 2026-10-23: the Garmin export was audited,
not imported, T150). Runs start on 7 Oct 2025 (four treadmill runs from before intervals.icu's
own history were uploaded as FIT files), and wellness on 7 Oct 2025. The backfill (T085) is done;
re-run it only to rebuild the archive.

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

Scenarios (map to spec stories). Each one is automated; the last column says where, so a scenario
is re-checked by running the suites in §4 rather than by hand. There are no real races or lab
results yet, so those scenarios run over the synthetic `/race-preview/` and `/health-preview/`
pages (`SHELL_PREVIEW=1` builds only).

| # | Check | Expected | Automated in |
|---|---|---|---|
| 1 | Open `/running/` at 360 px width | Brighton hero (date, days left, target, Garmin prediction "at current fitness (<date>)" from `manual-metrics.yaml`, "For Martlets hospice"), featured goals (newly achieved first, then priority order), this-week snapshot, latest run card, Garmin attribution; first two screens answer SC-001 | `tests/e2e/landing.spec.ts` |
| 2 | Change the Brighton target in both `goals.yaml` and `upcoming-races.yaml` (e.g. 3:20 -> 3:15), rebuild | New target everywhere, old nowhere; `validate-data` warns if the two files disagree (the landing page would show both) | `tests/unit/validate-data.test.ts` (the warning), `tests/e2e/landing.spec.ts` (the hero shows `upcoming-races.yaml`'s target) |
| 3 | Add a goal with time `3:7x` | `validate-data`/build fails naming file, goal, field; `dist/` untouched; live site unchanged | `tests/e2e/goals.spec.ts` (US2.7) |
| 4 | Add a run fixture with a 44:41 continuous 10 km inside a longer run | Goal "10k under 45:00" shows achieved with that date and run link, the effort labelled "(in a longer run)" | `tests/unit/goals.test.ts`, `goal-cards.test.ts` |
| 5 | Open any training run | Full detail, panels without data omitted, charts x-axis distance/elapsed, **no start time, map, place name or provider free-text name**; Garmin attribution | `tests/e2e/run-detail.spec.ts`, `landing.spec.ts`, `scan-privacy` |
| 5b | Open a treadmill (`VirtualRun`) run; mark another `include_in_records: true` | "Treadmill" label in list and detail, counted in totals, no map; excluded from PBs/race-time goals unless marked | `tests/e2e/training.spec.ts`, `tests/unit/goals.test.ts`, `pbs.test.ts` |
| 6 | Open a race with GPS + 3 photos | Static route SVG + "Load interactive map" button; gallery with alt text; no EXIF in `dist/` images | `tests/e2e/races.spec.ts` (race preview), `scan-images` |
| 7 | Add two hand-entered pre-Garmin races + one official time | History shows all once, PB table uses official time (US4). The owner has no older races (2026-10-23) | `tests/e2e/races.spec.ts` (race preview), `tests/unit/race-history.test.ts`, `pbs.test.ts` |
| 7b | Add a hand-entered race (no `run_id`) on the same date/distance as a Garmin race | `validate-data` fails telling you to add `run_id`; with `run_id` it shows once with official details winning | `tests/unit/validate-data.test.ts` |
| 7c | Search `data/` and `dist/` for the intervals.icu activity ID (and Garmin `external_id`) of any run | Zero hits; run URLs are `/running/runs/YYYY-MM-DD-xxxx/` | `scan-privacy --provider-ids` in the gate (the run-ID map is fetched from R2 in CI), plus `validate-data`'s ID patterns locally |
| 7d | Set the Brighton `date` to yesterday / today / tomorrow in `upcoming-races.yaml` | Hero shows "Result coming soon" / "Race day" / "N days"; setting `result_ref` moves it to completed | `tests/unit/races.test.ts`, `landing.test.ts` |
| 8 | Health page | Trend charts with range toggle; weight is 7-day average only; fitness/fatigue/form labelled as intervals.icu's model; training status and predictions show "as of <date>" (and "not recorded yet" with no entries); lab marker labelled with device/lab/difference; no sleep/stress/Body Battery; Garmin attribution | `tests/e2e/health.spec.ts` (real page and health preview), `tests/unit/health.test.ts` |
| 9 | Disable JS | All key figures, text alternatives and data tables still present (FR-074); the build-time "Last updated" shown | `tests/e2e/landing.spec.ts`, `training.spec.ts`, `run-detail.spec.ts`, `races.spec.ts`, `stale.spec.ts` |
| 10 | Make `fetch` fail for >12 h (fixture) | Stale notice appears; site fully renders; after >24 h a GitHub issue `ingest-failing` opens, closes on recovery | `tests/e2e/stale.spec.ts` (SC-003 drill, 7 days stale), `ingest/tests/contract/test_alerts.py` |

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

Run the gate on a deploy build (no `SHELL_PREVIEW`): a test build's synthetic race routes
(`dist/race-preview/*/route.json`) are coordinates outside real race pages, so `scan-privacy`
rightly flags them. In CI the gate also passes `--provider-ids=<file>` with the run-ID map from R2.

**Run locally and at graduation (not in the gate; broader CI is deferred)**:

```text
npm test                            # vitest: goals, PBs, best efforts, period maths, formatting, stores
cd ingest && uv run pytest          # adapter + archive + writer contract tests, sanitiser/run-ID property tests
cd ingest && uv run ruff check      # Python lint
SHELL_PREVIEW=1 npm run build       # Playwright needs the test-only preview pages
npx playwright test                 # e2e, keyboard path, freshness UI, the SC-003 stale drill; both projects (360 px and desktop)
```

On Windows, run Playwright from PowerShell (`$env:SHELL_PREVIEW='1'; npm run build`, then
`npx playwright test`): its web server fails to start from Git Bash. `tests/e2e/stale.spec.ts`
builds its own scratch copy of the site with 7-day-old freshness, so it adds ~15 s.

Non-blocking quality signals (`quality.yml` and locally):

```text
node scripts/lighthouse-budget.mjs  # Lighthouse 13 CLI: mobile >= 90 on every page type; landing LCP <= 2.5 s (deploy build)
npx playwright test tests/a11y      # axe on each page type, light and dark, + keyboard path per chart type
```

The race page type is skipped until the first real race exists; measure the race preview pages from
a `SHELL_PREVIEW=1` build meanwhile (T147 did: 100, 26.1 KB gzip, 1.6 KB of JS).

On PRs, `tests.yml` runs these suites as path-filtered jobs (adopted 2026-10-04).

Manual: screen-reader pass for each chart type (line, bar, progress, splits table, map fallback),
share-preview check of each page type in two messaging apps (SC-008; training runs show the shared card).

## 5. Operate

- Manual refresh: `gh workflow run refresh.yml` (optionally `-f reimport_from=2027-03-01
  -f reimport_to=2027-03-14`); site updated within ~10 min (SC-002 allows 30).
- After the adapter adds an archived part (e.g. `original.fit`, T159): `gh workflow run
  refresh.yml -f reimport_from=2025-10-01 -f missing_only=true` fetches only the missing parts of
  every archived run in the window (one call per run, about 2 s each), instead of re-fetching
  everything. Normal refreshes top up their own 14-day window by themselves.
- Add a goal/race/lab result, or a new Garmin training status / race prediction reading
  (`manual-metrics.yaml`, dated `as_of`): edit the YAML under `data/running/owner/` (agent does it
  on request, opens a PR); merge -> `refresh.yml` runs on the push and deploys.
- intervals.icu API key replaced: `gh secret set INTERVALS_API_KEY` (agent supplies the command).
- Add a race photo: give the agent the file; `node scripts/add-race-photo.ts <photo>
  --race=<slug> --description="<alt text>" [--caption=...]` strips metadata, resizes and writes it
  beside `race.yaml` with its `photos` entry.
- Failure signals: GitHub issues `ingest-failing` (fetch failing for over 24 h) and
  `refresh-trigger-failing` (no dispatched refresh for 6 h; the Worker cron's token may have
  lapsed). The agent checks open issues and red refresh runs at session start; the issue body
  names the failure class and action (contracts/pipeline.md table). A single red run with
  `code: transient` (e.g. intervals.icu answering 503) needs nothing: the next run retries.
- Tweak thresholds/limits or the focus race: edit `data/running/owner/section.yaml`.

## 6. Performance & privacy budget checklist (per page type)

JS <= 10 KB gzip (map script excepted, click-to-load); HTML+CSS+JS <= 150 KB; Lighthouse mobile
perf >= 90; LCP <= 2.5 s on simulated mid-range phone; zero third-party requests on load;
0 privacy-scan findings.
