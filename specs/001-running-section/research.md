# Research: Running Section

**Feature**: 001-running-section | **Date**: 2026-10-04 | **Plan**: [plan.md](plan.md)

All versions below were checked against the npm / PyPI registries and GitHub on 2026-10-04
(project norm: research before choosing dependencies; start new dependencies on their current
release). "Verify in spike" marks anything that cannot be settled from documentation alone.

Local toolchain found: Node 24.15.0, Python 3.12.10, uv 0.11.7 (current 0.12.23; routine bump,
skipped), gh 2.90.0.

---

## R0. Running data provider: intervals.icu (decided 2026-10-17; Spike 0 passed)

**Decision (owner, 2026-10-17; supersedes the 2026-10-04 Garmin-direct plan)**: ingest reads
**intervals.icu**, an official Garmin sync partner, through its documented REST API (OpenAPI 3 at
`https://intervals.icu/api/v1/docs`) with the owner's **personal API key** (HTTP Basic, user
`API_KEY`, password = key; athlete `0` = the key's own athlete). There is no login, no token
rotation, no lockout risk and no datacenter-IP question. **Garmin direct is reconsidered only if
intervals.icu cannot supply something required.**

**Rejected, and why**

| Option | Why rejected |
|---|---|
| Garmin Connect via `python-garminconnect` (0.3.17; the original plan) | Unofficial client: Garmin's March 2026 Cloudflare TLS fingerprinting, 429 login lockouts (1–48 h reported) from repeated password logins, token rotation to persist across runs (Fernet-encrypted token file in R2), and a possible need for a PC fetch fallback (`FETCH_MODE`, Task Scheduler). All of that disappears with an official sync partner. (Upstream #444, the 403-on-data-calls report, closed 2026-10-16 as a local `.netrc` misconfiguration.) |
| Strava API + manual stats | November 2024 API terms let a user's data be shown only to that user; no health metrics |
| Garmin official API | Business-only |

**Terms**: the intervals.icu API terms (effective 2025-10-23) grant a royalty-free licence for any
lawful use; the one condition is that views showing Garmin-sourced data carry **Garmin
attribution** per Garmin's brand guidelines (spec FR-077). Free tier is sufficient; the $4/month
supporter tier adds nothing the site needs, and the owner intends to become a supporter once the
live integration works (raised at go-live, T112).

**Spike 0 = coverage check — PASSED** (2026-10-17, locally and from GitHub Actions run
39048175253 on `ubuntu-latest`; full table in
[spikes/intervals/RESULTS.md](../../spikes/intervals/RESULTS.md)):

- **Activities** (`GET /athlete/0/activities?oldest=&newest=`, `/activity/{id}?intervals=true`,
  `/activity/{id}/streams.json`, `/activity/{id}/time-at-hr`, `/activity/{id}/fit-file`): date,
  distance, moving/elapsed time, pace, elevation, HR avg/max + zone times
  (`icu_hr_zone_times`), cadence, stride, running dynamics (vertical oscillation/ratio, stance time
  = GCT, stance-time balance, step length; from 2025-12-01, the current watch), running power
  (`device_watts` + `watts` stream), training load (`icu_training_load`), streams (incl. `latlng`)
  and FIT/original files. Types seen: `Run` and `VirtualRun` (treadmill). The `race` flag exists
  but Garmin sync never sets it, so races come from owner designation.
- **Wellness** (`GET /athlete/0/wellness?oldest=&newest=`, one record per day): `weight`,
  `bodyFat`, `restingHR`, `hrv` (rMSSD; no HRV baseline/status), `vo2max`, `ctl`/`atl`
  (intervals.icu's fitness/fatigue model, not Garmin's). The same records also carry `sleepSecs`,
  `steps`, `spO2` etc., which **ingest drops before archiving** (FR-015).
- **Not available → manual owner entries** (`owner/manual-metrics.yaml`, dated `as_of`): Garmin
  **training status** and Garmin **race predictions**. Garmin **training effect** is not exposed
  by the API either (FR-047 panel omitted unless a later change extracts it from the archived FIT
  file).
