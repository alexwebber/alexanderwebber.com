# Research: Running Section

**Feature**: 001-running-section | **Date**: 2026-10-04 | **Plan**: [plan.md](plan.md)

All versions below were checked against the npm / PyPI registries and GitHub on 2026-10-04
(project norm: research before choosing dependencies; start new dependencies on their current
release). "Verify in spike" marks anything that cannot be settled from documentation alone.

Local toolchain found: Node 24.15.0, Python 3.12.10, uv 0.11.7 (current 0.12.23; routine bump,
skipped), gh 2.90.0.

---

## R0. The open risk: Garmin access from GitHub Actions (first spike)

**State of the art (2026-10-04)**

- `garminconnect` **0.3.17**, released 2026-09-29 (PyPI), requires **Python >= 3.12**. Actively
  maintained (commits the same day). No longer built on `garth`; uses the mobile SSO flow
  (service ticket exchanged at `diauth.garmin.com` for access + refresh tokens), a multi-strategy
  login that uses `curl_cffi` TLS impersonation, auto-refreshing tokens, tokens stored in
  `~/.garminconnect/garmin_tokens.json` (0600, atomic writes, file locking), and a `GARMINTOKENS`
  env var for CI.
- Garmin added Cloudflare TLS fingerprinting in March 2026 that blocks plain non-browser HTTP
  clients (`requests`, curl, Node fetch). Accounts that retry logins repeatedly get **HTTP 429 for
  48+ hours** (Garmin developer forum report). Pacing and never hammering logins are essential.
- Open upstream issue **#444** (2026-09-28): login uses `curl_cffi`, but the *data* calls use a
  plain `requests.Session`, so a valid token still gets **403** from Cloudflare on every
  `connectapi` call. Reporter's workaround:
  `client.client._api_session = curl_cffi.requests.Session(impersonate="chrome")`. No maintainer
  reply yet. The report frames it as fingerprint-based, not IP-based; whether datacenter IPs are
  additionally blocked is **not confirmed by anyone**.
- Only 2 open issues upstream in total; the project is healthy but the exact failure mode we care
  about is live.

**Conclusion**: cannot be settled by reading. It is the explicit **Spike 0** of the plan (see
plan.md), with concrete pass criteria below. Likely outcomes: (a) works from Actions with the #444 workaround applied inside our
adapter; (b) login works but IP blocked -> fallback; (c) neither works -> fallback.

**Design consequence (decided now so the outcome does not change the architecture)**: the
pipeline is split in two stages with a private R2 bucket between them:

1. **fetch** (needs Garmin) — Garmin -> raw JSON in private R2. Runs either on GitHub Actions
   (primary, if Spike 0 passes) or on the owner's Windows PC via Task Scheduler (fallback).
2. **publish** (never touches Garmin) — R2 raw -> normalise -> sanitise -> committed JSON ->
   validate -> build -> deploy. Always runs on GitHub Actions.

Switching between them is a repo variable (`FETCH_MODE=actions|pc`) plus a scheduled task; nothing
downstream changes. Backfill of the full history is run locally on the PC regardless (long,
rate-limited, resumable), then incremental fetches are cheap.

**Token persistence**: the token file lives in R2 as **`state/garmin_tokens.enc`**, encrypted with
**Fernet** (`cryptography` 50.0.2; key = GitHub secret `GARMIN_TOKEN_KEY`, generated once by
`awingest keygen`). Each fetch downloads and decrypts it into a run-scoped temp directory, calls
`login(tokenstore)`, does its work, and **re-encrypts and re-uploads if the file's hash changed**
(rotated refresh token), using `put(if_match=etag)` so a stale writer cannot overwrite a newer
token. GitHub secrets cannot be rewritten by a workflow without a PAT, so R2 is the simplest
durable store, shared by Actions and PC modes. A workflow `concurrency` group (`refresh`, never
cancelling) serialises runs so two never refresh the token at once. Garmin email/password are
secrets used only if the tokens are rejected, at most once per 6 h; a failed login records
`login_blocked_until` (>= 6 h back-off) in R2 state so we never retry-storm into a 429 lockout.
Owner has no MFA, so re-auth is non-interactive; the first token is created by `awingest login`
on the owner's PC (password via `getpass`).

