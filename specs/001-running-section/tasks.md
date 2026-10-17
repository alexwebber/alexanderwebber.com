---

description: "Task list for the Running section (001-running-section)"
---

# Tasks: Running Section

**Input**: Design documents from `/specs/001-running-section/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (README, data-files,
pipeline, provider-adapter, routes, storage), quickstart.md

**Tests**: Test tasks ARE included. The constitution (Principle II(a)) and plan.md's
*Graduation plan* require solid contract coverage **by graduation**. Tests are written
**alongside or straight after** implementation. Test-first/TDD is NOT required, so test tasks come
after the code they cover in each phase. Suites run locally, at each graduation review, and on PRs
through the path-filtered `tests.yml` jobs (adopted by the owner on 2026-10-04, T044). They are
**not** part of the build gate. The gate is site build + data-schema validation, with the privacy
scan, image scan and boundary check as validation steps, and it exists from day one (T042).

**Owner decisions reflected here (confirmed 2026-10-04, see PROJECT_MEMORY.md)**:

1. The publish job commits sanitised data **straight to `main`**, and only **after the build gate
   passes**. Only paths under `data/running/published/` may be in that commit. This is a
   deliberate, narrow exception to the PR norm (T067).
2. **Path-filtered PR test jobs (`tests.yml`) are adopted** (T044). Full lint on every change stays
   deferred (BACKLOG).

**Organization**: Tasks are grouped by user story so each story is an independently shippable
slice. Owner-only tasks are written as **OWNER:** and are never hidden inside agent tasks. The
agent prepares everything around them and asks for them during reviews the owner is already doing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story the task belongs to (US1–US5, numbered as in spec.md)
- **OWNER:** marks a task only the owner can do (account access, credentials, personal facts)

## Path Conventions (from plan.md)

- Site (TypeScript/Astro): `astro.config.mjs`, `src/shared/**` (shared plumbing),
  `src/sections/running/**` (self-contained section), `src/worker/freshness.ts`
- JSON Schemas (single source of truth): `schemas/published/`, `schemas/owner/`
- Data: `data/running/published/` (bot-written, sanitised), `data/running/owner/` (hand-edited YAML)
- Ingest (Python, uv): `ingest/src/awingest/**`, `ingest/tests/**`
- Tooling scripts: `scripts/`; TS tests: `tests/{unit,contract,e2e,a11y}/`
- Throwaway spikes: `spikes/` (unconstrained, Principle I)
- Workflows: `.github/workflows/`, composite gate action `.github/actions/gate/`

---

## Phase 1: Setup (owner prerequisites, Spike 0, Spike 1, scaffold)

**Purpose**: Answer the open risk first (Spike 0), with Spike 1 and the scaffold alongside it.

### 1a. Owner prerequisites (from quickstart.md §0; the agent walks the owner through each)

- [ ] T001 OWNER: Create the Cloudflare account. Create a **private** R2 bucket and an R2 API token scoped to it (Object Read & Write). Store the values as GitHub Actions secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` (the agent supplies the `gh secret set` commands, and the owner pastes the values). Also set them as user environment variables on the owner's PC for local spike and backfill runs. Nothing goes in a repo file. **Blocks Spike 0 (T005+).**
- [ ] T002 OWNER: Create a Cloudflare **Workers deploy API token**. Store it and the account ID as GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. **Blocks Spike 1a (T014) and every deploy job.**
- [ ] T003 OWNER: Store the Garmin credentials as GitHub Actions secrets `GARMIN_EMAIL` and `GARMIN_PASSWORD`. They are used only for the refresh workflow's fallback re-login, at most once per 6 h. **Blocks T067.**
- [ ] T004 OWNER: Move the `alexanderwebber.com` nameservers from Namecheap to Cloudflare (start early, because propagation takes time). **Blocks go-live (T112) only.**

### 1b. Spike 0: python-garminconnect from GitHub Actions (FIRST; gates the fetch-stage design)

Throwaway code under `spikes/garmin/`. Pass criteria are in research.md R0 and quickstart.md §1.
Raw payloads go to **R2 only**, never to git.

- [ ] T005 Re-verify on PyPI/GitHub that `garminconnect` 0.3.17 and `curl_cffi` 0.16.3 are still current, and check the state of upstream issue #444. Then create the throwaway harness `spikes/garmin/pyproject.toml`, pinning `garminconnect==0.3.17`, `curl_cffi==0.16.3`, `boto3==1.43.108` and `cryptography==50.0.2` (or newer if the check finds a release that matters). Create `spikes/garmin/probe.py` with these subcommands:
  - `keygen`: prints a Fernet key and never writes it to disk.
  - `login`: one password login via `getpass`; honours back-off; encrypts the token file and uploads it to R2 as `state/garmin_tokens.enc`.
  - `fetch`: downloads and decrypts the tokens into a run-scoped temp dir, does a token-only login, runs the endpoint checklist with both the plain `requests` session and the `curl_cffi` `impersonate="chrome"` session (#444), then re-encrypts and re-uploads the tokens only if their hash changed (`if_match`). It writes payload samples to R2 `spikes/samples/` and a JSON run summary to R2 `spikes/runs/`.
- [ ] T006 Generate the token key with `probe.py keygen`, piped straight into `gh secret set GARMIN_TOKEN_KEY` and into the local user environment. The key is never written to a file.
- [ ] T007 OWNER: Run the single local password login on the owner's PC: `uv run --project spikes/garmin python spikes/garmin/probe.py login` (password at the `getpass` prompt; **one attempt only**; on a 429, stop and wait at least 6 h). This puts `state/garmin_tokens.enc` in R2.
- [ ] T008 Run `probe.py fetch` locally, token-only. Record the endpoint checklist in `spikes/garmin/RESULTS.md`, marking each endpoint as available, absent, or needs the `curl_cffi` session: activities list; activity details + splits + HR zones; running dynamics; running power; Garmin Index body composition; HRV; training status + load; VO2 max; race predictions; resting HR. If data calls return 403, apply the #444 workaround and re-test.
- [ ] T009 Create the throwaway workflow `.github/workflows/spike-garmin.yml`:
  - Triggers: `workflow_dispatch` and `schedule: '17 */2 * * *'`.
  - `concurrency: { group: garmin-token, cancel-in-progress: false }`.
  - Runs on `ubuntu-latest` with Python 3.12 + uv, using secrets `GARMIN_TOKEN_KEY` and `R2_*`, and runs `probe.py fetch`.
  - No artifacts that contain payloads.

  **Scheduled workflows only run from the default branch**, so raise this as a small PR. The owner merges it in normal review.
- [ ] T010 S0.2: dispatch `spike-garmin.yml` once. Pass means every required endpoint returns 200 with at least one session. Add the Actions results to `spikes/garmin/RESULTS.md`.
- [ ] T011 S0.3: let the schedule run for **48 h (24 runs)**, then evaluate the R2 `spikes/runs/` summaries. Pass requires all of:
  - **at least 23 of 24 runs succeed**
  - the token rotated by run *n* is the one run *n+1* uses, with no password re-login
  - no 429
  - no persistent 403 from Actions that does not also occur locally
- [ ] T012 Decide and record the Spike 0 outcome:
  - **Record**: write it in `PROJECT_MEMORY.md` (a decisions-log entry, and resolve the matching *Open questions* item).
  - **Set the mode**: run `gh variable set FETCH_MODE --body actions` (pass) or `--body pc` (fail).
  - **Adapter inputs**: record the chosen #444 data-session flag and the endpoint checklist in `specs/001-running-section/research.md` R0 (*Outcome*) for the adapter tasks.
  - **Clean up**: remove `.github/workflows/spike-garmin.yml` via PR so the schedule stops.
  - **Blocker**: if any *required* endpoint (activities, splits, weight, body fat, VO2 max, race predictions) is absent, STOP and raise it with the owner before T051–T055.

### 1c. Spike 1 (parallel with Spike 0)

- [ ] T013 [P] Spike 1b, size and build time:
  - **Data**: in `spikes/scale/`, generate 5,000 synthetic runs shaped like `published/runs` (each series `<= 600 points`).
  - **Size**: measure the total JSON size against the ~150 MB estimate.
  - **Build**: time a dummy Astro build of 5,000 run pages.
  - **Record**: write the results in `PROJECT_MEMORY.md`.
  - **If over budget**: change the downsample cap in plan.md before T062.
- [ ] T014 [P] Spike 1a, Workers file limit:
  - **Deploy**: in `spikes/workers-limit/`, deploy a 12,000-file dummy static-asset set with wrangler 4.147.0 to a throwaway `*.workers.dev` Worker.
  - **Confirm**: check the free plan's per-version file limit (believed to be 20,000).
  - **Clean up**: delete the throwaway Worker.
  - **Record**: write the result in `PROJECT_MEMORY.md`.
  - **Depends on**: T002.

### 1d. Scaffold (can start in parallel with Spike 0; nothing here depends on its outcome)

- [ ] T015 Update the spec docs to match the owner's 2026-10-04 decisions:
  - **Text to remove**: "proposal, not adopted" (tests.yml) and "needs owner confirmation" (bot commits to `main`).
  - **Where**: `specs/001-running-section/plan.md` (Constitution Check, Project Structure, Graduation plan, Complexity Tracking), `research.md` R9/R10/R12, `contracts/pipeline.md` and `quickstart.md` §4.