- **History**: the API currently reaches back to 2025-10-18 (the 1-year sync backfill). Full
  history arrives when the owner imports his Garmin data export into intervals.icu (*Settings →
  Import all Garmin data*); ingest still reads only intervals.icu.
- **Gotcha — User-Agent**: intervals.icu is behind Cloudflare, which returns **403 with an HTML
  challenge page** for Python `urllib`'s default `Python-urllib/x.y` User-Agent. The client MUST
  send a descriptive User-Agent (e.g. `alexanderwebber.com-ingest/<version>
  (+https://alexanderwebber.com)`), and the adapter classifies a 403 with an HTML body as a bot
  block (`ProviderForbidden`), not an auth failure (`AuthRejected` = 401, or 403 with a JSON body).

**Design consequences**

- The pipeline keeps its two stages with the private R2 bucket between them (Principle VI, and
  reprocessing without provider calls): **fetch** (intervals.icu → raw JSON/FIT in R2) then
  **publish** (R2 → normalise → sanitise → committed JSON → gate → deploy). **Both run on GitHub
  Actions**; there is no `FETCH_MODE` and no PC fallback.
- **Incremental by date window**: list calls take `oldest`/`newest`; each fetch re-lists from the
  cursor minus 14 days (FR-008) to today, and fetches detail/streams/FIT only for new activities or
  ones whose list row changed. Wellness is re-fetched over the same window (late-arriving values).
- **Secrets**: `INTERVALS_API_KEY` (GitHub secret; also a user env var on the owner's PC for local
  runs) plus `R2_*` for the bucket `alexanderwebber-private`. No Garmin credentials or tokens exist
  anywhere.
- **Privacy at publish**: training runs lose their `latlng` stream and free-text `name`/
  `description` (races keep GPS for race maps); raw R2 keeps them so a later race designation can
  still build a race map.
- **Backfill** of the full history (after the export import) is chunked, paced and resumable; the
  agent runs it locally with the owner's `INTERVALS_API_KEY`/`R2_*` env vars.

---

## R1. Site framework and hosting

| Option | Current | Notes | Verdict |
|---|---|---|---|
| **Astro** | 7.3.5 (2026-09-24); Node >= 22.12; Vite 8, Rust compiler (stricter HTML) | Static-first, islands, content/data loading, built-in image pipeline (sharp). Cloudflare acquired the Astro team Jan 2026 | **Chosen** |
| Next.js / SvelteKit | n/a | Heavier client runtime than needed; Astro favoured by constitution | Rejected |
| 11ty | n/a | Fine for static, weaker TS/typed data and component story | Rejected |

Astro 7 note: stricter compiler (unclosed tags error), `compressHTML: 'jsx'` default,
`src/fetch.ts` reserved, `@astrojs/db` removed (irrelevant). Starts on 7.x directly, no migration.