### Spike 0 pass criteria (supersedes the earlier 3-runs-in-24 h sketch)

Throwaway code under `spikes/garmin/`; the harness mimics the real fetch (decrypt -> login -> a few
calls -> re-encrypt/upload if rotated).

| Step | What | Pass criterion |
|---|---|---|
| S0.1 | `workflow_dispatch` on `ubuntu-latest`: password login once, encrypted tokens to R2 | login succeeds, no 403/429 |
| S0.2 | Token-only login, both API sessions (plain `requests` vs `curl_cffi` per #444) against the endpoint checklist below | every required endpoint returns 200 with at least one session |
| S0.3 | **Scheduled every 2 h for 48 h** (`17 */2 * * *`), token-only, re-uploading rotated tokens | **>= 23 of 24 runs succeed**; the rotated token persisted by run *n* is the one used by run *n+1* (no re-login needed); no 429 |
| S0.4 | Payload samples written to **R2 only** (never git) to design adapter fixtures | samples present in R2 |

Endpoint availability checklist (each recorded as available / absent / needs-other-session):
activities list; activity details + splits + HR zones; **running dynamics** (GCT, vertical
oscillation/ratio); **running power**; **Garmin Index body composition** (weight, body fat);
**HRV**; **training status** + load; **VO2 max**; **race predictions**; resting HR. Missing
*optional* items (dynamics, power) only mean those panels are omitted (FR-048); missing
*required* items (activities, splits, weight, body fat, VO2 max, race predictions) feed the plan
back for a decision.

**Outcome rule**: pass -> `FETCH_MODE=actions`. Fail (any persistent 403/429 from Actions that does
not occur locally, or < 23/24, or tokens not surviving rotation) -> `FETCH_MODE=pc`: a Windows Task
Scheduler job on the owner's PC runs `uv run awingest fetch && gh workflow run refresh.yml` every
2 h; nothing downstream changes. Record the outcome in `PROJECT_MEMORY.md`.

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
supports TS 7. A decisions-log entry in `PROJECT_MEMORY.md` is required (house norm for pinning a
core component) - flagged to the owner/orchestrator in the plan hand-off.

**DNS**: domain stays registered at Namecheap; nameservers move to Cloudflare so the Worker can
serve the custom domain (owner action; in quickstart). Alternative (CNAME-only) is not supported
for an apex domain on Workers without Cloudflare DNS.

---

## R2. Raw archive and "safe to publish" storage

Owner decision: raw Garmin data (training GPS, start times, unapproved metrics) never goes in git.

| Option | Cost | Fit |
|---|---|---|
| **Cloudflare R2 (private bucket)** | 10 GB-month free, 1M Class A + 10M Class B ops free, **zero egress**; $0.015/GB-mo beyond | Same vendor as hosting, S3-compatible (boto3), Worker binding for the freshness endpoint. Raw history of several thousand runs with streams is well under 10 GB |
| Backblaze B2 / S3 | Pennies | Extra vendor/account for no gain |
| Private git repo / LFS | Free-ish | Splits the "own your data" store across two repos; LFS quotas |
| Encrypted blobs in the public repo | Free | Violates "nothing committed that is not meant to be public" in spirit; key management burden |

**Decision: R2**, accessed with `boto3` 1.43.108 through the S3 API from Python (Actions/PC) and
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
| Python | >= 3.12 (3.12.10 local) | Required by garminconnect |
| `garminconnect` | **0.3.17** (2026-09-29) | Spec decision. Pinned exactly; bumps reviewed because it is an unofficial client |
| `curl_cffi` | **0.16.3** (2026-09-02) | Required for login strategies and the #444 workaround |
| `boto3` | **1.43.108** (2026-10-02) | R2 via S3 API; `moto` 5.2.3 for tests |
| `cryptography` | **50.0.2** | Fernet encryption of the Garmin token file stored in R2 |
| `jsonschema` | 4.26.0 | Validate published output against the shared JSON Schemas (contract tests) |
| `pyyaml` | 6.0.3 | Read owner YAML overrides in the processor |
| `pytest` | 9.1.1 | Tests |
| `ruff` | 0.16.10 | Lint/format |
| `uv` | 0.12.23 current (0.11.7 local) | Env + lockfile; local bump is routine, skipped unless it bites |

FIT parsing is **not** needed (and `garmin-fit-sdk` is not adopted): Garmin's activity "details" endpoint returns per-sample metrics
(distance, speed, HR, cadence, elevation, power, GPS) as JSON. `fitparse` is unmaintained (last
release 2020) and `fitdecode` is only a fallback if the details payload lacks something
(Spike 0 inventories this). No pydantic: schemas live as JSON Schema (below) and Python uses typed
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
- **Manual refresh (FR-003)**: `workflow_dispatch` with optional `reimport_from` / `reimport_to`
  inputs (FR-008 re-import). Agent runs `gh workflow run`; owner never needs to.
- **Daily rebuild**: two crons (`5 23 * * *` and `5 0 * * *` UTC) so the UK date rolls correctly
  across BST/GMT; re-deploys so "days to Brighton" and the OG image are right even if no data
  changed. A <1 KB inline script also corrects countdowns client-side.
- **Freshness / staleness (FR-005/006)**: a data-less successful poll must still advance "last
  refreshed" but must not create a git commit every 2 hours. R2 holds
  `public/freshness.json`; a tiny Worker route `/running/api/freshness` serves it; a small script
  updates the "Last updated" line and shows the >12 h notice. Without JS the page shows the
  build-time value labelled "as of last site update" (graceful, FR-074).
- **Owner alerts (FR-010, owner decision 2)**: the workflow's last step opens a GitHub issue
  (`ingest-failing` label, likely-cause + action text) when `last_success` is > 24 h old, updates
  it while failing, and comments + closes it on recovery. Uses `GITHUB_TOKEN`
  (`issues: write`); no extra service. Failure classes map to actions: auth rejected ->
  re-authorise; 403/Cloudflare -> check library issue #444 / bump; 429 -> wait (back-off
  active); R2 error -> check credentials. The full failure-class -> owner-action table is in
  [contracts/pipeline.md](contracts/pipeline.md).