- [ ] T016 Run `C:\Projects\sdd-playbook\scripts\check-versions.ps1`. Re-verify the npm and PyPI pins in plan.md *Primary Dependencies* (current release unless deliberately pinned; TypeScript stays at **6.0.3** because `@astrojs/check` 0.9.10 peer-requires `^5 || ^6`). Log any change in the `PROJECT_MEMORY.md` decisions log.
- [ ] T017 Create the root TypeScript project:
  - **`package.json`**:
    - `"type": "module"` and `engines.node >=22.12`.
    - Scripts: `dev`, `gen-types`, `build` (= `astro check && astro build`), `preview`, `validate-data`, `scan-images`, `check-boundaries`, `scan-privacy`, `test` (= `vitest run`), `e2e` (= `playwright test`).
    - Exact pins: astro 7.3.5, typescript 6.0.3, @astrojs/check 0.9.10, @astrojs/sitemap 3.7.4, sharp 0.35.5, satori 0.35.0, ajv 8.20.0, yaml 2.9.1, json-schema-to-typescript 16.0.0, maplibre-gl 6.12.0, wrangler 4.147.0. Dev: vitest 5.0.3, @playwright/test 1.63.0, @axe-core/playwright 4.13.0, lighthouse 13.5.0.
  - **`tsconfig.json`**: Astro strict.
  - **`.gitignore`**: add `node_modules/`, `dist/`, `.astro/`, `.env*`, `ingest/.venv/`, `__pycache__/`, `playwright-report/`, `test-results/`, `src/shared/storage/generated/`, `spikes/**/out/`.
- [ ] T018 Create the Running integration skeleton in `src/sections/running/integration.ts`:
  - It exports an Astro integration with a **route registry**: each area registers its routes when its story ships, and the section nav and landing links read the registry. Unshipped areas are therefore never linked (FR-027 holds without dead links between increments).
  - Also create the empty `src/sections/running/{pages,components,domain,data,og}/` directories.
- [ ] T019 Create `astro.config.mjs` (`output: 'static'`, `site: 'https://alexanderwebber.com'`, `trailingSlash: 'always'`, integrations `[sitemap(), running()]`) and a placeholder site home `src/pages/index.astro` that leads to `/running/`. Depends on T017 and T018.
- [ ] T020 [P] Create `wrangler.jsonc`:
  - Worker `main: src/worker/freshness.ts`.
  - Static assets `directory: ./dist`.
  - An R2 binding `FRESHNESS` to the private bucket (the Worker reads only `public/freshness.json`).
  - The current `compatibility_date`.
- [ ] T021 [P] Create the Python uv project `ingest/pyproject.toml`:
  - `requires-python >=3.12`.
  - Exact pins: `garminconnect==0.3.17`, `curl_cffi==0.16.3`, `boto3==1.43.108`, `cryptography==50.0.2`, `jsonschema==4.26.0`, `pyyaml==6.0.3`. Dev: `pytest==9.1.1`, `moto==5.2.3`, `ruff==0.16.10`.
  - A `[project.scripts] awingest` entry point.
  - Also create `ingest/uv.lock`, `ingest/src/awingest/__init__.py` and `ingest/tests/conftest.py`.
- [ ] T022 [P] Create `vitest.config.ts`, `playwright.config.ts` (a 360 px mobile project plus desktop; `webServer` = `astro preview`) and the empty `tests/unit/`, `tests/contract/`, `tests/e2e/` and `tests/a11y/` directories.

**Checkpoint**: Spike 0 decided (`FETCH_MODE` set), Spike 1 recorded, scaffold builds an empty site.

---

## Phase 2: Foundational (blocking prerequisites for every user story)

**Purpose**: The schemas, storage layer, build gate, the full ingest → sanitise → publish pipeline,
freshness, alerts and the shared shell. Every story renders from this.

**CRITICAL**: No user-story work can begin until this phase is complete. The fetch-stage tasks
T051–T055 also need Spike 0's outcome (T012).

### 2a. JSON Schemas (contract; single source of truth for Python and TypeScript)

Every schema uses draft 2020-12 and **`additionalProperties: false` everywhere**. Owner schemas
are strict as well (a typo such as `offical_time` is an error, not ignored). Every file carries a
`schema_version` (required in published files; optional in owner files, defaulting to current).

- [ ] T023 [P] Create `schemas/published/run.schema.json`:
  - `id` matches `^\d{4}-\d{2}-\d{2}-[a-z2-7]{4}$`.
  - `date` is `YYYY-MM-DD` with **no time of day**.
  - `type` enum is `road|track|trail|indoor`.
  - `is_race`, `title`, `note?`, `distance_m`, `moving_s`, `elapsed_s`, `elevation_gain_m?`, `elevation_loss_m?`, `avg_pace_s_per_km` and `best_pace_s_per_km`.
  - `hr {avg,max}?`, `cadence_avg?`, `stride_m_avg?`, `power_w_avg?`.
  - `dynamics?` (gct, balance, vertical oscillation, vertical ratio) and `training_effect {aerobic,anaerobic}?`.
  - `splits [{km, time_s, pace_s_per_km, hr?, elev_delta_m?}]` and `hr_zones [{zone, seconds}]?`.
  - `series {x_dist_m[], x_elapsed_s[], pace[], hr?[], elev?[], cadence?[], power?[]}`, every array `maxItems: 600`, no lat/lon.
  - `best_efforts [{distance_m, label, time_s, plausible}]`, `flags {excluded_from_records?, include_indoor_in_records?}` and `track_ref?`.
- [ ] T024 [P] Create `schemas/published/race-track.schema.json`: `{id, points: [[lat,lon,dist_m,elev_m]] (maxItems ~1000), trim_ends_m, bbox, source}`. This is the **only** schema allowed to contain coordinates.
- [ ] T025 [P] Create `schemas/published/health-series.schema.json`:
  - `{metric, unit, points: [{date, value, ...}]}`, with points sorted by date.
  - `metric` enum is exactly the approved list: `vo2max`, `training_status`, `training_load`, `race_prediction_5k`, `race_prediction_10k`, `race_prediction_half`, `race_prediction_marathon`, `resting_hr`, `hrv`, `weight_avg7`, `body_fat_pct`.
  - `hrv` points also carry baseline low/high.
  - Individual weights cannot be expressed in this schema.
- [ ] T026 [P] Create `schemas/published/refresh.schema.json` (`{sources: {garmin: {last_data_change_at, last_success_at_build}}, generated_at}`) and `schemas/published/manifest.schema.json` (`{runs: {<run-id>: {input_hash, path, hidden?}}, health: {...}, schema_version, processed_at}`).
- [ ] T027 [P] Create `schemas/owner/section.schema.json`:
  - `focus_race: {race_id, build_start, charity: {name}}` is required.
  - Optional fields with defaults: `story_link?: {href, label}`, `stale_after_hours` (default 12), `featured_goal_limit` (default 6), `recent_highlight_days: {pb: 14, goal: 14}`.
  - An absent file or field is valid apart from `focus_race`.
- [ ] T028 [P] Create `schemas/owner/goals.schema.json`. Each item is `{id, type, title, description?, priority, featured, deadline?, start_value?, created?, linked_race?, status_override?, retired?, achieved_override?{date, note?}, target}`:
  - `type` is `race_time|body_composition|metric|milestone`.
  - `target` depends on the type:
    - race_time: `{distance_m|distance, time}`
    - body_composition: `{metric: weight_kg|body_fat_pct, value, direction: at_most|at_least}`
    - metric: `{metric: vo2max|resting_hr|hrv|..., value, direction}`
    - milestone: none
  - `created?` (YYYY-MM-DD) is added to support the "first reading on or after goal creation" baseline rule. If it is absent, the first reading in the series is used.
- [ ] T029 [P] Create `schemas/owner/upcoming-races.schema.json`: a list of `{id, name, date, distance_m|distance, target_time?, url?, result_ref?}`.
- [ ] T030 [P] Create `schemas/owner/race.schema.json`:
  - `{slug, run_id?, name?, date, distance, official_time?, official_distance_m?, position?, results_url?, note?, hide_map?, trim_ends_m?, designate?, photos: [{file, description, caption?}]}`.
  - `run_id` uses the opaque pattern.
  - `trim_ends_m` defaults to 0.
  - `designate` is `race|not_race`.
  - Photo `description` has `minLength 1`.
- [ ] T031 [P] Create `schemas/owner/run-overrides.schema.json` (a list of `{id, title?, note?, hide?, exclude_from_records?, include_in_records?, is_race?}`) and `schemas/owner/health-exclusions.schema.json` (a list of `{metric, date, reason?}`, using the goal metric names, e.g. `weight_kg`).
- [ ] T032 [P] Create `schemas/owner/lab.schema.json`: `{date, type: dexa|lab_vo2max, provider, values: {body_fat_pct?, weight_kg?, vo2max?}}`. **Only those three value keys are allowed; any other key fails validation (FR-066).**
- [ ] T033 Create shared schema fixtures `schemas/fixtures/<schema>/{valid,invalid}/*` used by both languages. They include cases showing that **no `lat|lon|latitude|longitude|start_time|startTime` key validates outside race-track**, plus invalid owner cases (`time: "3:7x"`, unknown key, missing photo description, lab `bone_density`).
- [ ] T034 Create `scripts/gen-types.ts`, which generates TypeScript types from `schemas/**` into `src/shared/storage/generated/` with json-schema-to-typescript 16.0.0. Wire it as the `prebuild` and `pretest` npm hooks. Depends on T023–T032.

