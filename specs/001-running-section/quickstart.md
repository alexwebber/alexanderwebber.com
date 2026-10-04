# Quickstart & Validation Guide: Running Section

**Feature**: 001-running-section | Contracts: [contracts/](contracts/) | Data: [data-model.md](data-model.md)

Validation scenarios that prove the feature end to end. Commands are indicative of the layout in
plan.md; the agent runs them (owner only supplies the few account actions flagged **Owner**).

## 0. Prerequisites

- Node >= 22.12 (24.15 local), Python >= 3.12 + `uv`, `gh` authenticated, `wrangler`.
- **Owner (one-off, agent walks through it)**: create a Cloudflare account/zone; move
  `alexanderwebber.com` nameservers from Namecheap to Cloudflare; create an R2 bucket
  (private) + an R2 API token; create a Workers deploy API token; provide Garmin email/password
  (the agent generates the `GARMIN_TOKEN_KEY` Fernet key via `awingest keygen`); these are stored as
  GitHub Actions secrets (names in contracts/pipeline.md). Nothing is committed.

## 1. Spike 0 — Garmin from GitHub Actions (do this first)

Goal: decide `FETCH_MODE=actions` vs `pc` with evidence. Throwaway code under `spikes/garmin/`.
Full rationale and pass criteria: research.md R0.

1. Locally: `uv run python spikes/garmin/probe.py login` (pinned `garminconnect==0.3.17`,
   `curl_cffi==0.16.3`; **one** login only, honour back-off). Generate the token key
   (`keygen`), encrypt the token file with it and upload it to R2 as `state/garmin_tokens.enc`.
2. If data calls return 403, apply upstream issue #444 workaround
   (`_api_session = curl_cffi.requests.Session(impersonate="chrome")`) and re-test.
3. Throwaway workflow on `ubuntu-latest`: decrypt tokens -> token-only login -> call the endpoints
   below -> re-encrypt and upload if rotated; `concurrency` group so runs never overlap.
4. **Schedule it every 2 h (`17 */2 * * *`) for 48 h.**
5. **Pass** = >= 23 of 24 scheduled runs succeed; the token rotated by one run is the one the next
   run uses (rotation persisted across runs at the real cadence, no password re-login); no
   persistent 403/429 from Actions that does not occur locally. **Fail** = anything else.
6. Endpoint checklist (record available / absent / needs the `curl_cffi` session for each):
   running dynamics; running power; Garmin Index body composition (weight, body fat); HRV;
   training status (+ load); VO2 max; race predictions; resting HR; activity details, splits and
   HR zones. Save sample payloads to **R2 only** to shape the adapter fixtures. Absent optional
   items (dynamics, power) just omit panels (FR-048); absent required items go back to the plan.
7. Record the outcome in `PROJECT_MEMORY.md` (answers the open question) and set `FETCH_MODE`.
   Fallback (if failed): Windows Task Scheduler runs
   `uv run awingest fetch && gh workflow run refresh.yml` every 2 h; nothing else changes.

**Spike 1 (parallel, 1 h)**: Workers static-assets file limit on the free plan (deploy a
12,000-file dummy asset set, 2x the ~6,000-file estimate for 5,000 runs), and published-JSON size for 5,000 synthetic runs (<= 600-point
series). Adjust inlining/downsampling if needed.

## 2. Backfill and first publish

```text
cd ingest && uv sync
uv run awingest login
uv run awingest backfill            # owner's PC, resumable; logs progress
uv run awingest process --all       # R2 raw -> data/running/published/
uv run awingest publish-check
```

Expected: all running activities and approved health history present (SC-009: spot-check 20 runs
against Garmin Connect for distance/time/HR); no file under `data/` contains a start time, lat/lon
(outside race tracks), or sleep/stress/Body Battery data.

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
| 1 | Open `/running/` at 360 px width | Brighton hero (date, days left, target, Garmin prediction, "For Martlets hospice"), featured goals in priority order, this-week snapshot, latest run card; first two screens answer SC-001 |
| 2 | Edit the Brighton goal/upcoming-race target 3:30 -> 3:20 (`goals.yaml` / `upcoming-races.yaml`), rebuild | 3:20 everywhere, 3:30 nowhere |
| 3 | Add a goal with time `3:7x` | `validate-data`/build fails naming file, goal, field; `dist/` untouched; live site unchanged |
| 4 | Add a run fixture with a 44:41 continuous 10 km inside a longer run | Goal "10k under 45:00" shows achieved with that date and run link |
| 5 | Open any training run | Full detail, panels without data omitted, charts x-axis distance/elapsed, **no start time, map, place name** |
| 6 | Open a race with GPS + 3 photos | Static route SVG + "Load interactive map" button; gallery with alt text; no EXIF in `dist/` images |
| 7 | Add two hand-entered pre-Garmin races + one official time | History shows all once, PB table uses official time (US4) |
| 7b | Add a hand-entered race (no `run_id`) on the same date/distance as a Garmin race | `validate-data` fails telling you to add `run_id`; with `run_id` it shows once with official details winning |
| 7c | Search `data/` and `dist/` for the Garmin activity ID of any run | Zero hits; run URLs are `/running/runs/YYYY-MM-DD-xxxx/` |
| 7d | Set the Brighton `date` to yesterday / today / tomorrow in `upcoming-races.yaml` | Hero shows "result coming soon" / "Race day" / "N days"; setting `result_ref` moves it to completed |
| 8 | Health page | Trend charts with range toggle; weight is 7-day average only; lab marker labelled with device/lab/difference; no sleep/stress/Body Battery |
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
npm run scan-privacy                # SC-004: no start times, training coords, banned categories, Garmin IDs/URLs, photo EXIF in data/ + dist/
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

*Proposal for the owner (not adopted):* run the test suites as path-filtered PR jobs - the BACKLOG
"Broader CI" revisit.

Manual: screen-reader pass for each chart type (line, bar, progress, splits table, map fallback),
share-preview check of each page type in two messaging apps (SC-008; training runs show the shared card).

## 5. Operate

- Manual refresh: `gh workflow run refresh.yml` (optionally `-f reimport_from=2027-03-01
  -f reimport_to=2027-03-14`); site updated within ~10 min (SC-002 allows 30).
- Add a goal/race/lab result: edit the YAML under `data/running/owner/` (agent does it on request,
  opens a PR); merge -> `refresh.yml` runs on the push and deploys.
- Add a race photo: give the agent the file; `scripts/add-race-photo` strips metadata/resizes,
  writes it beside `race.yaml`.
- Failure signal: a GitHub issue `ingest-failing` (the agent checks open issues at session start);
  the issue body names the failure class and action (contracts/pipeline.md table).
- Tweak thresholds/limits or the focus race: edit `data/running/owner/section.yaml`.

## 6. Performance & privacy budget checklist (per page type)

JS <= 10 KB gzip (map script excepted, click-to-load); HTML+CSS+JS <= 150 KB; Lighthouse mobile
perf >= 90; LCP <= 2.5 s on simulated mid-range phone; zero third-party requests on load;
0 privacy-scan findings.