- **Commits by the ingest job**: the publish job commits sanitised data straight to `main` as
  `github-actions[bot]` **only after** validation + build pass, then deploys in the same
  workflow (commits pushed with `GITHUB_TOKEN` do not trigger other workflows, so deploy must be
  a job here, not a separate workflow). This is a deliberate, narrow exception to the "PRs not
  direct commits" norm (machine-generated data, gated by the build gate per constitution);
  **flagged for owner confirmation**. Humans/agents editing code or owner files still use PRs.

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
(constitution: broader CI deferred). **Proposal for the owner**: path-filtered test jobs on PRs
(`ingest/**` -> pytest; shared/section code -> Vitest; templates -> Playwright + axe) as the
BACKLOG "Broader CI" revisit now that shared surface exists; not adopted unless confirmed.
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
- **Treadmill**: `treadmill_running` / indoor flag counts toward totals, not PBs/goals unless the
  owner sets `include_in_records: true`.
- **Run IDs (opaque)**: public IDs are `YYYY-MM-DD-xxxx` (local run date + 4 random base32
  characters `[a-z2-7]`, drawn with `secrets`, collision-checked per date) assigned at first sight
  by `process/run_ids.py`. The Garmin-ID -> public-ID map is **append-only** in private R2
  (`state/run-ids.json`, written with `if_match`); an ID is never reassigned, and `process` aborts
  if the map is unreadable rather than regenerating it. Garmin activity IDs and URLs are **never**
  published (data files, URLs, HTML, manifest, logs): an activity link can expose a training run's
  GPS if the owner's Garmin privacy settings allow it. Owner files reference runs by public ID
  (copy it from the run page URL). Titles are generated neutral: "Easy run - 8.2 km" (run type from training effect /
  workout type, else "Run").
- **Reprocessing**: processor is deterministic and idempotent with a manifest of input hashes
  (raw object ETag + relevant override hash), so owner edits (hide run, race designation,
  exclusions) reprocess only affected runs and re-publish.
- **Duplicate races (spec edge case: each race appears once)**: a hand-entered race (`race.yaml`
  without `run_id`) whose date matches a Garmin-recorded race run (same date, distance within 2%)
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
- Bot commits to `main` (R9) contradict the PR norm literally; scoped exception proposed, owner to
  confirm. Logged as an upstream candidate.