### 2b. Shared formatting and storage (TypeScript)

- [ ] T035 [P] Create `src/shared/format/`:
  - `parse.ts`: owner time strings `h:mm:ss` or `mm:ss`, parsed and range-checked; distance names `5k, 10k, 10mi, half, marathon, 1k, 1mi, 3k, 15k, 20k, 30k` or metres.
  - `dates.ts`: UK format (e.g. "4 Apr 2027"); Europe/London local dates; weeks start on Monday; days-between that is correct across BST/GMT changes.
  - `units.ts`: km, min/km pace, `h:mm:ss` durations, kg (FR-075).
- [ ] T036 Create the `RunningStore` interface in `src/shared/storage/running-store.ts`: `listRuns()` (newest first), `getRun(runId)`, `getRaceTrack(runId)`, `getHealthSeries(metric, range?)`, `getRefreshRecord()`, `getOwner()`.
- [ ] T037 Create `JsonFileStore` in `src/shared/storage/json-file-store.ts`:
  - It reads `data/running/`, parses YAML with yaml 2.9.1 and validates every file with ajv 8.20.0 (draft 2020, `useDefaults` for owner schemas).
  - It throws `DataValidationError {file, entry, field, message}` and memoises per build.
  - Depends on T034 and T036.
- [ ] T038 Create `scripts/validate-data.ts`, which validates every published and owner file. It also runs these referential checks (contracts/data-files.md):
  - a goal's `linked_race` exists
  - `section.yaml` `focus_race.race_id` exists in the upcoming races
  - an upcoming race's `result_ref` names an existing race entry
  - a race's `run_id` exists in published runs (a warning if the run is not yet ingested)
  - an override's `id` exists
  - photo files exist
  - ids are unique
  - at most `featured_goal_limit` goals are featured, and priorities are unique among featured goals
  - **duplicate race**: a hand-entered race (no `run_id`) that matches a Garmin race run (same date, distance within 2%) is an error telling the owner to add `run_id`
  - at most one entry per `run_id`
  - no Garmin-style activity IDs appear in any owner file

  Errors use the format `data/running/owner/goals.yaml  goal "10k-sub-45"  field target.time: "44:7x" is not a valid time (expected mm:ss or h:mm:ss)`, and the script exits non-zero (FR-070).
- [ ] T039 [P] Create `scripts/check-boundaries.ts`. It scans the import specifiers in `src/**` and fails if `src/shared/**` imports from `src/sections/**`, or if `src/sections/<a>/**` imports from `src/sections/<b>/**` (Principle VII).
- [ ] T040 [P] Create `scripts/scan-images.ts`. It fails on any EXIF, XMP, IPTC or GPS metadata in images under `data/` and `src/` (via sharp `metadata()`). It also enforces owner photos as `.jpg|.webp|.avif` with a long edge of at most 2400 px.
- [ ] T041 [P] Create `scripts/scan-privacy.ts`, which scans `data/` and `dist/` (SC-004) and fails on:
  - ISO datetimes with a time component (`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}`) or `start_time`/`startTime`-style keys in run files and run pages (durations such as `06:42` must not be false positives)
  - coordinates outside `data/running/published/race-tracks/` and race pages
  - sleep, stress or Body Battery keys/terms
  - any `connect.garmin.com` string
  - `activityId`/`garminId`-style keys
  - EXIF in `dist/` images

  When R2 credentials are present, it also loads `state/run-ids.json` and fails on any known Garmin ID found in `data/` or `dist/`.

### 2c. Build gate and CI (gate from day one)

- [ ] T042 Create the composite action `.github/actions/gate/action.yml`. Steps:
  - setup-node (version from `engines`) and `npm ci`
  - `gen-types`
  - `validate-data` and `scan-images`
  - `check-boundaries`
  - `build` (`astro check` + `astro build`)
  - `scan-privacy` (with R2 credentials when passed in)

  It is a composite action, so it runs in the caller's job and workspace. pytest, Vitest and Playwright are **not** part of it.
- [ ] T043 Create `.github/workflows/gate.yml`:
  - Triggers: `pull_request` and `push` to `main`. It runs the gate.
  - On `push` to `main` only, a `deploy` job (`needs: gate`; `wrangler deploy`; `concurrency: { group: deploy, cancel-in-progress: false }`, shared with T067 and T105). No deploy runs on PRs.
  - `permissions: contents: read`.
- [ ] T044 Create `.github/workflows/tests.yml` (**ADOPTED 2026-10-04**: path-filtered PR test jobs):
  - Trigger: `pull_request`.
  - A `changes` job computes the changed paths with `git diff --name-only origin/${{ github.base_ref }}...HEAD` (no third-party action).
  - Jobs and their path filters:
    - `pytest` (`uv run pytest`): `ingest/**` or `schemas/**`
    - `vitest` (`npm test`): `src/**`, `schemas/**`, `scripts/**`, `tests/unit/**` or `tests/contract/**`
    - `playwright` (Playwright + axe against `astro preview`): `src/**`, `data/running/owner/**`, `tests/e2e/**` or `tests/a11y/**`
  - Full lint on every change stays deferred (BACKLOG).
- [ ] T045 Create `scripts/lighthouse-budget.mjs`, which runs the Lighthouse 13.5.0 CLI (mobile) against `astro preview` for each page type. Checks:
  - performance >= 90
  - landing LCP <= 2.5 s
  - JS <= 10 KB gzip (race-map script excepted)
  - HTML+CSS+JS <= 150 KB
  - zero third-party requests on load

  Also create the **non-blocking** `.github/workflows/quality.yml`: Lighthouse + axe on PRs touching site code, and nightly against production.

### 2d. Ingest core (Python): logging, provider contract, archive

- [ ] T046 [P] Create `ingest/src/awingest/logging.py`: structured JSON-lines logs on stderr (`run_id`, `stage`, `provider`, `event`, `error_class`, `code`). It redacts secrets, tokens and email addresses, and **never logs Garmin activity IDs** (data-model §3).
- [ ] T047 [P] Create `ingest/src/awingest/providers/base.py`:
  - The `ActivityProvider`, `HealthProvider` and `Provider` protocols, with `session(archive)` as a context manager.
  - `ActivityRef`, `RawBundle`, `RawHealthDay`.
  - `NormalisedActivity` and `NormalisedHealthReading` dataclasses (fields per data-model §2; a missing optional metric is `None`, **never 0**).
  - The error taxonomy `AuthRejected | LoginBlocked(until) | ProviderForbidden | RateLimited(retry_after?) | ProviderChanged | Transient`, each with a stable `code` plus `likely_cause` and `action` text.
- [ ] T048 [P] Create `ingest/src/awingest/archive/base.py` (the `RawArchive` protocol: `get`, `put(if_match)`, `list`, `exists`, `delete`; key validation with no `..`; `ArchiveUnavailable` and `ArchiveConflict`) and `ingest/src/awingest/archive/local.py` (`LocalArchive`, a directory with atomic writes).
- [ ] T049 [P] Create `ingest/src/awingest/archive/r2.py`: `R2Archive` using boto3 1.43.108 against the S3 endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. It supports conditional `put` with `if_match`, an idempotent re-put of identical bytes, and error mapping. Depends on T048.
- [ ] T050 Create `ingest/src/awingest/archive/tokens.py`, the Fernet token store:
  - It downloads `state/garmin_tokens.enc` and decrypts it with `GARMIN_TOKEN_KEY` into a run-scoped temp dir.
  - It re-encrypts and re-uploads the tokens **only if their hash changed**, using `put(if_match=etag)`.
  - A decrypt failure maps to `TokenStoreUnreadable`.
  - Depends on T048.

### 2e. Garmin adapter and fetch stage (depends on Spike 0 outcome, T012)