**Hosting**: Cloudflare now recommends **Workers with static assets** for new projects; Pages
remains supported but is not where investment goes. Constitution allows "Pages/Workers".
**Decision: Workers static assets**, static Astro output (`output: 'static'`, so no
`@astrojs/cloudflare` adapter needed), one tiny Worker script for `/running/api/freshness`
(R2 binding). Deployed by `wrangler` 4.147.0 from GitHub Actions, so the **build gate controls
the deploy** (Cloudflare's own Git-integrated builds would deploy without our gate).
Free-tier limits to **verify in spike**: static-asset file count per version (believed 20,000 on
free) — design keeps published pages + assets to ~6,000 files at 5,000 runs by inlining each
run's recording into its page rather than shipping one JSON per run, and by sharing one OG image
across all training runs (R8). Estimate: 5,000 run pages + ~15 year pages + ~110 race pages +
~20 other pages + ~110 OG images + <= ~600 photo variants + ~150 JS/CSS/font/sitemap files
~= 6,000 files, ~30% of the limit; Spike 1 deploys a 12,000-file dummy set to confirm headroom.

**TypeScript (deliberate pin of a core component)**: **6.0.3**, not 7.0.x (7.0.2 is current,
2026-07-08). `@astrojs/check` 0.9.10 (latest) peer-requires `typescript ^5 || ^6`; TS 7 is the
native port and would break `astro check` in the build gate. Revisit when `@astrojs/check`
supports TS 7. Logged in the `PROJECT_MEMORY.md` decisions log on 2026-10-04 (house norm for
pinning a core component).

**DNS**: domain stays registered at Namecheap; nameservers move to Cloudflare so the Worker can
serve the custom domain (owner action; in quickstart). Alternative (CNAME-only) is not supported
for an apex domain on Workers without Cloudflare DNS.

---

## R2. Raw archive and "safe to publish" storage

Owner decision: raw provider data (training GPS, start times, free-text names, unapproved
metrics) never goes in git.

| Option | Cost | Fit |
|---|---|---|
| **Cloudflare R2 (private bucket)** | 10 GB-month free, 1M Class A + 10M Class B ops free, **zero egress**; $0.015/GB-mo beyond | Same vendor as hosting, S3-compatible (boto3), Worker binding for the freshness endpoint. Raw history of several thousand runs with streams is well under 10 GB |
| Backblaze B2 / S3 | Pennies | Extra vendor/account for no gain |
| Private git repo / LFS | Free-ish | Splits the "own your data" store across two repos; LFS quotas |
| Encrypted blobs in the public repo | Free | Violates "nothing committed that is not meant to be public" in spirit; key management burden |

**Decision: R2** (bucket `alexanderwebber-private`, created 2026-10-17), accessed with `boto3`
1.43.108 through the S3 API from Python (Actions, or the agent locally) and
with an R2 binding from the Worker. A `RawArchive` abstraction (Principle IV) with `R2Archive` and
`LocalArchive` implementations (tests, offline development).
Recurring cost expectation: **$0/month** (inside free tier); would be cents if it ever left it.

**Sanitise-before-git**: an allow-list transformer (never a deny-list) turns normalised activities
into published JSON; published schemas use `additionalProperties: false` so a new raw field cannot
leak by accident. See data-model.md "Sanitisation rules".

---

## R3. Python ingest tooling

| Choice | Version | Why |
|---|---|---|
| Python | >= 3.12 (3.12.10 local) | Modern typing; matches Spike 0 |
| HTTP client | standard library `urllib.request` | intervals.icu is a plain REST API with Basic auth; Spike 0's stdlib client worked locally and from Actions once it sent a descriptive User-Agent, so no third-party HTTP or provider library is needed (the dropped `garminconnect`, `curl_cffi` and `cryptography` pins existed only for Garmin login, Cloudflare impersonation and token encryption) |
| `boto3` | **1.43.108** (2026-10-02) | R2 via S3 API; `moto` 5.2.3 for tests |
| `jsonschema` | 4.26.0 | Validate published output against the shared JSON Schemas (contract tests) |
| `pyyaml` | 6.0.3 | Read owner YAML overrides in the processor |
| `pytest` | 9.1.1 | Tests |
| `ruff` | 0.16.10 | Lint/format |
| `uv` | 0.12.23 current (0.11.7 local) | Env + lockfile; local bump is routine, skipped unless it bites |

FIT parsing is **not** needed (and `garmin-fit-sdk` is not adopted): intervals.icu's
`/activity/{id}/streams.json` returns per-sample metrics (time, distance, velocity, HR, cadence,
altitude, power, running dynamics, `latlng`) as JSON, confirmed by Spike 0. The FIT file is
archived to R2 verbatim as a raw backup only. `fitparse` is unmaintained (last release 2020);
`fitdecode` remains the fallback if something needed later exists only in the FIT file (e.g.
Garmin training effect). No pydantic: schemas live as JSON Schema (below) and Python uses typed
dataclasses.

---

## R4. Schemas, validation and owner-entered data

Two languages, one contract. **Decision: JSON Schema (draft 2020-12) files in `schemas/` are the
single source of truth.**

- Python: validated with `jsonschema` in contract tests and at write time.
- TypeScript: types generated with `json-schema-to-typescript` 16.0.0; build-time validation with
  `ajv` 8.20.0 whose errors are re-formatted into "file, entry, field, problem" (FR-070).
- Owner-edited files are **YAML** (comfortable to hand-edit, comments allowed) parsed with `yaml`
  2.9.1, validated against the same schemas (YAML -> JSON object -> ajv). Published machine data is
  JSON.

Rejected: zod 4.6.5 (would duplicate schemas that Python must also honour), pydantic (same, and
heavier on the Python side).

---

## R5. Charts

Requirements: text alternative + accessible data table (FR-071), keyboard operable, works without
JS (FR-074), minimal client JS (constitution), light/dark, 5,000-run history, phone first.

| Option | Size / state | Fit |
|---|---|---|
| **Build-time SVG in Astro components (no chart lib)** | 0 KB JS | Charts are static, accessible by construction (`<figure>`, `<title>/<desc>`, data table in `<details>`), print/OG-friendly, immune to library churn. Range selector (3 months / 1 year / all) done with pre-rendered variants toggled by radio inputs + CSS, so no JS |
| uPlot 1.6.32 (2025-03) | ~48 KB, fast | Canvas, no built-in a11y; kept as an *optional* hover enhancement later |
| Chart.js 4.5.1 | ~70 KB+ | Canvas; a11y is manual |
| Observable Plot 0.6.17 | pulls d3 | Excellent SVG, but client-side bundle |

**Decision: build-time SVG** with a small shared chart module (scales, axes, line/area/bar/
progress components) in the shared design system. Skill `dataviz` conventions (palette
validation, mark specs) are applied when the chart primitives are implemented. Tooltips/hover are
a deferred progressive enhancement.

---

## R6. Maps (race-only)

Requirement: interactive route map on race pages only; privacy-safe; degrade (FR-074); no visitor
request may *depend* on a third party (Principle III).

| Option | Notes |
|---|---|
| **Static pre-rendered SVG route (baseline) + MapLibre GL 6.12.0 (2026-10-03) interactive enhancement loaded on user click, OpenFreeMap tiles** | Baseline = polyline drawn at build time from the published (simplified) track, with distance markers and km-axis elevation profile: zero third parties, always works. Interactive map is lazy-loaded behind a "Load interactive map" button so MapLibre (~800 KB) never touches performance budgets |
| Leaflet + OSM raster tiles | OSM tile policy discourages heavy/commercial use; raster, dated |
| Google/Mapbox | API keys, cost, ToS, tracking |
| Self-host PMTiles (`pmtiles` 4.5.0) on R2 | Fully owned and the right *long-term* answer if OpenFreeMap ever disappears; a UK extract is ~1 GB+ and adds a tile build step. Deferred (backlog) |

**Decision**: static SVG baseline + lazy MapLibre with **OpenFreeMap** (free, no key, no stated
limits, MIT, attribution handled by MapLibre, run by one maintainer funded via GitHub Sponsors —
a known sustainability risk, hence the baseline and the PMTiles fallback in the backlog).
Published race GPS is simplified (Douglas-Peucker to <= ~1,000 points, ~1 m precision loss
irrelevant) and only exists for races; owner can hide per race (processor then drops it entirely).

---

## R7. Images (race photos) and EXIF

- Astro's `astro:assets` uses **sharp 0.35.5** to resize and emit AVIF/WebP/JPEG; sharp discards
  metadata unless asked to keep it, so build output carries no EXIF.
- But originals committed to git would carry EXIF/GPS and git is meant to be publishable
  (constitution VI, FR-016/017). **Decision**: photos enter the repo only through
  `scripts/add-race-photo` (agent-run on the owner's behalf) which strips all metadata, applies
  orientation, and caps the long edge at 2,400 px before writing into the repo. A gate check
  (`scan-images`) fails the build if any image under `data/` has any EXIF/GPS metadata, and the
  privacy scan (SC-004) re-checks `dist/`.
- Photos live in git next to the race's YAML (modest volume, races only). R2 for photos was
  considered and rejected: adds a public-bucket path and a second asset origin for little gain.

---

## R8. Share previews (OG images)

`satori` 0.35.0 (2026-10-02, actively maintained) renders JSX-like markup to SVG, then **sharp**
rasterises to PNG at build time (avoids `@resvg/resvg-js`, last released 2024-03). One bundled
open-licensed font (Inter, OFL). Landing page OG image embeds "N days to Brighton" and is
regenerated by the **daily rebuild** (below). **Which pages get which image** (FR-072 requires a
preview image on every page, not a unique one):

| Page | OG image |
|---|---|
| Site home, `/running/` landing (days to focus race), goals, training, races, health hubs | one unique generated card each (~6) |
| Each race page (`/running/races/<slug>/`) | unique card: race name, date, official time/distance (~100) |
| Training run pages (up to ~5,000) and `/running/training/<year>/` lists | **one shared generic card** each (`/og/running-run.png`, `/og/running-year.png`) - page title/description stay unique; no per-run render (keeps files ~6,000 and build time bounded; also avoids any run data in a share image) |

---

## R9. Scheduling, triggering, alerting

- **Ingest cadence (FR-002)**: GitHub Actions `schedule` every 2 hours (`17 */2 * * *`; GitHub
  cron is best-effort and can be delayed 10-60 min, so 2 h gives margin against the 3 h
  requirement). Off-minute avoids the top-of-hour crunch. Cloudflare cron triggers rejected: the
  ingest is Python and needs a runner, Actions is free for this volume and already the build gate.
  **Amended 2026-10-18:** in practice GitHub dropped three of five slots on the first full day
  (4 h gaps), so the site Worker's Cloudflare cron now *dispatches* `refresh.yml` every 2 hours
  (the ingest still runs on Actions), and `schedule` is a guarded 6-hourly backup
  (contracts/pipeline.md "Refresh trigger"). Free plan: 5 cron triggers per account; this uses 1.
- **Manual refresh (FR-003)**: `workflow_dispatch` with optional `reimport_from` / `reimport_to`
  inputs (FR-008 re-import). Agent runs `gh workflow run`; owner never needs to.
- **Daily rebuild**: two crons (`5 23 * * *` and `5 0 * * *` UTC) so the UK date rolls correctly
  across BST/GMT; re-deploys so "days to Brighton" and the OG image are right even if no data
  changed. A <1 KB inline script also corrects countdowns client-side.
  **Amended 2026-10-23 (owner pick, T105):** no separate workflow. The `refresh.yml` 00:17 UTC
  catch-all, which already publishes daily, also deploys its gated build when no data changed
  (about 1-2 billed minutes a day instead of 8-10). 00:17 UTC is after UK midnight in BST and GMT.
- **Freshness / staleness (FR-005/006)**: a data-less successful poll must still advance "last
  refreshed" but must not create a git commit every 2 hours. R2 holds
  `public/freshness.json`; a tiny Worker route `/running/api/freshness` serves it; a small script
  updates the "Last updated" line and shows the >12 h notice. Without JS the page shows the
  build-time value labelled "as of last site update" (graceful, FR-074).
- **Owner alerts (FR-010, owner decision 2)**: the workflow's last step opens a GitHub issue
  (`ingest-failing` label, likely-cause + action text) when `last_success` is > 24 h old, updates
  it while failing, and comments + closes it on recovery. Uses `GITHUB_TOKEN`
  (`issues: write`); no extra service. Failure classes map to actions: auth rejected (401) ->
  owner replaces the intervals.icu API key; 403 with an HTML body (Cloudflare bot block) -> check
  the User-Agent; 429 -> wait (back-off active); R2 error -> check credentials. The full failure-class -> owner-action table is in
  [contracts/pipeline.md](contracts/pipeline.md).
- **Commits by the ingest job**: the publish job commits sanitised data straight to `main` as
  `github-actions[bot]` **only after** validation + build pass, then deploys in the same
  workflow (commits pushed with `GITHUB_TOKEN` do not trigger other workflows, so deploy must be
  a job here, not a separate workflow). This is a deliberate, narrow exception to the "PRs not
  direct commits" norm (machine-generated data, gated by the build gate per constitution);
  **confirmed by the owner on 2026-10-04**. Humans/agents editing code or owner files still use PRs.

---

## R10. Testing and quality tooling

| Purpose | Tool | Version |
|---|---|---|
| TS unit/contract | Vitest | 5.0.3 (2026-09-30; Node ^22.12 / ^24) |
| Python | pytest + moto | 9.1.1 / 5.2.3 |
| E2E, privacy scan against built site, keyboard checks | Playwright | 1.63.0 |
| Accessibility (WCAG 2.2 AA automated layer) | @axe-core/playwright | 4.13.0 |
| Performance budget | **Lighthouse 13.5.0 CLI** via `scripts/lighthouse-budget.mjs` | `@lhci/cli` 0.15.1 (2025-06) still bundles Lighthouse 12.x, so Lighthouse is run directly against the built site's page types |

**Gate (constitution: site build + data-schema validation)** = `validate-data` (schemas +
referential checks, FR-070), `scan-images`, section-boundary check, `astro check` + `astro build`,
`scan-privacy` on `data/` and `dist/`. Privacy scan, image scan and boundary check are treated as
validation of the data/site, not as test suites.

**Not in the gate**: pytest, Vitest and Playwright suites run **locally and at graduation**
(constitution: broader CI deferred), plus path-filtered test jobs on PRs (`tests.yml`:
`ingest/**` -> pytest; shared/section code -> Vitest), adopted by the owner on 2026-10-04 as a
partial BACKLOG "Broader CI" revisit.
Lighthouse 13 CLI and axe run in a separate **non-blocking** workflow on PRs touching site code
and nightly against production (cheap signals toward SC-006/007, promoted to blocking only when
the owner decides).

**Section boundary check** (`scripts/check-boundaries.ts`, no extra dependency): scans import
specifiers in `src/**` and fails if `src/shared/**` imports from `src/sections/**`, or a file in
`src/sections/<a>/**` imports from `src/sections/<b>/**` (constitution VII). Sections are wired
only from `astro.config.mjs`.

---

## R11. Domain logic decisions (resolving spec "planning details")

- **Plausibility thresholds (spec Assumption)**: a best effort is rejected if its time is below
  `0.85 x` the current world record for the distance (e.g. 5k < 10:54, 10k < 22:30, half < 50:00,
  marathon < 1:46:00) **or** the segment's peak 1 km split is < 2:30/km. Table in
  `ingest/.../plausibility.py`, owner can still exclude any run. Rationale: catches GPS glitches
  while being irrelevant to a real recreational runner.
- **Best-effort algorithm**: sliding window over the cumulative-distance / elapsed-time stream
  (two-pointer with linear interpolation at the window start), for fixed distances (1 km, 1 mi,
  3 km, 5 km, 10 km, 15 km, 10 mi, 20 km, half, 30 km, marathon) plus any goal distance. Computed
  in the processor (needs second-by-second data) and stored in each published run.
- **Goals are derived, not stored**: achievement is a pure function of (goal, published runs/
  best efforts, health series, owner overrides). "First date the condition held" is stable under
  later regressions, so no mutable state. Retargeting an achieved goal is a new goal (spec).
- **Weight privacy**: only the trailing 7-day average per day is published (individual weigh-ins
  stay in R2), satisfying FR-061 and FR-017. Excluding a reading (FR-067) re-runs the processor.
- **Body fat and goals (FR-034 vs FR-062)**: body fat is *displayed* as recorded readings
  (published as-is, date only). **Goal achievement** for both weight and body fat uses the 7-day
  average: weight reads the published `weight_avg7`; body fat's trailing 7-day mean is computed at
  build time in `domain/goals.ts` from the published recorded readings (so it is never stored or
  shown as the headline value). Performance-metric goals use the recorded value.
- **Timezone**: Europe/London for all period boundaries; weeks start Monday (FR-075). Run date =
  local date of start; start time is dropped in the processor.
- **Treadmill** (owner decision 2026-10-17): intervals.icu type `VirtualRun` -> `type: indoor`,
  `treadmill: true`; `trainer: true` on a non-`VirtualRun` run -> `type: indoor` without
  `treadmill`. Treadmill runs count toward totals, the training build, the this-week snapshot and
  the run list, labelled "Treadmill", never get a race track; not PB- or race-time-goal-eligible unless
  the owner sets `include_in_records: true` in `run-overrides.yaml`.
- **Fitness/fatigue (training load)**: published from intervals.icu wellness `ctl` (fitness) and
  `atl` (fatigue); form = ctl - atl is derived at build time. Labelled as intervals.icu's model,
  never as Garmin's training load.
- **Manual Garmin figures**: `owner/manual-metrics.yaml` holds dated (`as_of`) training-status and
  race-prediction entries; the latest entry is "current", earlier ones are the trend. Read at build
  only (owner data, not ingested).
- **Run IDs (opaque)**: public IDs are `YYYY-MM-DD-xxxx` (local run date + 4 random base32
  characters `[a-z2-7]`, drawn with `secrets`, collision-checked per date) assigned at first sight
  by `process/run_ids.py`. The provider-ID -> public-ID map is **append-only** in private R2
  (`state/run-ids.json`, written with `if_match`); an ID is never reassigned, and `process` aborts
  if the map is unreadable rather than regenerating it. Provider activity IDs and URLs
  (intervals.icu IDs, Garmin `external_id`s) are **never** published (data files, URLs, HTML,
  manifest, logs): an activity link can expose a training run's GPS if the provider's privacy
  settings allow it. Owner files reference runs by public ID (copy it from the run page URL).
  Titles are generated neutral: "Run · 8.2 km" (a run-type word such as "Easy run" only where the
  provider supplies a workout type; intervals.icu does not supply Garmin training effect).
  Free-text provider `name`/`description` are never published for training runs.
- **Reprocessing**: processor is deterministic and idempotent with a manifest of input hashes
  (raw object ETag + relevant override hash), so owner edits (hide run, race designation,
  exclusions) reprocess only affected runs and re-publish.
- **Duplicate races (spec edge case: each race appears once)**: a hand-entered race (`race.yaml`
  without `run_id`) whose date matches a recorded race run (same date, distance within 2%)
  **fails validation** with a message telling the owner to add `run_id: <id>` instead; there is no
  fuzzy auto-merge. A `race.yaml` that references `run_id` is the single entry for that race and
  its official details (name, time, distance, position) take precedence over device values.
- **Upcoming-race state machine** (drives hero + upcoming list): `upcoming` (date > today) ->
  `race day` (date = today) -> `awaiting result` (date < today, no `result_ref`) -> `completed`
  (owner sets `result_ref` to a race slug; the race leaves the upcoming list and the hero shows
  the result). Evaluated at build in Europe/London, so the daily rebuild flips states.
- **Owner section settings**: `data/running/owner/section.yaml` holds the focus race, build start
  date, optional story link (hidden until set), stale threshold (default 12 h), featured-goal
  limit (default 6) and recent-highlight durations (default 14 days for PBs and for newly achieved
  goals, per US4.7/FR-042). Defaults live in the schema, so an absent file/field is valid.
- **Race photo / map privacy**: race GPS may be trimmed at start/end by `trim_ends_m` in the race
  override (default 0; races start at public venues) or hidden entirely.

---

## R12. Constitution/norm friction noted

- Principle V "Every data-driven view MUST show when its data was last updated" combined with
  static hosting required the freshness Worker (R9); this is within "serverless functions
  allowed" and needs no amendment.
- Bot commits to `main` (R9) contradict the PR norm literally; the scoped exception was confirmed
  by the owner on 2026-10-04. Logged as an upstream candidate.