- [ ] T051 Create `ingest/src/awingest/providers/garmin/client.py`:
  - Auth via garminconnect 0.3.17 `login(tokenstore)`.
  - The data session (plain or `curl_cffi` per #444) is set **by the flag Spike 0 decided**. This workaround stays adapter-private.
  - One login attempt per run. Password fallback (`GARMIN_EMAIL`/`GARMIN_PASSWORD`) at most once per 6 h, recording `login_blocked_until` (>= 6 h back-off) in `state/fetch-status.json`.
  - Pacing of >= 1 s with jitter between calls.
  - Every library exception is mapped to the taxonomy, so none escapes. Depends on T012 and T047.
- [ ] T052 Create `ingest/src/awingest/providers/garmin/endpoints.py`:
  - Running activities only (road, track, trail, treadmill/indoor; FR-009).
  - Activity summary, details, splits and HR zones.
  - **The approved health metrics only**: vo2max, training-status, training-load, race-predictions, resting-hr, hrv, body-composition. There is **no code path** for sleep, stress or Body Battery (FR-015).
  - It follows the endpoint checklist from T012.
- [ ] T053 Create `ingest/src/awingest/providers/garmin/normalise.py`, a pure (no I/O), deterministic mapping from raw payloads to `NormalisedActivity` and `NormalisedHealthReading`. Units are metres, seconds, kg and bpm; times are converted to Europe/London; types map to `road|track|trail|indoor`; non-run activities are rejected. The provider ID is exposed only as `provider_id`.
- [ ] T054 Create `ingest/src/awingest/fetch.py`, the fetch stage:
  - **Incremental**: lists new or changed activities since `state/cursor.json`, **plus a re-list of the last 14 days** (FR-008); honours `--reimport-from`/`--reimport-to`; supports `--health-only`.
  - **Archiving**: raw payloads are archived verbatim to `raw/garmin/...` before normalisation. It never deletes, and a partial failure is recorded and fetching continues.
  - **Cursors**: they advance only after successful writes.
  - **On success**: updates `state/fetch-status.json` and `public/freshness.json` (only `last_success_at` per source + `generated_at`).
  - **Exit codes**: 0, 10, 11, 12, 13, 14, 1.
- [ ] T055 Create `ingest/src/awingest/backfill.py`, a whole-history backfill. It is chunked, rate-limited and resumable via `state/backfill.json` (`--from`, `--resume`), and is meant to run on the owner's PC.

### 2f. Processor and publish stage (never touches Garmin)

- [ ] T056 [P] Create `ingest/src/awingest/process/run_ids.py` for opaque public run IDs:
  - **Format**: `YYYY-MM-DD-xxxx` (local run date + 4 characters `[a-z2-7]` drawn with `secrets`, collision-checked per date).
  - **Map**: an **append-only** map in R2 `state/run-ids.json`, written with `if_match`. An ID is never reassigned.
  - **Failure**: it **aborts if the map is unreadable** rather than regenerating it.
- [ ] T057 [P] Create `ingest/src/awingest/process/titles.py` for neutral generated titles such as `Easy run · 8.2 km` (run type from training effect or workout type, else "Run"). It **never copies `title_raw` for training runs** (FR-011/012). Races use the owner or Garmin race name. An owner custom title always wins.
- [ ] T058 [P] Create `ingest/src/awingest/process/plausibility.py`. An effort is marked `plausible: false` if its time is below **0.85 × the world record** for the distance (table for every best-effort distance, e.g. 5k < 10:54, 10k < 22:30, half < 50:00, marathon < 1:46:00) **or** if its peak 1 km split is < 2:30/km.
- [ ] T059 [P] Create `ingest/src/awingest/process/best_efforts.py`, a two-pointer sliding window over cumulative distance and elapsed time, with linear interpolation at the window start. It covers 1k, 1mi, 3k, 5k, 10k, 15k, 10mi, 20k, half, 30k and marathon, **plus any goal `race_time` distance** in `goals.yaml`, and attaches plausibility.
- [ ] T060 [P] Create `ingest/src/awingest/process/health.py`, which turns approved-metric readings into published points:
  - `weight_avg7` is the **trailing 7-day mean of non-excluded readings in kg; a day is omitted if there are no readings in the window**. Individual weigh-ins are never output (FR-061).
  - `body_fat_pct` is published as recorded, date only, with multiple readings per day allowed.
  - `hrv` is published with its baseline.
  - Exclusions from `health-exclusions.yaml` are removed before any computation (FR-067).
- [ ] T061 [P] Create `ingest/src/awingest/process/overrides.py`. It reads and jsonschema-validates `run-overrides.yaml`, `health-exclusions.yaml`, `races/*/race.yaml` (`designate`, `hide_map`, `trim_ends_m`) and `goals.yaml` (goal distances), and provides a per-run override hash.
- [ ] T062 Create `ingest/src/awingest/process/sanitise.py`, an **allow-list** sanitiser (data-model §7, rules 1–7):
  - **Construction**: published runs are built field by field.
  - **Times**: `start_local` becomes `date` only, and stream timestamps become elapsed seconds.
  - **Series**: the x axis is distance or elapsed time, downsampled to `<= 600 points`.
  - **Location**: no lat/lon, no `title_raw`, `locationName` or weather station.
  - **Visibility and flags**: hidden runs are **not written at all**; owner flags are mirrored into `flags`; `is_race` comes from the Garmin flag or an owner override (`run-overrides.is_race`, race.yaml `designate`).

  Depends on T056–T061.
- [ ] T063 Create `ingest/src/awingest/publish/writer.py` (`PublishedWriter`):
  - **Validation**: it validates against the schema **before** writing.
  - **Atomic writes**: it writes into a staging directory and swaps.
  - **Path guard**: it refuses any path outside `data/running/published/`.
  - **Formatting**: sorted keys with canonical formatting, so diffs show only real changes.
  - **API**: `remove()` and `commit_plan()`.
- [ ] T064 Create `ingest/src/awingest/publish/manifest.py` and `ingest/src/awingest/process/pipeline.py`:
  - **Incremental**: processing is driven by `input_hash` (raw ETag + override hash), with `--all` and `reprocess --run RUN_ID`.
  - **Hidden runs**: files of newly hidden runs are removed.
  - **Refresh record**: `state/refresh.json` is written only when data changes.
  - **Failure**: `process` **writes nothing if any validation fails** (exit 20).
  - **`publish-check`**: validates the published tree and checks manifest consistency.
- [ ] T065 Create `ingest/src/awingest/alerts.py` and the `alert` command (FR-010, SC-012):
  - **Trigger**: `now - last_success_at(garmin) > 24h`.
  - **Opening**: opens the `ingest-failing` issue titled `Garmin refresh failing since <date>`. The body holds the failure class and code, the sanitised last error, the likely cause, the matching owner/agent action row from contracts/pipeline.md, a link to the failing run and the last good timestamp.
  - **While failing**: adds at most one comment per 24 h.
  - **Recovery**: comments "recovered at <time>" and closes the issue.
  - Uses `GITHUB_TOKEN` (`issues: write`).
- [ ] T066 Create `ingest/src/awingest/cli.py`, wiring the subcommands `login`, `keygen`, `fetch`, `backfill`, `process [--all]`, `publish-check`, `alert` and `reprocess --run RUN_ID`, with `--archive r2|local`. It prints JSON-lines logs on stderr and a summary on stdout, and returns the exit codes in contracts/pipeline.md.

### 2g. Pipeline workflows, freshness Worker, PC fallback

- [ ] T067 Create `.github/workflows/refresh.yml`. It implements **owner decision 1 exactly**:
  - **Triggers**: `schedule: '17 */2 * * *'`, `workflow_dispatch` (inputs `reimport_from`, `reimport_to`), and `push` to `main` with `paths: data/running/owner/**`.
  - **Concurrency**: `concurrency: { group: refresh, cancel-in-progress: false }`.
  - **`fetch` job**: runs only `if: vars.FETCH_MODE == 'actions'`. It runs `uv run awingest fetch` with the `R2_*`, `GARMIN_TOKEN_KEY`, `GARMIN_EMAIL` and `GARMIN_PASSWORD` secrets.
  - **`publish` job**, in this order:
    1. `uv run awingest process` and `publish-check`.
    2. Run the gate composite action (T042), with R2 credentials for the Garmin-ID scan.
    3. **Only if the gate passed**: check that every changed path is under `data/running/published/`, and fail without committing if any other path changed.
    4. Commit as `github-actions[bot]` **straight to `main`**.
    5. Push. If the push is rejected because `main` moved, abort without committing; the next run re-publishes from R2. `permissions: contents: write` on this job only.
  - **`deploy` job**: `wrangler deploy`, only if the gate passed and (a commit was made or owner files changed). `concurrency: deploy`.
  - **`alert` job**: `if: always()`, `issues: write`.
  - **Rulesets**: check `main` rulesets and branch protection (`gh api repos/{owner}/{repo}/rulesets`). If they would block the bot push, propose a bypass limited to GitHub Actions in the PR description for the owner's review. Do not change repo settings unasked.
  - Depends on T003, T042, T066.
- [ ] T068 [P] Create `src/worker/freshness.ts`:
  - `GET /running/api/freshness` reads `public/freshness.json` from the R2 binding.
  - It returns `200 application/json` `{"garmin":{"last_success_at":...},"generated_at":...}` with `Cache-Control: public, max-age=300`.
  - It returns `503` if the object is absent or the read fails.
  - Every other path falls through to the static assets.
- [ ] T069 (Only if T012 chose `FETCH_MODE=pc`.) Create the PC fallback:
  - `scripts/pc-fetch.ps1` runs `uv run awingest fetch` and then `gh workflow run refresh.yml`.
  - `scripts/register-pc-fetch-task.ps1` registers a Windows Task Scheduler job every 2 h. The agent runs it on the owner's PC and tells the owner the PC must be on for refreshes.
- [ ] T070 Production token check: confirm that the token file Spike 0 left in R2 is usable by `awingest`. Run `uv run awingest fetch --health-only` locally. If it is usable, keep it; if not, go to T071.
- [ ] T071 OWNER: (Only if T070 shows the tokens are unusable.) Run `uv run awingest login` once on the owner's PC, entering the password at the `getpass` prompt.

### 2h. Shared shell (shared plumbing)

- [ ] T072 [P] Create `src/shared/design/tokens.css`:
  - Colour (light and dark via `prefers-color-scheme`), type scale, spacing and focus ring.
  - A chart palette validated for WCAG 2.2 AA contrast, applying the `dataviz` skill conventions.
  - Separately, create the Running warm-identity overrides in `src/sections/running/styles/theme.css` (Principle VII).
- [ ] T073 [P] Create `src/shared/layout/Base.astro`, `Meta.astro`, `Nav.astro` and `Footer.astro`. Every page gets:
  - a required unique `title` and `description`
  - a canonical URL
  - OG and Twitter tags with an image prop
  - `lang="en-GB"`
  - a skip link and landmarks
  - a 320 px-first layout

  Also wire `@astrojs/sitemap`.
- [ ] T074 [P] Create the SVG chart primitives in `src/shared/charts/`:
  - `scales.ts` and axes.
  - `LineChart.astro`, `BarChart.astro` and `ProgressBar.astro`.
  - `ChartFigure.astro`: a `<figure>` whose SVG has `<title>`/`<desc>` text alternatives, plus the data table in `<details>`, keyboard reachable (FR-071).
  - `RangeToggle.astro`: CSS-only radio inputs for 3 months / 1 year / all (FR-068).
  - Target-line and labelled reference-marker support.
  - **No client JS.**
- [ ] T075 [P] Create the OG image renderer `src/shared/og/render.ts`: satori 0.35.0 → SVG → sharp 0.35.5 PNG at build time. It uses the bundled Inter font (OFL) in `src/shared/og/fonts/` and provides an `/og/<path>.png` endpoint helper. Also add the site-home OG card for `src/pages/index.astro`.
- [ ] T076 Create the section data and freshness UI:
  - **Loader**: `src/sections/running/data/load.ts`, a typed, validated and memoised loader over `RunningStore`.
  - **`LastUpdated.astro`** (`src/sections/running/components/`):
    - Without JS, it shows the build-time "as of last site update" value from `refresh.json`.
    - An inline script under 1 KB polls `/running/api/freshness`, renders "Last updated <relative>", and un-hides the stale notice once the data is older than `stale_after_hours` (baked in at build). On a 503 it keeps the build-time text (FR-005/006/074).
  - **`SectionLayout.astro`**: the section nav built from the route registry (T018), with a `LastUpdated` slot.

### 2i. Foundational graduation coverage, backfill and first publish

- [ ] T077 [P] Create synthetic, anonymised Garmin fixtures in `ingest/tests/fixtures/garmin/`, shaped from the Spike 0 samples. **No real values are copied into git.** They include:
  - injected sentinel lat/lon, start times, location strings and Garmin IDs for the privacy tests
  - a run with dynamics + power, and a run without them
  - a treadmill run, a race and a non-run activity
  - every approved health metric
- [ ] T078 [P] Create the parameterised storage contract suite `ingest/tests/contract/test_raw_archive.py`, run against `LocalArchive` and `R2Archive` (moto 5.2.3). It covers round-trip, idempotent re-put, `if_match` conflict, key validation, atomicity under injected failure, and a 5,000-object listing.
- [ ] T079 [P] Create the adapter contract suite `ingest/tests/contract/test_garmin_adapter.py`. It covers:
  - required fields, normalised units and type mapping
  - non-run activities rejected
  - missing optional metrics are `None`, never 0
  - Europe/London conversion and determinism
  - the adapter never emits a public ID
  - error mapping to the taxonomy
  - token-store rotation with `if_match`
  - one login per run and the back-off
- [ ] T080 [P] Create `ingest/tests/unit/test_sanitise.py` and `ingest/tests/unit/test_run_ids.py`:
  - exhaustive allow-list tests
  - a **property test** that feeds random raw payloads with sentinels and asserts none appear in the serialised output
  - hidden runs are not written
  - run IDs are stable, append-only and collision-free, and abort when the map is unreadable
  - the processor never emits a provider ID
- [ ] T081 [P] Create `ingest/tests/unit/test_best_efforts.py`, `test_plausibility.py` and `test_health.py`. They cover:
  - a 44:41 continuous 10 km found inside a longer run
  - the plausibility thresholds
  - the weight example `101.2, 100.6, 101.0, 100.4, 100.8, 100.2, 100.5` → `weight_avg7` 100.7
  - an empty window gives an omitted day
  - excluded readings are removed
- [ ] T082 [P] Create `ingest/tests/contract/test_writer.py`, `test_cli.py`, `test_alerts.py` and `test_schemas.py`. They cover:
  - the writer refuses paths outside the published zone and rejects invalid schemas
  - canonical formatting and staging atomicity
  - the CLI exit codes
  - alert open, update and close per failure class (against a fake GitHub API)
  - the shared schema fixtures (T033)
- [ ] T083 [P] Create TS contract tests `tests/contract/schemas.test.ts` (same shared fixtures as T082) and `tests/contract/store.test.ts`. They check the `DataValidationError` shape, newest-first ordering and the speed of listing 5,000 runs.
- [ ] T084 [P] Create TS unit tests `tests/unit/format.test.ts`, `validate-data.test.ts`, `check-boundaries.test.ts`, `scan-privacy.test.ts` and `freshness-worker.test.ts`. They cover:
  - the referential and duplicate-race errors
  - a malformed `"3:7x"` time naming the file, entry and field
  - seeded privacy violations are detected, while durations do not produce false positives
  - the Worker's 200 and 503 paths
- [ ] T085 Run the backfill and first publish:
  1. On the owner's PC, run `uv run awingest backfill` in the background (resumable).
  2. Dispatch `refresh.yml` so the **first publish goes through the real gated bot path**.
  3. For SC-009, compare 20 random published runs with their raw Garmin summaries in R2 (distance, time, HR), and record the result in the PR description.

  Depends on T001, T007/T070, T067.
- [ ] T086 Run the graduation review of the shared plumbing (storage layer, Garmin adapter, sanitiser + run IDs + privacy scan, shared shell):
  - Write short design notes in `src/shared/README.md` and `ingest/README.md`, linking to contracts/.
  - Run `uv run pytest` and `npm test` locally.
  - Carry out an adversarial self-review against Principles II, IV and VI, and summarise it in the PR.

**Checkpoint**: Real sanitised data is in `data/running/published/`, refresh runs every 2 h through
the gate, and the shell renders. User stories can now begin.

---

## Phase 3: User Story 2 - Goals (Priority: P1)

Built first because the P1 landing page (US1) shows featured goals (spec US2 "Why this
priority"; plan.md delivery order).

**Goal**: A Goals page that shows active goals in priority order with progress and Garmin
predictions, celebrates achieved goals, and evaluates achievement automatically from stored data.

**Independent Test**: Define one race-time, one weight, one body-fat and one VO2 max goal and
refresh. Each shows the correct progress. Then add a run containing a qualifying effort: the
matching goal becomes achieved with the right date.

### Implementation for User Story 2

- [ ] T087 [P] [US2] Create the Best Effort index in `src/sections/running/domain/efforts.ts`:
  - **Eligible runs**: not indoor unless `include_in_records`, not `excluded_from_records`, and `plausible: true`.
  - **Also counted**: owner race results (official time wins; hand-entered races included), per FR-035.
  - **Output**: a per-distance list sorted by date.
- [ ] T088 [P] [US2] Create `src/sections/running/domain/composition.ts`. Body fat's trailing 7-day mean is computed at build time from the recorded `body_fat_pct` readings (a day with no readings in the window has no value, and the mean is never stored or shown as the headline). Weight reads the published `weight_avg7`.
- [ ] T089 [US2] Create goal evaluation in `src/sections/running/domain/goals.ts`, following data-model §5:
  - **race_time**: achieved on the first date with an eligible effort `< target` at the goal distance, as `achieved{date, effort, run_id}`.
  - **body_composition**: achieved on the first date the **7-day average** reaches the target in the stated direction.
  - **metric**: achieved on the first date the recorded value reaches the target.
  - **milestone**: only `achieved_override`.
  - **Overrides and stability**: `achieved_override` wins. An achieved goal stays achieved because "first date" is order-based.
  - **Deadline and retirement**: `deadline < today` (Europe/London) gives `deadline_passed`. `retired` goals are hidden.
  - **Progress**:
    - Time goals show the gap from the fastest effort to the target.
    - Other goals use `(current-start)/(target-start)` clamped 0..1. Start is `start_value`, else the first reading on/after `created`, else the first reading in the series.
    - With no data, the goal shows "no data yet".
  - **Predictions**: for 5k, 10k, half and marathon, the Garmin prediction is attached (FR-038).
  - **Highlight**: a goal is flagged "newly achieved" within `recent_highlight_days.goal` days.

  Depends on T087 and T088.
- [ ] T090 [P] [US2] Create the goal cards in `src/sections/running/components/`:
  - `GoalCard.astro` shows the target, current value and a `ProgressBar`, plus the time left to the deadline or "deadline passed", "no data yet", the fastest effort with a run link, and "Garmin predicts 20:47".
  - `AchievedGoalCard.astro` gives the celebratory treatment, with the date and the achieving effort, reading or note, and a link.
- [ ] T091 [US2] Create `src/sections/running/pages/goals.astro` at `/running/goals/`:
  - Active goals in priority order.
  - An achieved list, newest first.
  - Retired goals are never shown.
  - Include `LastUpdated`, a unique title and description, and the OG hub card `/og/running-goals.png`.
  - Register the route in `src/sections/running/integration.ts`.
- [ ] T092 [US2] Create `data/running/owner/goals.yaml` with the owner-confirmed initial goals:
  - Brighton sub-3:30 (`linked_race: brighton-2027`, `deadline: 2027-04-04`, priority 1).
  - 10k under 45:00 and 5k under 20:00.
  - Body fat 17.5% (`at_most`) and weight 93 kg (`at_most`).

  Also create `data/running/owner/upcoming-races.yaml` with the Brighton Marathon entry (`id: brighton-2027`, `date: 2027-04-04`, `distance: marathon`, `target_time: "3:30:00"`) so that `linked_race` resolves. The VO2 max goal is **left out until the owner supplies a value** (T093). No invented targets (Principle VIII).
- [ ] T093 [US2] OWNER: Supply the VO2 max target value, and confirm the featured set, priorities and any start values. The agent asks at the US2 PR review and then adds the goal.
- [ ] T094 [P] [US2] Create `tests/unit/goals.test.ts`, covering:
  - acceptance scenarios US2.1 (44:41 inside a longer run gives achieved on 12 Mar 2027), US2.2 (prediction 20:47), US2.3 (26.0 → 22.0 toward 17.5 ≈ 47%), US2.4 (target revised), US2.5 (deadline passed, then retired), US2.6 (regression stays achieved)
  - edge cases: no data yet; indoor and implausible efforts excluded; a hand-entered race counts; an override
- [ ] T095 [P] [US2] Create `tests/e2e/goals.spec.ts` and `tests/a11y/goals.spec.ts`. They cover the 360 px layout, priority ordering, the achieved list, and US2.7 (a malformed `"3:7x"` stops the build with a message naming the file, goal and field, and leaves `dist/` untouched), with zero axe violations and a working keyboard path.

**Checkpoint**: The Goals page works on its own and can be shipped.

---

## Phase 4: User Story 1 - Landing page: the Brighton-led goals hub (Priority: P1) (MVP with US2)

**Goal**: `/running/` answers "how is Alex doing and what is he aiming for?". It shows the Brighton
hero (countdown, target, Garmin prediction, charity, training build), featured goals, this week,
the latest run, and links to the other areas.

**Independent Test**: With stored runs, health readings and goals, open `/running/` on a phone.
A first-time visitor can state the race date, days remaining, target time, progress on each
featured goal and this week's distance within the first two screens.

### Implementation for User Story 1

- [ ] T096 [P] [US1] Create `src/sections/running/domain/races.ts`:
  - The upcoming-race state machine: `upcoming` (date > today) → `race day` (date = today) → `awaiting result` (date < today, no `result_ref`) → `completed` (`result_ref` set).
  - Days remaining in Europe/London.
  - The focus race resolved from `section.yaml`.
  - Upcoming order: focus race first, then by date.
- [ ] T097 [P] [US1] Create `src/sections/running/domain/weeks.ts`:
  - **This-week snapshot** (Monday–Sunday): run count, distance and moving time against the previous week, shown cleanly when there are zero runs.
  - **Training build**: weekly km since `build_start`, plus the longest run in the build.
  - **Latest run**.
- [ ] T098 [P] [US1] Create `src/sections/running/components/Hero.astro`:
  - "Brighton Marathon · 4 April 2027".
  - Days remaining, or "Race day", or "result coming soon", or the result.
  - "Target: sub-3:30", taken from the upcoming race's `target_time`.
  - Garmin's latest `race_prediction_marathon`.
  - "For Martlets hospice" as plain text.
  - A **reserved fundraising slot that renders nothing** (FR-025).
  - A `TrainingBuild` BarChart of weekly km and the longest run (FR-021).
- [ ] T099 [P] [US1] Create `src/sections/running/components/ThisWeek.astro` and `RunCard.astro`. The run card shows the date only (no time), title, distance, time and pace, and links to `/running/runs/<id>/`.
- [ ] T100 [P] [US1] Create `src/sections/running/components/StoryLink.astro` and `SectionLinks.astro`:
  - `StoryLink` renders only when `section.yaml` has `story_link`; otherwise there is no link and no placeholder (FR-024).
  - `SectionLinks` lists Goals, Training, Races & PBs and Health, but only areas present in the route registry (FR-027).
- [ ] T101 [US1] Create `src/sections/running/pages/index.astro` at `/running/`. In order, it shows:
  1. the hero
  2. featured goals (up to `featured_goal_limit`, in priority order, using `GoalCard`, with newly achieved goals highlighted for 14 days per FR-042)
  3. this week and the latest run
  4. the story link
  5. the section links

  It includes `LastUpdated` with the stale notice, and the first two phone screens must answer SC-001. Register the route. Depends on T091 and T096–T100.
- [ ] T102 [US1] Create a minimal `src/sections/running/pages/runs/[id].astro` with summary figures only (date, title, distance, moving time, pace, avg HR), so the latest-run card links somewhere before US3 lands. It shows **no start time, map or location** and uses the shared OG card. US3 extends this file.
- [ ] T103 [US1] Create `src/sections/running/components/Countdown.astro`, an inline script under 1 KB that corrects days remaining client-side in Europe/London. Without JS, the build-time value stays.
- [ ] T104 [US1] Create the landing OG card `src/sections/running/og/landing.ts` → `/og/running.png`, embedding "N days to Brighton" (FR-072).
- [ ] T105 [US1] Create `.github/workflows/rebuild-daily.yml`: crons `5 23 * * *` and `5 0 * * *` (UTC) that run gate → deploy (`concurrency: deploy`), so the countdown and OG image follow the UK date.
- [ ] T106 [US1] Create `data/running/owner/section.yaml`: `focus_race: {race_id: brighton-2027, build_start: <owner value>, charity: {name: Martlets hospice}}`, schema defaults, and no `story_link`. Also add a **validate-data warning** in `scripts/validate-data.ts` when the focus race's `target_time` differs from an active, featured `race_time` goal linked to it. This guards US1.2 (3:30 vs 3:20 shown in two places).
- [ ] T107 [US1] OWNER: Supply the Brighton training-build start date. It is required before the US1 PR merges, and the agent asks for it at that review.
- [ ] T108 [P] [US1] Create `tests/unit/races.test.ts` and `tests/unit/weeks.test.ts`. They cover:
  - 182 days from 2026-10-04 to 2027-04-04
  - the state machine for yesterday, today, tomorrow and `result_ref` (quickstart 7d)
  - week boundaries across BST/GMT
  - a zero-run week
- [ ] T109 [P] [US1] Create `tests/e2e/landing.spec.ts` and `tests/a11y/landing.spec.ts`. At 360 px they cover:
  - acceptance scenarios US1.1–US1.7, including a stale fixture over 12 h showing the notice, and the story link absent or present
  - no-JS rendering (FR-074)
  - zero axe violations and a working keyboard path

**Checkpoint**: US2 + US1 together form the MVP: the landing hub plus goals, rendering from real
data.

---

## Phase 5: MVP graduation and go-live

**Purpose**: The constitution's graduation bar applies when the section goes live on
alexanderwebber.com.

- [ ] T110 Graduation review of the Running MVP (US2 + US1):
  - Run Playwright e2e and axe locally, plus `scripts/lighthouse-budget.mjs` (perf >= 90, landing LCP <= 2.5 s, JS <= 10 KB gzip, <= 150 KB page weight).
  - Confirm zero privacy-scan findings.
  - Carry out an adversarial self-review.
  - Write the design note `src/sections/running/README.md`.
- [ ] T111 OWNER: At the go-live PR review, do two short checks the agent cannot do itself: a screen-reader pass of the progress bar and the bar chart, and a share-preview check of `/running/` in two messaging apps (SC-008). The agent prepares the exact steps.
- [ ] T112 Go live on the custom domain. Once T004 nameservers are active, add the custom domain `alexanderwebber.com` (+ a `www` → apex redirect) in `wrangler.jsonc` and deploy. Verify HTTPS and `/running/api/freshness`.

---

## Phase 6: User Story 3 - Training stats and run detail (Priority: P2)

**Goal**: Training totals and trends by week, month, year and all-time; a browsable run list; and
full run detail pages. Training runs show the date only: no start time, map or location.

**Independent Test**: With the full backfill stored, browse the totals, open any training run, and
confirm all available detail appears while no start time, map or place name appears anywhere.

### Implementation for User Story 3

- [ ] T113 [P] [US3] Create `src/sections/running/domain/periods.ts`: totals by week (Monday–Sunday, Europe/London), month, year and all-time. Each has runs, distance, moving time, distance-weighted average pace and elevation gain. Indoor runs are **included** in totals (FR-045).
- [ ] T114 [P] [US3] Create `src/sections/running/components/PeriodTotals.astro`: a `BarChart` per period, switched with a CSS-only toggle (week/month/year), with supporting figures and all-time totals.
- [ ] T115 [P] [US3] Create `src/sections/running/components/RunList.astro`:
  - Newest first, grouped by month.
  - Each row shows date, title, distance, time and pace, with a race badge.
  - A pre-rendered "All runs / Races only" CSS toggle (FR-046) implements routes.md's `?races=1` filter on the static site.
- [ ] T116 [P] [US3] Create `src/sections/running/components/RunSummary.astro`: distance, moving and elapsed time, average and best pace, elevation gain/loss, average and max HR, and training effect. Each item is omitted when not recorded (FR-048).
- [ ] T117 [P] [US3] Create `src/sections/running/components/SplitsTable.astro` (per-km splits) and `HrZones.astro`. Each is omitted when absent.
- [ ] T118 [P] [US3] Create `src/sections/running/components/RunDynamics.astro`: cadence, stride length, power, ground contact time, GCT balance, vertical oscillation and vertical ratio. Each is omitted when absent, never shown as 0.
- [ ] T119 [P] [US3] Create `src/sections/running/components/RunSeriesCharts.astro`: pace, HR, elevation, cadence and power, plotted against distance or elapsed time, **never clock time** (FR-013). Each chart is omitted when its series is absent and uses `ChartFigure` with a text alternative and table.
- [ ] T120 [US3] Create `src/sections/running/pages/training.astro` at `/running/training/` (period totals plus the current year's run list and year links) and `src/sections/running/pages/training/[year].astro` at `/running/training/<year>/`. Register the routes. OG: the hub card `/og/running-training.png` and the shared `/og/running-year.png`.
- [ ] T121 [US3] Extend `src/sections/running/pages/runs/[id].astro` to full detail (FR-047), adding:
  - the owner's title and note
  - the race badge
  - the shared OG card `/og/running-run.png` (no per-run images)
  - no start time, map, route or place name anywhere in the URL or HTML

  Depends on T102 and T116–T119.
- [ ] T122 [P] [US3] Create `tests/unit/periods.test.ts`, covering week, month and year boundaries in Europe/London, distance-weighted pace and indoor runs included.
- [ ] T123 [P] [US3] Create `tests/e2e/training.spec.ts`, `tests/e2e/run-detail.spec.ts` and `tests/a11y/training.spec.ts`. They cover acceptance scenarios US3.1–US3.5, privacy assertions on a training run started at 06:42 (date only), panels omitted when absent, and zero axe violations.
- [ ] T124 [US3] SC-011 scale check. Promote the Spike 1b generator into `tests/fixtures/generate-runs.ts`, then generate 5,000 synthetic runs into a temp data dir (never committed) and build. Confirm:
  - the run list and training page load their main content within 2.5 s (Lighthouse)
  - the deployed file count is well under 20,000

**Checkpoint**: Training and run detail work on their own. The landing run card now links to full
detail.

---

## Phase 7: User Story 4 - Races and personal bests (Priority: P2)

**Goal**: Race history (Garmin + hand-entered, each race once), a PB table, upcoming races with
countdowns, and race pages with a privacy-safe route map, run detail and photos.

**Independent Test**: With the Garmin history plus two hand-entered pre-Garmin races, the history
lists every race once, the PB table uses official times, upcoming races show countdowns, and a
race page shows its map and photos.

**Depends on**: US3 run-detail components (T116–T119) for the "full run detail" on race pages.

### Implementation for User Story 4

- [ ] T125 [P] [US4] Create `ingest/src/awingest/process/race_track.py`:
  - **When**: only when `is_race` is true and the map is not hidden.
  - **Simplification**: Douglas–Peucker to `<= ~1,000 points`.
  - **Trim and bbox**: applies `trim_ends_m` (default 0) and computes the bbox.
  - **Output**: writes `race-tracks/<run-id>.json` via `PublishedWriter` and sets the run's `track_ref`.
  - **Removal**: removes the track when `hide_map` is set or the run is designated `not_race`.
  - **Hook-up**: wire it into `process/pipeline.py`. The override hash includes `race.yaml`.
- [ ] T126 [P] [US4] Create `ingest/tests/unit/test_race_track.py`. It checks that:
  - training runs never get a track
  - `hide_map` removes the track
  - trimming works
  - tracks have `<= 1000` points and are schema-valid
- [ ] T127 [P] [US4] Create `scripts/add-race-photo.ts`, which uses sharp to **strip all metadata**, apply EXIF orientation and cap the long edge at 2,400 px. It writes the photo into `data/running/owner/races/<slug>/photos/` and appends a `photos` entry. A description is required.
- [ ] T128 [P] [US4] Extend `src/sections/running/domain/races.ts` with the race history:
  - It combines Garmin-flagged or designated runs with hand entries, joined **only on an explicit `run_id`** (no fuzzy merge).
  - Official details win (FR-051).
  - The slug is the owner `slug`, else the run ID.
  - Each race appears once, newest first.
- [ ] T129 [P] [US4] Create `src/sections/running/domain/pbs.ts`. For each standard distance (5k, 10k, half, marathon + any other raced distance):
  - the fastest race result (official time beats device time; hand-entered results included)
  - the fastest eligible any-run effort, where it is faster (FR-053)
  - a "recent" highlight within `recent_highlight_days.pb` days (US4.7)
- [ ] T130 [P] [US4] Create `src/sections/running/components/PBTable.astro`, `RaceHistory.astro` and `UpcomingRaces.astro`. Upcoming races show the focus race first, then by date, each with days remaining, target time and link. Completed races leave the list (FR-056).
- [ ] T131 [P] [US4] Create `src/sections/running/components/RaceMap.astro`:
  - **Static baseline**: a build-time SVG route with km markers and a km-axis elevation profile, with zero third-party requests.
  - **Interactive enhancement**: a "Load interactive map" button lazy-imports maplibre-gl 6.12.0 with OpenFreeMap tiles **only on click**, with attribution. It is the only JS-budget exception.
  - **Absence**: renders nothing when there is no track.
- [ ] T132 [P] [US4] Create `src/sections/running/components/PhotoGallery.astro`: `astro:assets` AVIF/WebP, lazy loading, with the `description` as alt text and an optional caption (FR-055).
- [ ] T133 [US4] Create `src/sections/running/pages/races.astro` at `/running/races/` (history, PB table, upcoming races) and `src/sections/running/pages/races/[slug].astro`. Each race page shows:
  - the official time, position, results link and note
  - `RaceMap`
  - the full run detail via the US3 components when there is a `run_id`
  - `PhotoGallery`
  - a per-race OG card from `src/sections/running/og/race.ts`

  Register the routes, and link race runs in the run list and run pages to their race pages.
- [ ] T134 [US4] OWNER: Supply pre-Garmin race results (date, name, distance, official time), official chip times and positions for Garmin-recorded races, and race photos with descriptions. The agent asks at the US4 PR review.
- [ ] T135 [US4] From the owner's input (T134), write `data/running/owner/races/<slug>/race.yaml` entries and run `scripts/add-race-photo.ts` for each photo. Raise a PR. `validate-data` must pass, including the duplicate-race check.
- [ ] T136 [P] [US4] Create `tests/unit/pbs.test.ts` and `tests/unit/race-history.test.ts`. They cover:
  - US4.2 (PB table)
  - US4.3 (official 1:41:07 beats the device's 1:41:15)
  - the duplicate-race validation error, and a single entry once `run_id` is added
  - US4.7 (recent highlight)
- [ ] T137 [P] [US4] Create `tests/e2e/races.spec.ts` and `tests/a11y/races.spec.ts`. They cover:
  - acceptance scenarios US4.1–US4.7
  - no EXIF in `dist/` images
  - the static map without JS
  - MapLibre and tiles not requested until the button is clicked
  - zero axe violations

**Checkpoint**: Races and PBs work on their own, on top of US3's run detail.

---

## Phase 8: User Story 5 - Health and performance metrics (Priority: P3)

**Goal**: Trend charts with current values and targets for VO2 max, training status and load, race
predictions, resting HR, HRV, weight (7-day average only) and body fat, with lab reference
markers.

**Independent Test**: With stored health history and one lab entry, each approved metric shows a
trend with its current value and target, the lab point is distinct and labelled, and no sleep,
stress or Body Battery data appears anywhere.

### Implementation for User Story 5

- [ ] T138 [P] [US5] Create `src/sections/running/domain/health.ts`:
  - range slicing for 3 months, 1 year and all time
  - current values
  - target markers from goals (FR-063)
  - lab comparison against the nearest Garmin reading **within ±7 days**, as `{lab, device, diff}` (FR-065)
  - an HRV start-date note
  - training-status labels
- [ ] T139 [P] [US5] Create `src/sections/running/components/MetricTrendChart.astro` (a `LineChart` with `RangeToggle`, a target line and labelled "Lab test" / "DEXA scan" markers) and `LabComparison.astro` (device value, lab value and difference).
- [ ] T140 [P] [US5] Create `src/sections/running/components/RacePredictions.astro` (all four distances), `HrvChart.astro` (with the baseline band, starting at the first point with a short note, never zeros) and `TrainingStatus.astro`.
- [ ] T141 [US5] Create `src/sections/running/pages/health.astro` at `/running/health/`. It shows:
  - VO2 max, training status, training load, race predictions, resting HR and HRV
  - **weight as the 7-day average only**, labelled as such
  - body fat as recorded readings with a trend line and the 17.5% target
  - lab markers
  - `LastUpdated`

  Register the route and add the OG hub card `/og/running-health.png`.
- [ ] T142 [US5] OWNER: When lab tests happen (DEXA, lab VO2 max), share the results. The agent writes `data/running/owner/lab/<date>-<type>.yaml` via a PR. This does not block US5, which is verified with fixtures.
- [ ] T143 [P] [US5] Create `tests/unit/health.test.ts`, covering US5.4 (lab 51.0 vs Garmin 54 gives a difference of −3.0), US5.5 (two DEXA points), range slicing and US5.7 (HRV start).
- [ ] T144 [P] [US5] Create `tests/e2e/health.spec.ts` and `tests/a11y/health.spec.ts`. They cover acceptance scenarios US5.1–US5.7, that no individual daily weights appear anywhere, that **no sleep, stress or Body Battery data appears on any page**, and zero axe violations.

**Checkpoint**: All five stories work on their own.

---

## Phase 9: Polish and cross-cutting concerns

- [ ] T145 [P] Create the SC-003 resilience drill `tests/e2e/stale.spec.ts`. Using a fixture whose `last_success` is 7 days old:
  - The gate and build still pass.
  - Every page renders with its last-updated time and the stale notice.
  - The Worker's 503 path keeps the build-time text.
  - `test_alerts.py` already covers the issue opening within 24 h.
- [ ] T146 Validate quickstart.md end to end:
  - §3 scenarios 1–10
  - the §4 gate commands
  - the §6 per-page-type budget checklist

  Fix any gaps it finds.
- [ ] T147 Final graduation review of the whole section:
  - Lighthouse on every page type, axe on all pages, and a full privacy scan.
  - An adversarial self-review against the constitution's quality bars (mobile-first and fast, WCAG 2.2 AA, SEO/OG, graceful degradation).
  - Update `src/sections/running/README.md`.
- [ ] T148 OWNER: (Optional; folded into the final review.) Run the SC-001 hallway test with at least 5 people on phones, plus screen-reader and share-preview spot-checks of the remaining chart and page types (line chart, splits table, map fallback, race page). The agent prepares a one-page script.
- [ ] T149 SC-002 follow-up, 30 days after go-live. Compute from `gh run list --workflow refresh.yml` how often a synced run appears within 3 h (target >= 95%), and record the result in `PROJECT_MEMORY.md`. The agent runs this at a session start; the owner does nothing.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**:
  - Owner tasks T001–T004 come first. T001 blocks Spike 0, T002 blocks Spike 1a and deploys, T003 blocks the refresh workflow, and T004 blocks go-live only.
  - **Spike 0 (T005–T012) is the first agent work** and gates the fetch-stage design.
  - Spike 1 (T013–T014) and the scaffold (T015–T022) run in parallel with Spike 0's 48-h wait.
- **Phase 2 (Foundational)**:
  - Depends on the scaffold. Schemas, storage, gate, processor and shell can start straight after Phase 1c.
  - **T051–T055 (adapter + fetch) wait for T012** (the Spike 0 outcome).
  - T085 (backfill + first publish) needs the whole pipeline.
  - BLOCKS all stories.
- **Phase 3 (US2)** → **Phase 4 (US1)**: both P1. US1's featured goals reuse US2's `goals.ts` and `GoalCard`.
- **Phase 5 (go-live)**: after US2 + US1. It also needs T004.
- **Phase 6 (US3)**: after Phase 2. It can start in parallel with US2/US1. It extends US1's minimal run page (T102 → T121).
- **Phase 7 (US4)**: after Phase 2 and the US3 run-detail components (T116–T119).
- **Phase 8 (US5)**: after Phase 2 only. It is independent of US1–US4 apart from goal targets (`goals.ts`, T089) for target markers.
- **Phase 9 (Polish)**: after the stories that are in scope.

### Story completion order (graph)

```text
Owner T001-T004 ─┐
                 ├─> Spike 0 (T005-T012) ──> fetch stage (T051-T055) ─┐
Scaffold T015-T022 ─> schemas/storage/gate/processor/shell (Phase 2) ─┴─> T085 backfill + first publish
                                                                            │
                     ┌──────────────────────────────────────────────────────┘
                     v
           US2 Goals (P1) ──> US1 Landing (P1) ──> MVP go-live (Phase 5)
                     │
                     ├──> US3 Training (P2) ──> US4 Races & PBs (P2)
                     └──> US5 Health (P3, needs goals.ts for target markers)
```

### Within each story

- Domain (pure functions) → components → pages/routes → owner data → tests (coverage alongside,
  not test-first) → checkpoint.
- Each story registers its own routes in `integration.ts`, so the nav only links shipped areas.

### Parallel opportunities

- Phase 1:
  - Spike 1a and 1b ([P]) and the whole scaffold block run while Spike 0's 48-h schedule runs.
  - T020, T021 and T022 are [P].
- Phase 2:
  - Every schema task T023–T032 is [P].
  - T039–T041 scans, T046–T049 ingest core and T056–T061 processor modules are [P].
  - The shell tasks T072–T075 are [P].
  - All graduation test tasks T077–T084 are [P].
- Stories: once Phase 2 is done, US3 and US5 can proceed in parallel with US2 → US1.

---

## Parallel Example: Phase 2 schemas

```text
Task: "T023 Create schemas/published/run.schema.json"
Task: "T024 Create schemas/published/race-track.schema.json"
Task: "T025 Create schemas/published/health-series.schema.json"
Task: "T027 Create schemas/owner/section.schema.json"
Task: "T028 Create schemas/owner/goals.schema.json"
```

## Parallel Example: User Story 2

```text
Task: "T087 [US2] Best Effort index in src/sections/running/domain/efforts.ts"
Task: "T088 [US2] 7-day composition means in src/sections/running/domain/composition.ts"
Task: "T090 [US2] GoalCard.astro + AchievedGoalCard.astro"
# after T089/T091:
Task: "T094 [US2] tests/unit/goals.test.ts"
Task: "T095 [US2] tests/e2e/goals.spec.ts + tests/a11y/goals.spec.ts"
```

## Parallel Example: User Story 1

```text
Task: "T096 [US1] domain/races.ts state machine"
Task: "T097 [US1] domain/weeks.ts"
Task: "T098 [US1] Hero.astro"
Task: "T099 [US1] ThisWeek.astro + RunCard.astro"
Task: "T100 [US1] StoryLink.astro + SectionLinks.astro"
```

## Parallel Example: User Story 3

```text
Task: "T113 [US3] domain/periods.ts"
Task: "T116 [US3] RunSummary.astro"
Task: "T117 [US3] SplitsTable.astro + HrZones.astro"
Task: "T118 [US3] RunDynamics.astro"
Task: "T119 [US3] RunSeriesCharts.astro"
```

## Parallel Example: User Story 4

```text
Task: "T125 [US4] ingest/src/awingest/process/race_track.py"
Task: "T127 [US4] scripts/add-race-photo.ts"
Task: "T128 [US4] race history in domain/races.ts"
Task: "T129 [US4] domain/pbs.ts"
Task: "T131 [US4] RaceMap.astro"
Task: "T132 [US4] PhotoGallery.astro"
```

## Parallel Example: User Story 5

```text
Task: "T138 [US5] domain/health.ts"
Task: "T139 [US5] MetricTrendChart.astro + LabComparison.astro"
Task: "T140 [US5] RacePredictions.astro + HrvChart.astro + TrainingStatus.astro"
```

---

## Implementation Strategy

### MVP first (US2 + US1; both P1)

1. Phase 1: the owner prerequisites, then **Spike 0** (decide `FETCH_MODE`). Spike 1 and the
   scaffold run alongside it.
2. Phase 2: Foundational, ending with the backfill and the first gated bot publish (CRITICAL;
   blocks all stories).
3. Phase 3: US2 Goals. Phase 4: US1 Landing.
4. **STOP and VALIDATE**: run the US1/US2 independent tests at 360 px.
5. Phase 5: graduation review, then go live on alexanderwebber.com.

### Incremental delivery

Each story is a PR-sized slice (one implement session per slice, per the house session norm):

1. Setup + Spike 0 → Foundational → data flowing every 2 h.
2. US2 + US1 → go-live (MVP).
3. US3 Training and run detail → deploy.
4. US4 Races and PBs → deploy (owner supplies historical races and photos at review).
5. US5 Health → deploy (lab results whenever the owner has them).
6. Polish → final graduation.

### Notes

- Bot commits: only `refresh.yml`'s publish job commits, only after the gate passes, and only
  paths under `data/running/published/`. All code and owner-file changes go through PRs.
- Owner input is always requested during a review the owner is already doing (orchestrator norm).
  No owner task is a recurring chore.
- Commit after each task or logical group. Stop at any checkpoint to validate a story on its own.
- No usage screenshot before `/speckit-implement`: the owner says when usage is running low
  (project override, 2026-10-17).
