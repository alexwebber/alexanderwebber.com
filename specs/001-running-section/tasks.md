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

**Owner decisions of 2026-10-17 (amendment; see PROJECT_MEMORY.md)**: the provider is
**intervals.icu** (official Garmin sync partner, personal API key `INTERVALS_API_KEY`), not Garmin
Connect via python-garminconnect. Spike 0 became the intervals.icu coverage check and **passed**
(`spikes/intervals/RESULTS.md`). Fetch runs on GitHub Actions only (no `FETCH_MODE`, no PC
fallback, no tokens). Garmin training status and race predictions are dated owner entries
(`manual-metrics.yaml`); training load is intervals.icu's fitness/fatigue/form; treadmill runs
(`VirtualRun`) are labelled and not PB-eligible unless marked; Garmin-sourced views carry Garmin
attribution; full history comes from the Garmin export imported into intervals.icu. Tasks
replaced or dropped by this keep their IDs and are marked **Done**/**Dropped**/**Rewritten**; new
tasks are T150–T157.

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

**Purpose**: Spike 0 is done (intervals.icu coverage check passed, 2026-10-17). Spike 1 and the
scaffold come next.

### 1a. Owner prerequisites (from quickstart.md §0; the agent walks the owner through each)

- [X] T001 OWNER: Create the Cloudflare account. Create a **private** R2 bucket and an R2 API token scoped to it (Object Read & Write). Store the values as GitHub Actions secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` (the agent supplies the `gh secret set` commands, and the owner pastes the values). Also set them as user environment variables on the owner's PC for local spike and backfill runs. Nothing goes in a repo file. **Done 2026-10-17**: bucket `alexanderwebber-private`, round-trip tested.
- [X] T002 OWNER: Create a Cloudflare **Workers deploy API token**. Store it and the account ID as GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. **Blocks Spike 1a (T014) and every deploy job.** **Done 2026-10-17**: token verified.
- [X] T003 ~~OWNER: Store the Garmin credentials as GitHub Actions secrets `GARMIN_EMAIL` and `GARMIN_PASSWORD`.~~ **Dropped 2026-10-17** (no Garmin login with intervals.icu). Replaced by the intervals.icu personal API key, stored as GitHub secret `INTERVALS_API_KEY` and as a user env var on the owner's PC (**done 2026-10-17**).
- [ ] T004 OWNER: Move the `alexanderwebber.com` nameservers from Namecheap to Cloudflare (start early, because propagation takes time). **Blocks go-live (T112) only.**
- [ ] T150 OWNER: Request the full Garmin data export (Garmin account → data management → export). When it arrives, the agent walks the owner through *intervals.icu → Settings → Import all Garmin data*. Until then intervals.icu history starts at 2025-10-18. The Garmin → intervals.icu sync connection itself is already done. **Blocks the full backfill (T085) only**, not the pipeline build. After the import, the agent re-runs `spikes/intervals/probe.py` and records the earliest date per wellness field (weight, body fat, HRV, VO2 max, resting HR) in `PROJECT_MEMORY.md`; if wellness history did not import, it raises this with the owner at the next review (accept the gap, or add a manual history path).

### 1b. Spike 0: intervals.icu coverage check (DONE 2026-10-17; replaces the Garmin-direct spike)

Throwaway code: `spikes/intervals/probe.py`. Results: `spikes/intervals/RESULTS.md` (PASS, locally
and from GitHub Actions). The original Garmin-direct tasks keep their IDs below.

- [X] T005 **Rewritten and done**: throwaway harness `spikes/intervals/probe.py` (stdlib only, Basic auth `API_KEY` + `INTERVALS_API_KEY`, descriptive User-Agent) reports field coverage for activities, streams, HR zones, best efforts, FIT/original files, wellness and pace curves; raw payloads stay in the gitignored `spikes/intervals/out/`. ~~garminconnect/curl_cffi harness with keygen/login/fetch~~.
- [X] T006 ~~Generate the Fernet token key (`GARMIN_TOKEN_KEY`).~~ **Dropped 2026-10-17**: no tokens with an API key.
- [X] T007 ~~OWNER: single local Garmin password login.~~ **Dropped 2026-10-17**: the owner created the intervals.icu API key instead (T003 note).
- [X] T008 **Rewritten and done**: ran the probe locally and recorded coverage in `spikes/intervals/RESULTS.md`. All required fields present for Garmin-synced data; only Garmin training status and race predictions are missing (→ manual entries, T151/T153). Found the Cloudflare 403 on Python's default User-Agent.
- [X] T009 **Rewritten and done**: throwaway `workflow_dispatch` reachability check on `ubuntu-latest` (run 39048175253): all nine calls returned 200 with the descriptive User-Agent. The workflow was removed before merge. ~~Scheduled 2-hourly `spike-garmin.yml`~~.
- [X] T010 **Done with T009** (single Actions dispatch was the S0.2 equivalent).
- [X] T011 ~~S0.3: 48 h (24-run) scheduled token-rotation test.~~ **Dropped 2026-10-17**: no tokens, no login lockout risk.
- [X] T012 **Rewritten and done**: outcome recorded in `PROJECT_MEMORY.md` (2026-10-17 decisions) and in research.md R0 via this docs amendment. No `FETCH_MODE` variable (fetch runs on Actions only); no #444 flag; no blocker.

### 1c. Spike 1 (next)

- [X] T013 [P] Spike 1b, size and build time:
  - **Data**: in `spikes/scale/`, generate 5,000 synthetic runs shaped like `published/runs` (each series `<= 600 points`).
  - **Size**: measure the total JSON size against the ~150 MB estimate.
  - **Build**: time a dummy Astro build of 5,000 run pages.
  - **Record**: write the results in `PROJECT_MEMORY.md`.
  - **If over budget**: change the downsample cap in plan.md before T062.
  - **Done 2026-10-17**: ~109 MB compact (worst case, all series at 600 points); ~263 MB if indented, so T063 writes compact JSON. 5,000 pages built in ~10.5 s. Cap unchanged.
- [X] T014 [P] Spike 1a, Workers file limit:
  - **Deploy**: in `spikes/workers-limit/`, deploy a 12,000-file dummy static-asset set with wrangler 4.151.1 to a throwaway `*.workers.dev` Worker.
  - **Confirm**: check the free plan's per-version file limit (believed to be 20,000).
  - **Clean up**: delete the throwaway Worker.
  - **Record**: write the result in `PROJECT_MEMORY.md`.
  - **Depends on**: T002.
  - **Done 2026-10-17** (throwaway branch workflow, since removed): 12,000 files deployed and served; 20,001 rejected by the API (code 10304, Free limit 20,000 per version). The Worker was deleted.

### 1d. Scaffold (can start in parallel with Spike 1)

- [X] T015 *(Done 2026-10-17, in the intervals.icu docs amendment.)* Update the spec docs to match the owner's 2026-10-04 decisions:
  - **Text to remove**: "proposal, not adopted" (tests.yml) and "needs owner confirmation" (bot commits to `main`).
  - **Where**: `specs/001-running-section/plan.md` (Constitution Check, Project Structure, Graduation plan, Complexity Tracking), `research.md` R9/R10/R12, `contracts/pipeline.md` and `quickstart.md` §4.
- [X] T016 *(Done 2026-10-17 in a cloud session: npm/PyPI pins re-verified, current releases adopted, TypeScript stays 6.0.3.)* Run `C:\Projects\sdd-playbook\scripts\check-versions.ps1`. Re-verify the npm and PyPI pins in plan.md *Primary Dependencies* (current release unless deliberately pinned; TypeScript stays at **6.0.3** because `@astrojs/check` 0.9.10 peer-requires `^5 || ^6`). **Re-verify the latest Astro at scaffold time**: 7.4.0 was seen on 2026-10-17, newer than the plan's 7.3.5 pin; adopt the current release (and its `@astrojs/check` peer range) unless something blocks it, and update the T017 pins. Log any change in the `PROJECT_MEMORY.md` decisions log.
- [X] T017 Create the root TypeScript project:
  - **`package.json`**:
    - `"type": "module"` and `engines.node >=22.22.0` (Astro 7.4.0 requires it).
    - Scripts: `dev`, `gen-types`, `build` (= `astro check && astro build`), `preview`, `validate-data`, `scan-images`, `check-boundaries`, `scan-privacy`, `test` (= `vitest run`), `e2e` (= `playwright test`).
    - Exact pins (re-verified by T016): astro 7.4.0, typescript 6.0.3, @astrojs/check 0.9.10, @astrojs/sitemap 3.7.4, sharp 0.35.5, satori 0.62.0, ajv 8.20.0, yaml 2.9.1, json-schema-to-typescript 16.0.0, maplibre-gl 6.14.0, wrangler 4.151.1. Dev: vitest 5.0.5, @playwright/test 1.64.1, @axe-core/playwright 4.14.0, lighthouse 13.5.0.
  - **`tsconfig.json`**: Astro strict.
  - **`.gitignore`**: add `node_modules/`, `dist/`, `.astro/`, `.env*`, `ingest/.venv/`, `__pycache__/`, `playwright-report/`, `test-results/`, `src/shared/storage/generated/`, `spikes/**/out/`.
- [X] T018 Create the Running integration skeleton in `src/sections/running/integration.ts`:
  - It exports an Astro integration with a **route registry**: each area registers its routes when its story ships, and the section nav and landing links read the registry. Unshipped areas are therefore never linked (FR-027 holds without dead links between increments).
  - Also create the empty `src/sections/running/{pages,components,domain,data,og}/` directories.
- [X] T019 Create `astro.config.mjs` (`output: 'static'`, `site: 'https://alexanderwebber.com'`, `trailingSlash: 'always'`, integrations `[sitemap(), running()]`) and a placeholder site home `src/pages/index.astro` that leads to `/running/`. Depends on T017 and T018.
- [X] T020 [P] Create `wrangler.jsonc`:
  - Worker `main: src/worker/freshness.ts`.
  - Static assets `directory: ./dist`.
  - An R2 binding `FRESHNESS` to the private bucket (the Worker reads only `public/freshness.json`).
  - The current `compatibility_date`.
  - *(Done 2026-10-17. `src/worker/freshness.ts` is a pass-through placeholder so wrangler resolves; T068 implements it.)*
- [X] T021 [P] Create the Python uv project `ingest/pyproject.toml`:
  - `requires-python >=3.12`.
  - Exact pins: `boto3==1.43.114`, `jsonschema==4.26.0`, `pyyaml==6.0.3`. Dev: `pytest==9.1.1`, `moto==5.2.4`, `ruff==0.17.1`. The intervals.icu client uses the standard library (`urllib.request`), so there is no HTTP/provider dependency (garminconnect, curl_cffi and cryptography are dropped, 2026-10-17).
  - A `[project.scripts] awingest` entry point.
  - Also create `ingest/uv.lock`, `ingest/src/awingest/__init__.py` and `ingest/tests/conftest.py`.
- [X] T022 [P] Create `vitest.config.ts`, `playwright.config.ts` (a 360 px mobile project plus desktop; `webServer` = `astro preview`) and the empty `tests/unit/`, `tests/contract/`, `tests/e2e/` and `tests/a11y/` directories.

**Checkpoint**: Spike 0 passed (done), Spike 1 recorded, scaffold builds an empty site.

---

## Phase 2: Foundational (blocking prerequisites for every user story)

**Purpose**: The schemas, storage layer, build gate, the full ingest → sanitise → publish pipeline,
freshness, alerts and the shared shell. Every story renders from this.

**CRITICAL**: No user-story work can begin until this phase is complete. The fetch-stage tasks
T051–T055 build on Spike 0's findings (T012, done): intervals.icu endpoints, the User-Agent rule
and the field coverage in `spikes/intervals/RESULTS.md`.

### 2a. JSON Schemas (contract; single source of truth for Python and TypeScript)

Every schema uses draft 2020-12 and **`additionalProperties: false` everywhere**. Owner schemas
are strict as well (a typo such as `offical_time` is an error, not ignored). Every file carries a
`schema_version` (required in published files; optional in owner files, defaulting to current).

- [X] T023 [P] Create `schemas/published/run.schema.json`:
  - `id` matches `^\d{4}-\d{2}-\d{2}-[a-z2-7]{4}$`.
  - `date` is `YYYY-MM-DD` with **no time of day**.
  - `type` enum is `road|track|trail|indoor`, plus `treadmill` (bool; true for intervals.icu `VirtualRun`).
  - `is_race`, `title`, `note?`, `distance_m`, `moving_s`, `elapsed_s`, `elevation_gain_m?`, `elevation_loss_m?`, `avg_pace_s_per_km` and `best_pace_s_per_km`.
  - `hr {avg,max}?`, `cadence_avg?`, `stride_m_avg?`, `power_w_avg?`.
  - `dynamics?` (gct, balance, vertical oscillation, vertical ratio) and `training_effect {aerobic,anaerobic}?`.
  - `splits [{km, time_s, pace_s_per_km, hr?, elev_delta_m?}]` and `hr_zones [{zone, seconds}]?`.
  - `series {x_dist_m[], x_elapsed_s[], pace[], hr?[], elev?[], cadence?[], power?[]}`, every array `maxItems: 600`, no lat/lon; no `name`/`description` field anywhere (titles use `title`).
  - `best_efforts [{distance_m, label, time_s, plausible}]`, `flags {excluded_from_records?, include_indoor_in_records?}` and `track_ref?`. The `include_indoor_in_records` `description` states that it mirrors the owner's `run-overrides.yaml` `include_in_records` (T031, T062).
- [X] T024 [P] Create `schemas/published/race-track.schema.json`: `{id, points: [[lat,lon,dist_m,elev_m]] (maxItems ~1000), trim_ends_m, bbox, source}`. This is the **only** schema allowed to contain coordinates.
- [X] T025 [P] Create `schemas/published/health-series.schema.json`:
  - `{metric, unit, points: [{date, value, ...}]}`, with points sorted by date.
  - `metric` enum is exactly the approved list: `vo2max`, `fitness_ctl`, `fatigue_atl`, `resting_hr`, `hrv`, `weight_avg7`, `body_fat_pct` (rewritten 2026-10-17: training status and race predictions are owner data, T151; training load is intervals.icu's ctl/atl).
  - `hrv` points may carry an optional baseline low/high (intervals.icu supplies none).
  - Individual weights cannot be expressed in this schema.
- [X] T026 [P] Create `schemas/published/refresh.schema.json` (`{sources: {intervals: {last_data_change_at, last_success_at_build}}, generated_at}`) and `schemas/published/manifest.schema.json` (`{runs: {<run-id>: {input_hash, path, hidden?}}, health: {...}, schema_version, processed_at}`).
- [X] T027 [P] Create `schemas/owner/section.schema.json`:
  - `focus_race: {race_id, build_start, charity: {name}}` is required.
  - Optional fields with defaults: `story_link?: {href, label}`, `stale_after_hours` (default 12), `featured_goal_limit` (default 6), `recent_highlight_days: {pb: 14, goal: 14}`.
  - An absent file or field is valid apart from `focus_race`.
- [X] T028 [P] Create `schemas/owner/goals.schema.json`. Each item is `{id, type, title, description?, priority, featured, deadline?, start_value?, created?, linked_race?, status_override?, retired?, achieved_override?{date, note?}, target}`:
  - `type` is `race_time|body_composition|metric|milestone`.
  - `target` depends on the type:
    - race_time: `{distance_m|distance, time}`
    - body_composition: `{metric: weight_kg|body_fat_pct, value, direction: at_most|at_least}`
    - metric: `{metric: vo2max|resting_hr|hrv, value, direction: at_most|at_least}` (closed enum; `fitness_ctl`/`fatigue_atl` and the manual Garmin figures are not goal metrics)
    - milestone: none
  - `created?` (YYYY-MM-DD) is added to support the "first reading on or after goal creation" baseline rule. If it is absent, the first reading in the series is used.
- [X] T029 [P] Create `schemas/owner/upcoming-races.schema.json`: a list of `{id, name, date, distance_m|distance, target_time?, url?, result_ref?}`.
- [X] T030 [P] Create `schemas/owner/race.schema.json`:
  - `{slug, run_id?, name?, date, distance, official_time?, official_distance_m?, position?, results_url?, note?, hide_map?, trim_ends_m?, designate?, photos: [{file, description, caption?}]}`.
  - `run_id` uses the opaque pattern.
  - `trim_ends_m` defaults to 0.
  - `designate` is `race|not_race`.
  - Photo `description` has `minLength 1`.
- [X] T031 [P] Create `schemas/owner/run-overrides.schema.json` (a list of `{id, title?, note?, hide?, exclude_from_records?, include_in_records?, is_race?}`; `include_in_records` is the owner's PB/race-time-goal eligibility override for treadmill/indoor runs, published as `flags.include_indoor_in_records`, which its schema `description` states) and `schemas/owner/health-exclusions.schema.json` (a list of `{metric, date, reason?}`, using the goal metric names, e.g. `weight_kg`).
- [X] T032 [P] Create `schemas/owner/lab.schema.json`: `{date, type: dexa|lab_vo2max, provider, values: {body_fat_pct?, weight_kg?, vo2max?}}`. **Only those three value keys are allowed; any other key fails validation (FR-066).**
- [X] T151 [P] Create `schemas/owner/manual-metrics.schema.json` for the Garmin figures intervals.icu lacks (FR-069; data-model §4): `{training_status?: [{as_of, status, note?}], race_predictions?: [{as_of, 5k?, 10k?, half?, marathon?}]}`. `as_of` is a required `YYYY-MM-DD`; `status` enum `peaking|productive|maintaining|recovery|unproductive|detraining|overreaching|strained|no_status`; prediction times are `h:mm:ss`/`mm:ss` strings with at least one distance per entry. Add to `scripts/validate-data.ts` (T038): `as_of` not in the future and unique within its list, times parsed and range-checked, errors in the file/entry/field format. Add valid/invalid fixtures to T033 (e.g. missing `as_of`, unknown status, `marathon: "3:2x"`). An absent file is valid ("not recorded yet").
- [X] T033 Create shared schema fixtures `schemas/fixtures/<schema>/{valid,invalid}/*` used by both languages. They include cases showing that **no `lat|lon|latlng|latitude|longitude|start_time|startTime` key validates in any published schema outside race-track, and no `name|description` key validates in a published run**, plus invalid owner cases (`time: "3:7x"`, unknown key, missing photo description, lab `bone_density`, the manual-metrics cases from T151).
  - **Done 2026-10-17**: JSON fixtures for published schemas, YAML for owner schemas. The no-coordinate/start-time/name keys rule is also checked by injecting each key into every object of every valid published fixture (TS and Python). Shared parts live in `schemas/defs.schema.json`; conventions in `schemas/README.md`.
- [X] T034 Create `scripts/gen-types.ts`, which generates TypeScript types from `schemas/**` into `src/shared/storage/generated/` with json-schema-to-typescript 16.0.0. Wire it as the `prebuild` and `pretest` npm hooks. Depends on T023–T032 and T151.
  - **Done 2026-10-17**: also wired as `predev`. `tsconfig.json` sets `erasableSyntaxOnly`, because the gate scripts run under Node's type stripping.

### 2b. Shared formatting and storage (TypeScript)

- [X] T035 [P] Create `src/shared/format/`:
  - `parse.ts`: owner time strings `h:mm:ss` or `mm:ss`, parsed and range-checked; distance names `5k, 10k, 10mi, half, marathon, 1k, 1mi, 3k, 15k, 20k, 30k` or metres.
  - `dates.ts`: UK format (e.g. "4 Apr 2027"); Europe/London local dates; weeks start on Monday; days-between that is correct across BST/GMT changes.
  - `units.ts`: km, min/km pace, `h:mm:ss` durations, kg (FR-075).
- [X] T036 Create the `RunningStore` interface in `src/shared/storage/running-store.ts`: `listRuns()` (newest first), `getRun(runId)`, `getRaceTrack(runId)`, `getHealthSeries(metric, range?)`, `getRefreshRecord()`, `getOwner()`.
- [X] T037 Create `JsonFileStore` in `src/shared/storage/json-file-store.ts`:
  - It reads `data/running/`, parses YAML with yaml 2.9.1 and validates every file with ajv 8.20.0 (draft 2020, `useDefaults` for owner schemas).
  - It throws `DataValidationError {file, entry, field, message}` and memoises per build.
  - Depends on T034 and T036.
  - **Done 2026-10-17**: the loader (`src/shared/storage/load.ts`) is shared with `validate-data`. It reads YAML 1.2 core schema with unique keys, reports unexpected files under `data/running/` (e.g. a mistyped `goal.yaml`), and treats absent files as no data yet. The store methods are async, so a future database-backed store is a drop-in.
- [X] T038 Create `scripts/validate-data.ts`, which validates every published and owner file. It also runs these referential checks (contracts/data-files.md):
  - a goal's `linked_race` exists
  - `section.yaml` `focus_race.race_id` exists in the upcoming races
  - an upcoming race's `result_ref` names an existing race entry
  - a race's `run_id` exists in published runs (a warning if the run is not yet ingested)
  - an override's `id` exists
  - photo files exist
  - ids are unique
  - at most `featured_goal_limit` goals are featured, and priorities are unique among featured goals
  - **duplicate race**: a hand-entered race (no `run_id`) that matches a recorded race run (same date, distance within 2%) is an error telling the owner to add `run_id`
  - at most one entry per `run_id`
  - no provider-style activity IDs (intervals.icu or Garmin) appear in any owner file
  - the `manual-metrics.yaml` checks from T151

  Errors use the format `data/running/owner/goals.yaml  goal "10k-sub-45"  field target.time: "44:7x" is not a valid time (expected mm:ss or h:mm:ss)`, and the script exits non-zero (FR-070).
  - **Done 2026-10-17**: also checks published-file placement (year folder, filename = id), race tracks only for published races, hidden runs not published, health points sorted within their year, race date = linked run date, race slug = folder, lab file name = date-type, and warns when a goal's target differs from its linked race's `target_time`. Provider-ID heuristics ignore links, so results URLs with long numeric IDs are fine.
- [X] T039 [P] Create `scripts/check-boundaries.ts`. It scans the import specifiers in `src/**` and fails if `src/shared/**` imports from `src/sections/**`, or if `src/sections/<a>/**` imports from `src/sections/<b>/**` (Principle VII).
- [X] T040 [P] Create `scripts/scan-images.ts`. It fails on any EXIF, XMP, IPTC or GPS metadata in images under `data/` and `src/` (via sharp `metadata()`). It also enforces owner photos as `.jpg|.webp|.avif` with a long edge of at most 2400 px.
  - **Done 2026-10-17**: also scans `public/`.
- [X] T041 [P] Create `scripts/scan-privacy.ts`, which scans `data/` and `dist/` (SC-004) and fails on:
  - ISO datetimes with a time component (`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}`) or `start_time`/`startTime`-style keys in run files and run pages (durations such as `06:42` must not be false positives)
  - coordinates outside `data/running/published/race-tracks/` and race pages
  - sleep, stress, Body Battery, steps or SpO2 data: **key-based** in `data/` (JSON/YAML keys such as `steps`, `sleepSecs`, `sleepScore`, `spO2`, `stress`, `bodyBattery`), and targeted patterns in `dist/` (e.g. those keys in inline data, labelled values such as `SpO2 <n>%` or `<n> steps`), so prose and "step length" are not false positives
  - provider activity-URL patterns (`connect.garmin.com/modern/activity/`, `intervals.icu/activities/`); a plain Garmin link or mark for the attribution (T152) is allowed
  - `activityId`/`garminId`/`external_id`-style keys, and `name`/`description` keys in published run files
  - EXIF in `dist/` images

  When R2 credentials are present, it also loads `state/run-ids.json` and fails on any known provider activity ID found in `data/` or `dist/`.
  - **Done 2026-10-17**: the known-ID check takes `--provider-ids=<file>` (R2 `state/run-ids.json`), so the gate (T042) fetches the map when it has R2 credentials and passes the file in. Key-based coordinate/category rules skip bundled library code in `dist/_astro/` (MapLibre is full of lat/lng identifiers); links and known IDs are still checked there.

### 2c. Build gate and CI (gate from day one)

- [X] T042 Create the composite action `.github/actions/gate/action.yml`. Steps:
  - setup-node (version from `engines`) and `npm ci`
  - `gen-types`
  - `validate-data` and `scan-images`
  - `check-boundaries`
  - `build` (`astro check` + `astro build`)
  - `scan-privacy` (with R2 credentials when passed in)

  It is a composite action, so it runs in the caller's job and workspace. pytest, Vitest and Playwright are **not** part of it.
  - **Done 2026-10-17**: Node comes from `.nvmrc` (`22`; `engines` stays the `>=22.22.0` floor, because setup-node would resolve a range to the newest Node). The R2 run-ID map is fetched with the runner's AWS CLI into `$RUNNER_TEMP` and deleted after the scan; a missing map (before the first publish) is a notice, any other R2 failure fails the gate. `scan-privacy` findings now give `file:line:column` and the matched key, never the caught value, so gate logs can't leak what the scan caught.
- [X] T043 Create `.github/workflows/gate.yml`:
  - Triggers: `pull_request` and `push` to `main`. It runs the gate.
  - On `push` to `main` only, a `deploy` job (`needs: gate`; `wrangler deploy`; `concurrency: { group: deploy, cancel-in-progress: false }`, shared with T067 and T105). No deploy runs on PRs.
  - `permissions: contents: read`.
  - **Done 2026-10-17**: the gate job uploads `dist/` and `deploy` deploys that artifact, so production gets exactly the gated build. Actions are pinned by commit SHA. A throwaway branch workflow deployed the gated build under a throwaway Worker name, checked it served, and deleted it.
- [X] T044 Create `.github/workflows/tests.yml` (**ADOPTED 2026-10-04**: path-filtered PR test jobs):
  - Trigger: `pull_request`.
  - A `changes` job computes the changed paths with `git diff --name-only origin/${{ github.base_ref }}...HEAD` (no third-party action).
  - Jobs and their path filters:
    - `pytest` (`uv run pytest`): `ingest/**` or `schemas/**`
    - `vitest` (`npm test`): `src/**`, `schemas/**`, `scripts/**`, `tests/unit/**` or `tests/contract/**`
    - `playwright` (Playwright + axe against `astro preview`): `src/**`, `data/running/owner/**`, `tests/e2e/**`, `tests/a11y/**` or `playwright.config.ts` (added 2026-10-17; `vitest` likewise also runs on `vitest.config.ts`)
  - Full lint on every change stays deferred (BACKLOG).
  - **Done 2026-10-17**: Playwright runs with `--pass-with-no-tests` until the story specs exist. `playwright.config.ts` clears `CLAUDECODE`/`AI_AGENT` for its web server, because Astro 7 backgrounds `astro preview` under a coding agent.
- [X] T045 Create `scripts/lighthouse-budget.mjs`, which runs the Lighthouse 13.5.0 CLI (mobile) against `astro preview` for each page type. Checks:
  - performance >= 90
  - landing LCP <= 2.5 s
  - JS <= 10 KB gzip (race-map script excepted)
  - HTML+CSS+JS <= 150 KB
  - zero third-party requests on load

  Also create the **non-blocking** `.github/workflows/quality.yml`: Lighthouse + axe on PRs touching site code, and nightly against production.
  - **Done 2026-10-17**: sizes are gzip, measured by re-fetching each same-origin document, stylesheet and script, so local preview and production are measured alike. Lighthouse's accessibility (axe) audits count too. Page types not built yet are skipped and listed. The nightly run targets `alexanderwebber.alexanderwebber.workers.dev` until the domain is live (T004).

### 2d. Ingest core (Python): logging, provider contract, archive

- [X] T046 [P] Create `ingest/src/awingest/logging.py`: structured JSON-lines logs on stderr (`run_id`, `stage`, `provider`, `event`, `error_class`, `code`). It redacts secrets (including `INTERVALS_API_KEY` and `Authorization` headers) and email addresses, and **never logs provider activity IDs** (data-model §3).
- [X] T047 [P] Create `ingest/src/awingest/providers/base.py`:
  - The `ActivityProvider`, `HealthProvider` and `Provider` protocols, with `session()` as a context manager (contracts/provider-adapter.md; date-window `oldest`/`newest` arguments).
  - `ActivityRef`, `RawBundle`, `RawHealthDay`.
  - `NormalisedActivity` and `NormalisedHealthReading` dataclasses (fields per data-model §2, incl. `treadmill`; a missing optional metric is `None`, **never 0**).
  - The error taxonomy `AuthRejected | ProviderForbidden | RateLimited(retry_after?) | ProviderChanged | Transient`, each with a stable `code` plus `likely_cause` and `action` text.
- [X] T048 [P] Create `ingest/src/awingest/archive/base.py` (the `RawArchive` protocol: `get`, `put(if_match)`, `list`, `exists`, `delete`; key validation with no `..`; `ArchiveUnavailable` and `ArchiveConflict`) and `ingest/src/awingest/archive/local.py` (`LocalArchive`, a directory with atomic writes).
- [X] T049 [P] Create `ingest/src/awingest/archive/r2.py`: `R2Archive` using boto3 1.43.114 against the S3 endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. It supports conditional `put` with `if_match`, an idempotent re-put of identical bytes, and error mapping. Depends on T048.
  - **Done 2026-10-17 (T046–T049)**: failure classes share `awingest.errors.IngestError` (`code`, `exit_code`, `likely_cause`, `action`). ETags are the MD5 hex of the bytes, so `etag_of(data)` after a `get` is the `if_match` value, and `if_match=ABSENT` means create-only. Provider IDs, raw titles and coordinates are kept out of the normalised types' `repr`. Logging scrubs secrets, emails and provider IDs from everything the caller passes; `Logger.error` takes `exc=` by keyword.
- [X] T050 ~~Create `ingest/src/awingest/archive/tokens.py`, the Fernet token store.~~ **Dropped 2026-10-17**: intervals.icu uses a personal API key from the environment; nothing secret is stored in R2.

### 2e. intervals.icu adapter and fetch stage (rewritten 2026-10-17; builds on Spike 0, T012)

- [X] T051 **Rewritten.** Create `ingest/src/awingest/providers/intervals/client.py`:
  - Standard-library `urllib.request` client for `https://intervals.icu/api/v1`, HTTP Basic auth user `API_KEY` + `INTERVALS_API_KEY` (from the environment), athlete `0`.
  - **Always sends a descriptive User-Agent** (`alexanderwebber.com-ingest/<version> (+https://alexanderwebber.com)`); a request without one is a bug.
  - Error mapping (none escapes): 401, or 403 with a JSON body → `AuthRejected`; **403 with an HTML body → `ProviderForbidden`** (Cloudflare bot block, not an auth failure); 429 → `RateLimited(retry_after)`, recording `rate_limited_until` in `state/fetch-status.json`; parse/shape errors → `ProviderChanged`; network/5xx → `Transient`.
  - Pacing of >= 1 s with jitter between calls. The key never appears in logs or errors.
  - Depends on T047.
- [X] T052 **Rewritten.** Create `ingest/src/awingest/providers/intervals/endpoints.py` (contracts/provider-adapter.md):
  - `list_activities(oldest, newest)` via `/athlete/0/activities`, keeping running types only (`Run`, `TrailRun`, `VirtualRun`; FR-009), each ref carrying id, `start_date_local` and a list-row hash.
  - `fetch_activity`: `/activity/{id}?intervals=true`, `/activity/{id}/streams.json`, `/activity/{id}/time-at-hr` and `/activity/{id}/fit-file` (archived verbatim, not parsed).
  - `fetch_health(oldest, newest)` via `/athlete/0/wellness`, reducing each day **in memory** to the approved keys (`weight`, `bodyFat`, `restingHR`, `hrv`, `vo2max`, `ctl`, `atl`, plus the date) **before anything is archived**. `sleepSecs`, `steps`, `spO2`, sleep scores and every other key are dropped (FR-015). There is no code path for training status or race predictions (owner data, T151).
  - Depends on T051.
- [X] T053 **Rewritten.** Create `ingest/src/awingest/providers/intervals/normalise.py`, a pure (no I/O), deterministic mapping to `NormalisedActivity` and `NormalisedHealthReading` (data-model §2):
  - Units: metres, seconds, kg, bpm; `start_date_local` → Europe/London.
  - Types: `Run` → `road`, `TrailRun` → `trail`, `VirtualRun` → `indoor` with **`treadmill: true`**; `trainer: true` on a non-`VirtualRun` run → `indoor` without `treadmill`; non-run activities rejected.
  - HR zone times, running dynamics (`average_stance_time` = GCT; ground-contact balance from the summary field if present, else derived from the `stance_time_balance` stream; vertical oscillation/ratio), stride, power (from `watts` when `device_watts`), per-km splits computed from the `distance`/`time` streams, samples incl. lat/lon from `latlng` (still private).
  - Wellness: `weight` → `weight_kg`, `bodyFat` → `body_fat_pct`, `restingHR` → `resting_hr`, `hrv` → `hrv` (rMSSD), `vo2max`, `ctl` → `fitness_ctl`, `atl` → `fatigue_atl`.
  - `training_effect` is always `None` (not exposed by the API). Free-text `name`/`description` are kept only as private `title_raw`/`description_raw`. The provider ID is exposed only as `provider_id`.
  - Depends on T047.
- [X] T054 **Rewritten.** Create `ingest/src/awingest/fetch.py`, the fetch stage:
  - **Incremental by date window**: `oldest` = `state/cursor.json` date **minus 14 days** (FR-008 re-list), `newest` = today; fetches parts only for new activities or ones whose list-row hash changed; wellness over the same window. Honours `--reimport-from`/`--reimport-to`; supports `--health-only`.
  - **Archiving**: raw parts are archived to `raw/intervals/activities/<id>/…` and `raw/intervals/wellness/<date>.json` before normalisation (wellness already reduced to approved keys). It never deletes, and a partial failure is recorded and fetching continues.
  - **Cursors**: they advance only after successful writes.
  - **On success**: updates `state/fetch-status.json` and `public/freshness.json` (only `last_success_at` per source (`intervals`) + `generated_at`).
  - **Exit codes**: 0, 10, 11, 12, 13, 14, 1.
  - **Depends on**: T049, T052, T053.
- [X] T055 **Rewritten.** Create `ingest/src/awingest/backfill.py`, a whole-history backfill over date windows. It is chunked, paced and resumable via `state/backfill.json` (`--from`, `--resume`). The agent runs it locally with the owner's `INTERVALS_API_KEY`/`R2_*` user env vars once the Garmin export import (T150) is done; runs before that are fine and simply stop at 2025-10-18. Depends on T054.
  - **Done 2026-10-17 (T051–T055)**: `providers/intervals/{client,endpoints,normalise}.py`, `IntervalsProvider`, `state.py`, `fetch.py`, `backfill.py`, and `fetch`/`backfill` wired into `cli.py` (the rest of T066 is still to do). Activity parts are keyed by archive file name and a `fetch.json` marker (row hash, part names) is written last; HR time and FIT are optional (404). With no cursor, `fetch` covers the last 14 days. Backfill defaults to `--from 2000-01-01` in 90-day windows and sets cursors only if none exist. Checked against the owner's real data from a throwaway branch workflow (aggregates only; `spikes/intervals/RESULTS.md`). That check led to two normaliser rules: cadence is doubled to steps/min, and a distance stream more than 0.5% off the summary is scaled to it.

### 2f. Processor and publish stage (never touches the provider)

- [X] T056 [P] Create `ingest/src/awingest/process/run_ids.py` for opaque public run IDs:
  - **Format**: `YYYY-MM-DD-xxxx` (local run date + 4 characters `[a-z2-7]` drawn with `secrets`, collision-checked per date).
  - **Map**: an **append-only** map in R2 `state/run-ids.json`, written with `if_match`. An ID is never reassigned.
  - **Failure**: it **aborts if the map is unreadable** rather than regenerating it.
- [X] T057 [P] Create `ingest/src/awingest/process/titles.py` for neutral generated titles such as `Run · 8.2 km` (a run-type word only where the provider supplies a workout type; intervals.icu has no Garmin training effect, so usually "Run"). It **never copies `title_raw` or `description_raw` for training runs** (FR-011/012). Races use the owner race name (race.yaml) else a neutral title. An owner custom title always wins.
- [X] T058 [P] Create `ingest/src/awingest/process/plausibility.py`. An effort is marked `plausible: false` if its time is below **0.85 × the world record** for the distance (table for every best-effort distance, e.g. 5k < 10:54, 10k < 22:30, half < 50:00, marathon < 1:46:00) **or** if its peak 1 km split is < 2:30/km.
- [X] T059 [P] Create `ingest/src/awingest/process/best_efforts.py`, a two-pointer sliding window over cumulative distance and elapsed time, with linear interpolation at the window start. It covers 1k, 1mi, 3k, 5k, 10k, 15k, 10mi, 20k, half, 30k and marathon, **plus any goal `race_time` distance** in `goals.yaml`, and attaches plausibility.
- [X] T060 [P] Create `ingest/src/awingest/process/health.py`, which turns approved-metric readings into published points:
  - `weight_avg7` is the **trailing 7-day mean of non-excluded readings in kg; a day is omitted if there are no readings in the window**. Individual weigh-ins are never output (FR-061).
  - `body_fat_pct` is published as recorded, date only (intervals.icu supplies one per day; the schema still allows several).
  - `hrv` (rMSSD) is published as recorded; baseline fields only if a source ever supplies them.
  - `fitness_ctl` and `fatigue_atl` are published per day as supplied (intervals.icu's model; form is derived at build, T156).
  - `vo2max` and `resting_hr` are published as recorded. No training-status or race-prediction series (owner data, T151).
  - Exclusions from `health-exclusions.yaml` are removed before any computation (FR-067).
- [X] T061 [P] Create `ingest/src/awingest/process/overrides.py`. It reads and jsonschema-validates `run-overrides.yaml`, `health-exclusions.yaml`, `races/*/race.yaml` (`designate`, `hide_map`, `trim_ends_m`) and `goals.yaml` (goal distances), and provides a per-run override hash.
- [X] T062 Create `ingest/src/awingest/process/sanitise.py`, an **allow-list** sanitiser (data-model §7, rules 1–7):
  - **Construction**: published runs are built field by field.
  - **Times**: `start_local` becomes `date` only, and stream timestamps become elapsed seconds.
  - **Series**: the x axis is distance or elapsed time, downsampled to `<= 600 points`.
  - **Location and free text**: no lat/lon (`latlng` stream dropped), no `title_raw`/`description_raw` (provider free-text `name`/`description`) for training runs, no other location-derived strings.
  - **Visibility and flags**: hidden runs are **not written at all**; owner flags are mirrored into `flags` (`include_indoor_in_records` from `include_in_records`); `treadmill` copied from the normalised activity; `is_race` comes from the intervals.icu `race` flag or an owner override (`run-overrides.is_race`, race.yaml `designate`).

  Depends on T056–T061.
- [X] T063 Create `ingest/src/awingest/publish/writer.py` (`PublishedWriter`):
  - **Validation**: it validates against the schema **before** writing.
  - **Atomic writes**: it writes into a staging directory and swaps.
  - **Path guard**: it refuses any path outside `data/running/published/`.
  - **Formatting**: sorted keys, **compact** separators and no indentation (`separators=(",", ":")`, trailing newline), so output is canonical and the 5,000-run total stays ~109 MB (Spike 1b: indentation makes it ~263 MB).
  - **API**: `remove()` and `commit_plan()`.
- [X] T064 Create `ingest/src/awingest/publish/manifest.py` and `ingest/src/awingest/process/pipeline.py`:
  - **Incremental**: processing is driven by `input_hash` (raw ETag + override hash), with `--all` and `reprocess --run RUN_ID`.
  - **Hidden runs**: files of newly hidden runs are removed.
  - **Refresh record**: `state/refresh.json` is written only when data changes.
  - **Failure**: `process` **writes nothing if any validation fails** (exit 20).
  - **`publish-check`**: validates the published tree and checks manifest consistency.
- [X] T065 Create `ingest/src/awingest/alerts.py` and the `alert` command (FR-010, SC-012):
  - **Trigger**: `now - last_success_at(intervals) > 24h`.
  - **Opening**: opens the `ingest-failing` issue titled `intervals.icu refresh failing since <date>`. The body holds the failure class and code, the sanitised last error, the likely cause, the matching owner/agent action row from contracts/pipeline.md, a link to the failing run and the last good timestamp.
  - **While failing**: adds at most one comment per 24 h.
  - **Recovery**: comments "recovered at <time>" and closes the issue.
  - Uses `GITHUB_TOKEN` (`issues: write`).
- [X] T066 Create `ingest/src/awingest/cli.py`, wiring the subcommands `fetch`, `backfill`, `process [--all]`, `publish-check`, `alert` and `reprocess --run RUN_ID`, with `--archive r2|local`. It prints JSON-lines logs on stderr and a summary on stdout, and returns the exit codes in contracts/pipeline.md.
  - **Done 2026-10-17 (T056–T066)**, checked end to end: the fixture archive processed into a temp repo passes `validate-data`, `astro build` and `scan-privacy`. Choices:
    - **Owner data**: a `race.yaml` linked by `run_id` makes the run a race by itself (`designate: not_race` un-designates; `run-overrides` `is_race` wins). Owner YAML is validated in Python too; goal errors are reported for the goal's own type (jsonschema ignores `discriminator`, so `awingest.schemas` picks the branch as ajv does).
    - **Run fields**: `best_pace_s_per_km` is the plausible 1 km best effort, else the average. A run whose start date is edited later keeps the date in its ID (IDs are never reassigned, and the gate requires the prefix to match). Out-of-range values are omitted, not fatal. A run with no distance or duration isn't published (and gets no ID).
    - **Health**: `weight_avg7` is rounded to 0.1 kg; points run to the last day with any wellness data. Each health file's `input_hash` covers its year's wellness ETags (from 26 Dec for the weight average), the series end and the exclusions.
    - **Pipeline**: the ID map is saved before the published tree is committed. A missing map with published runs aborts (exit 14, `run_ids_missing`). One activity failing to normalise gives `partial` and keeps its last file. `processed_at` and `refresh.json` change only with data, so an idle run changes no file.
    - **Writer**: commits by building `published.staging` (hard links to unchanged files) and swapping it in with two renames; a crash between them is repaired on the next open. Validation errors give path and rule, never the value.
    - **Alerts**: the 24-hour comment limit uses the comments API's `since`; a stale success with no recorded failure also alerts ("may not be running"). `alert` exits 1 on a GitHub failure or missing token.
    - Not here: race tracks and `track_ref` (T125), `refresh.yml` (T067).

### 2g. Pipeline workflows, freshness Worker, production check

- [X] T067 **Rewritten.** Create `.github/workflows/refresh.yml`. It implements **owner decision 1 exactly**:
  - **Triggers**: `schedule: '17 */2 * * *'`, `workflow_dispatch` (inputs `reimport_from`, `reimport_to`, and boolean `fetch_only`, default false: when true only the `fetch` and `alert` jobs run, with no publish, commit or deploy; used by T070), and `push` to `main` with `paths: data/running/owner/**`.
  - **Concurrency**: `concurrency: { group: refresh, cancel-in-progress: false }`.
  - **`fetch` job**: always runs on Actions (no `FETCH_MODE`). It runs `uv run awingest fetch` with the `INTERVALS_API_KEY` and `R2_*` secrets.
  - **`publish` job**, in this order:
    1. `uv run awingest process` and `publish-check`.
    2. Run the gate composite action (T042), with R2 credentials for the provider-ID scan.
    3. **Only if the gate passed**: check that every changed path is under `data/running/published/`, and fail without committing if any other path changed.
    4. Commit as `github-actions[bot]` **straight to `main`**.
    5. Push. If the push is rejected because `main` moved, abort without committing; the next run re-publishes from R2. `permissions: contents: write` on this job only.
  - **`deploy` job**: `wrangler deploy`, only if the gate passed and (a commit was made or owner files changed). `concurrency: deploy`.
  - **`alert` job**: `if: always()`, `issues: write`.
  - **Rulesets**: check `main` rulesets and branch protection (`gh api repos/{owner}/{repo}/rulesets`). If they would block the bot push, propose a bypass limited to GitHub Actions in the PR description for the owner's review. Do not change repo settings unasked.
    - *Checked 2026-10-17:* nothing blocks the bot push. Rulesets aren't available on a private repo on the free plan (the API answers 403 "Upgrade to GitHub Pro"), and classic protection is off. If the repo goes public and a ruleset is added, it needs a GitHub Actions bypass.
  - Depends on T042, T066 (`INTERVALS_API_KEY` secret already set, T003 note).
  - **Done 2026-10-17 (Phase 2g).** Choices:
    - **Write access is split off.** `publish` (process, `publish-check`, gate, path check) runs with `contents: read`, because it runs npm and ingest code. A separate `commit` job, the only one with `contents: write`, runs only git and tar: it unpacks the gated tree over `data/running/published/` (so removals carry through), re-checks the paths and pushes `HEAD:main` from the commit `publish` checked out. A rejected push fails the run, and nothing is committed.
    - **Newest `main`:** `publish` checks out `main`, not the triggering commit, because a queued run can start later.
    - **Branch runs are fetch-only.** Any ref other than `main` runs only `fetch` and `alert`, like `fetch_only: true`.
    - **Fetch failures don't block publishing:** `publish` runs unless the run was cancelled, so archived data and owner-file changes still publish. A failed fetch still makes the run red.
    - **Deploy** uses the `dist/` the gate built, after a bot commit or an owner-file push.
- [X] T068 [P] Create `src/worker/freshness.ts`:
  - `GET /running/api/freshness` reads `public/freshness.json` from the R2 binding.
  - It returns `200 application/json` `{"intervals":{"last_success_at":...},"generated_at":...}` with `Cache-Control: public, max-age=300`.
  - It returns `503` if the object is absent or the read fails.
  - Every other path falls through to the static assets.
  - **Done 2026-10-17 (Phase 2g).** The record is re-shaped to the contract's two fields (anything more in R2 is dropped), and a missing or malformed timestamp is a 503 with `Cache-Control: no-store`. `HEAD` is answered; other methods get 405.
- [X] T069 ~~(Only if `FETCH_MODE=pc`.) PC fallback via Windows Task Scheduler.~~ **Dropped 2026-10-17**: Spike 0 showed Actions can fetch directly; there is no PC fallback.
- [X] T070 **Rewritten.** Fetch-only production smoke check (nothing is published or deployed): run `uv run awingest fetch --health-only --archive r2` locally (owner's `INTERVALS_API_KEY` and `R2_*` user env vars), then dispatch `refresh.yml` once with `fetch_only: true` (T067). Confirm 200s with the descriptive User-Agent, wellness objects in R2 hold approved keys only, `state/fetch-status.json` + `public/freshness.json` are written, and no commit or deploy happened. If the key is rejected (`AuthRejected`), go to T071. The first real publish is T085, through the gated bot path, after T077–T084. Depends on T054, T066, T067.
  - **Actions half done 2026-10-17** (Phase 2g): `refresh.yml` ran fetch-only from the PR branch (run 39068003372; a branch run is fetch-only by design, the same path as `fetch_only: true`). fetch: 9 activities and 15 wellness days for 2026-10-03..17, outcome `ok`, exit 0. A throwaway check (run 39068284922; names and counts only) found every activity with all six parts, wellness objects holding approved keys only, `state/cursor.json`, `state/fetch-status.json` (`ok`, 0 failures) and `public/freshness.json` written. `publish`, `commit` and `deploy` were skipped, and `alert` ran. The local `--health-only` half was **dropped** (owner, PR #23): Spike 0 already showed local calls work, and the Actions run covered every check.
- [ ] T071 OWNER: **Rewritten.** (Only if T070 shows the key is rejected.) Generate a new API key in intervals.icu (*Settings → Developer Settings*) and paste it into the `gh secret set INTERVALS_API_KEY` command and the user env var the agent supplies.

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
- [ ] T075 [P] Create the OG image renderer `src/shared/og/render.ts`: satori 0.62.0 → SVG → sharp 0.35.5 PNG at build time. It uses the bundled Inter font (OFL) in `src/shared/og/fonts/` and provides an `/og/<path>.png` endpoint helper. Also add the site-home OG card for `src/pages/index.astro`.
- [ ] T076 Create the section data and freshness UI:
  - **Loader**: `src/sections/running/data/load.ts`, a typed, validated and memoised loader over `RunningStore`.
  - **`LastUpdated.astro`** (`src/sections/running/components/`):
    - Without JS, it shows the build-time "as of last site update" value from `refresh.json`.
    - An inline script under 1 KB polls `/running/api/freshness`, renders "Last updated <relative>", and un-hides the stale notice once the data is older than `stale_after_hours` (baked in at build). On a 503 it keeps the build-time text (FR-005/006/074).
  - **`SectionLayout.astro`**: the section nav built from the route registry (T018), with a `LastUpdated` slot.
- [ ] T152 Create `src/sections/running/components/GarminAttribution.astro` (FR-077; a condition of the intervals.icu API terms, effective 2025-10-23):
  - Re-read Garmin's current brand guidelines first and follow them exactly for wording, logo/mark use and placement; record the source URL and date in a comment and in `src/sections/running/README.md`.
  - **Placement follows the guidelines** (FR-077 "view" = a page, chart, tile or card showing Garmin-sourced data): page-level (e.g. rendered once from `SectionLayout.astro`, T076) or next to each chart/tile/card, whichever the guidelines require. Record the placement decision in the `PROJECT_MEMORY.md` decisions log. `SectionLayout` is the starting assumption, not the final answer.
  - Every Running page or component that shows Garmin-sourced data (runs, health readings, manual Garmin figures) carries it as placed; it stays visible without JS and meets contrast/a11y rules (text alternative for any mark).
  - Add an e2e assertion (in each story's e2e spec: T095, T109, T123, T137, T144) that the attribution is present, matching the chosen placement, on landing, goals, training, run, race and health pages.

### 2i. Foundational graduation coverage, backfill and first publish

- [X] T077 [P] Create synthetic, anonymised intervals.icu fixtures in `ingest/tests/fixtures/intervals/`, shaped from the Spike 0 payloads (`spikes/intervals/out/raw/`, gitignored). **No real values are copied into git.** They include:
  - injected sentinel `latlng`, start times, free-text `name`/`description`, location strings, intervals.icu IDs and Garmin `external_id`s for the privacy tests
  - a run with dynamics + power, and a run without them
  - a `VirtualRun` (treadmill), a race, a `TrailRun` and a non-run activity (e.g. `WeightTraining`)
  - wellness days with every approved metric **plus** `sleepSecs`, `steps` and `spO2` (to prove they are dropped before archiving)
  - error responses: 401, 403 with a JSON body, 403 with an HTML challenge body, 429 with `Retry-After`
  - **Done 2026-10-17**: written by `make_fixtures.py` in that folder (re-run to regenerate; output is reproducible). The Spike 0 payloads weren't available in the cloud session, so the shapes follow `RESULTS.md` and the OpenAPI field names; every value is invented. A 503 response and a `trainer: true` outdoor run were added.
- [X] T078 [P] Create the parameterised storage contract suite `ingest/tests/contract/test_raw_archive.py`, run against `LocalArchive` and `R2Archive` (moto 5.2.3). It covers round-trip, idempotent re-put, `if_match` conflict, key validation, atomicity under injected failure, and a 5,000-object listing.
  - **Done 2026-10-17** with T048–T049 (moto 5.2.4). With `AWINGEST_TEST_R2_LIVE=1` and the `R2_*` variables it also runs against real R2 under a `test/` prefix (skipping the 5,000-object listing); it passed there from Actions.
- [X] T079 [P] **Rewritten.** Create the adapter contract suite `ingest/tests/contract/test_intervals_adapter.py`. It covers:
  - required fields, normalised units and type mapping (`VirtualRun` → `indoor` + `treadmill: true`)
  - non-run activities rejected
  - missing optional metrics are `None`, never 0; per-km splits computed from streams
  - Europe/London conversion and determinism
  - the adapter never emits a public ID
  - error mapping to the taxonomy, incl. 403-HTML → `ProviderForbidden` vs 401/403-JSON → `AuthRejected`, and 429 → `RateLimited` with `rate_limited_until`
  - every request carries the descriptive User-Agent and Basic auth; the key never appears in logs
  - non-approved wellness keys (`sleepSecs`, `steps`, `spO2`) are absent from archived and normalised output
  - incremental windows: cursor minus 14 days, unchanged list rows not re-fetched
  - **Done 2026-10-17**, with `tests/unit/test_fetch.py` (status, cursors, freshness, partial failure, back-off), `test_backfill.py` (windows, resume, cursors) and `test_cli.py`.
- [X] T080 [P] Create `ingest/tests/unit/test_sanitise.py` and `ingest/tests/unit/test_run_ids.py`:
  - exhaustive allow-list tests
  - a **property test** that feeds random raw payloads with sentinels (incl. `latlng` and free-text names/descriptions) and asserts none appear in the serialised output of training runs
  - hidden runs are not written; `treadmill` and `include_indoor_in_records` are mirrored correctly
  - run IDs are stable, append-only and collision-free, and abort when the map is unreadable
  - the processor never emits a provider ID
- [X] T081 [P] Create `ingest/tests/unit/test_best_efforts.py`, `test_plausibility.py` and `test_health.py`. They cover:
  - a 44:41 continuous 10 km found inside a longer run
  - the plausibility thresholds
  - the weight example `101.2, 100.6, 101.0, 100.4, 100.8, 100.2, 100.5` → `weight_avg7` 100.7
  - an empty window gives an omitted day
  - excluded readings are removed
- [X] T082 [P] Create `ingest/tests/contract/test_writer.py`, `test_cli.py`, `test_alerts.py` and `test_schemas.py`. They cover:
  - the writer refuses paths outside the published zone and rejects invalid schemas
  - canonical formatting and staging atomicity
  - the CLI exit codes
  - alert open, update and close per failure class (against a fake GitHub API)
  - the shared schema fixtures (T033)
  - **Schema part done 2026-10-17**: `ingest/tests/contract/test_schemas.py` runs the shared fixtures and the injected-key checks; `ingest/tests/unit/test_yaml12.py` covers `awingest.yaml12`, the YAML 1.2 loader that T061 must use for owner files (PyYAML's YAML 1.1 rules turn `3:30:00` into 12600 and dates into `datetime.date`). The writer, CLI and alert tests remain.
  - **Done 2026-10-17** with T063–T066: `tests/contract/test_writer.py`, `tests/contract/test_alerts.py` (fake GitHub API) and the CLI cases in the existing `tests/unit/test_cli.py`. T080–T081 are in `tests/unit/` (`test_sanitise.py`, `test_run_ids.py`, `test_best_efforts.py`, `test_plausibility.py`, `test_health.py`), plus `test_overrides.py` and `test_pipeline.py` (end to end over the fixture archive).
- [X] T083 [P] Create TS contract tests `tests/contract/schemas.test.ts` (same shared fixtures as T082) and `tests/contract/store.test.ts`. They check the `DataValidationError` shape, newest-first ordering and the speed of listing 5,000 runs.
  - **Done 2026-10-17** with Phase 2a–2b.
- [X] T084 [P] Create TS unit tests `tests/unit/format.test.ts`, `validate-data.test.ts`, `check-boundaries.test.ts`, `scan-privacy.test.ts` and `freshness-worker.test.ts`. They cover:
  - the referential and duplicate-race errors
  - a malformed `"3:7x"` time naming the file, entry and field
  - seeded privacy violations are detected, while durations do not produce false positives
  - the Worker's 200 and 503 paths
  - **Done 2026-10-17 except `freshness-worker.test.ts`**, which comes with the Worker (T068).
  - `freshness-worker.test.ts` **done 2026-10-17** with T068.
- [ ] T085 Run the backfill and first publish:
  1. Run `uv run awingest backfill` (resumable; agent-run locally with the owner's `INTERVALS_API_KEY`/`R2_*` user env vars).
  2. Dispatch `refresh.yml` (without `fetch_only`) so the **first publish goes through the real gated bot path**.
  3. For SC-009, compare 20 random published runs with their raw intervals.icu summaries in R2 (distance, time, HR), and record the result in the PR description.
  4. After a post-import backfill, check the wellness history: the earliest date per wellness field (weight, body fat, HRV, VO2 max, resting HR), from the T150 probe re-run, is recorded in `PROJECT_MEMORY.md`; if wellness history did not import, raise it with the owner (accept the gap, or add a manual history path).

  Depends on T001, T055, T067, T070 and T077–T084. **The full-history backfill needs T150** (Garmin export imported into intervals.icu); if T150 is still pending, publish what intervals.icu has (from 2025-10-18) and re-run `backfill --from <earliest>` after the import.
- [ ] T086 Run the graduation review of the shared plumbing (storage layer, intervals.icu adapter, sanitiser + run IDs + privacy scan, shared shell, Garmin attribution):
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
predictions (the owner's latest dated entries, shown "as of"), celebrates achieved goals, and evaluates achievement automatically from stored data.

**Independent Test**: Define one race-time, one weight, one body-fat and one VO2 max goal and
refresh. Each shows the correct progress. Then add a run containing a qualifying effort: the
matching goal becomes achieved with the right date.

### Implementation for User Story 2

- [ ] T087 [P] [US2] Create the Best Effort index in `src/sections/running/domain/efforts.ts`:
  - **Eligible runs**: not indoor/treadmill unless the owner set `include_in_records`, not `excluded_from_records`, and `plausible: true`.
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
  - **Predictions**: for 5k, 10k, half and marathon, the latest owner-entered Garmin prediction and its `as_of` date are attached from `manual-metrics.yaml` (T153; FR-038, FR-069).
  - **Highlight**: a goal is flagged "newly achieved" within `recent_highlight_days.goal` days.

  Depends on T087, T088 and T153.
- [ ] T090 [P] [US2] Create the goal cards in `src/sections/running/components/`:
  - `GoalCard.astro` shows the target, current value and a `ProgressBar`, plus the time left to the deadline or "deadline passed", "no data yet", the fastest effort with a run link, and "Garmin predicted 20:47 (as of 1 Mar 2027)" via `AsOf.astro` (T153), or nothing when there is no prediction entry.
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
- [ ] T153 [P] [US2] Create the manual Garmin figures support (FR-069):
  - `src/sections/running/domain/manual-metrics.ts`: reads `manualMetrics` from the loader, returns the latest entry per list (current training status; current prediction per distance, each with its `as_of`) and the full dated history for trends; "not recorded yet" when absent.
  - `src/sections/running/components/AsOf.astro`: renders a value with "as of <UK date>" (e.g. "as of 1 Mar 2027"), used by goal cards, the hero and the health page.
  - `data/running/owner/manual-metrics.yaml` from the owner's values (T154), validated by T151.
  - Unit tests in `tests/unit/manual-metrics.test.ts` (latest-entry selection, per-distance latest when entries cover different distances, empty file).
- [ ] T154 [US2] OWNER: Read the current Garmin training status and race predictions (5k, 10k, half, marathon) in Garmin Connect and give them to the agent, with the date read. The agent asks at the US2 PR review and writes `manual-metrics.yaml`; afterwards the owner sends new readings whenever they like (the agent offers at reviews already happening, never as a chore).
- [ ] T094 [P] [US2] Create `tests/unit/goals.test.ts`, covering:
  - acceptance scenarios US2.1 (44:41 inside a longer run gives achieved on 12 Mar 2027), US2.2 (prediction 20:47 as of 1 Mar 2027), US2.3 (26.0 → 22.0 toward 17.5 ≈ 47%), US2.4 (target revised), US2.5 (deadline passed, then retired), US2.6 (regression stays achieved)
  - edge cases: no data yet; indoor/treadmill and implausible efforts excluded; a treadmill run with `include_in_records` counts; a hand-entered race counts; an override; no prediction entry
- [ ] T095 [P] [US2] Create `tests/e2e/goals.spec.ts` and `tests/a11y/goals.spec.ts`. They cover the 360 px layout, priority ordering, the achieved list, and US2.7 (a malformed `"3:7x"` stops the build with a message naming the file, goal and field, and leaves `dist/` untouched), Garmin attribution present as placed (T152), with zero axe violations and a working keyboard path.

**Checkpoint**: The Goals page works on its own and can be shipped.

---

## Phase 4: User Story 1 - Landing page: the Brighton-led goals hub (Priority: P1) (MVP with US2)

**Goal**: `/running/` answers "how is Alex doing and what is he aiming for?". It shows the Brighton
hero (countdown, target, Garmin prediction "as of" its date, charity, training build), featured
goals, this week, the latest run, and links to the other areas.

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
  - **Treadmill/indoor runs are included** in both the snapshot and the training build (FR-058). T087's PB-eligibility filter is not reused here.
  - **Latest run**.
- [ ] T098 [P] [US1] Create `src/sections/running/components/Hero.astro`:
  - "Brighton Marathon · 4 April 2027".
  - Days remaining, or "Race day", or "result coming soon", or the result.
  - "Target: sub-3:30", taken from the upcoming race's `target_time`.
  - The latest owner-entered Garmin marathon prediction with its "as of" date (`AsOf`, T153), or nothing if none is recorded.
  - "For Martlets hospice" as plain text.
  - A **reserved fundraising slot that renders nothing** (FR-025).
  - A `TrainingBuild` BarChart of weekly km and the longest run (FR-021).
- [ ] T099 [US1] Create `src/sections/running/components/ThisWeek.astro` and `RunCard.astro`. The run card shows the date only (no time), title, distance, time and pace, the "Treadmill" label for treadmill runs (`TreadmillBadge`, T155), and links to `/running/runs/<id>/`. Depends on T155.
- [ ] T155 [P] [US1] Create `src/sections/running/components/TreadmillBadge.astro` (FR-058): a text "Treadmill" label (not colour-only, accessible name) shown wherever a run with `treadmill: true` appears — `RunCard` (T099), the minimal and full run page (T102/T121), `RunList` (T115) and race history if a treadmill run is designated a race. Treadmill runs never render `RaceMap` (no `track_ref`, T125). PB/race-time-goal eligibility stays off unless the owner sets `include_in_records: true` in `run-overrides.yaml` (enforced in T087/T129). Tests: a unit case in `tests/unit/goals.test.ts`/`pbs.test.ts` for the override, and an e2e check (T109/T123) that the label shows and no map renders.
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
- [ ] T102 [US1] Create a minimal `src/sections/running/pages/runs/[id].astro` with summary figures only (date, title, distance, moving time, pace, avg HR, `TreadmillBadge` where relevant), so the latest-run card links somewhere before US3 lands. It shows **no start time, map or location** and uses the shared OG card. US3 extends this file. Depends on T155.
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
  - a treadmill run counted in the this-week snapshot and the training build (FR-058)
- [ ] T109 [P] [US1] Create `tests/e2e/landing.spec.ts` and `tests/a11y/landing.spec.ts`. At 360 px they cover:
  - acceptance scenarios US1.1–US1.7, including a stale fixture over 12 h showing the notice, and the story link absent or present
  - the "Treadmill" label on a treadmill latest-run card (T155), with no map
  - Garmin attribution present as placed (T152)
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
- [ ] T112 Go live on the custom domain. Once T004 nameservers are active, add the custom domain `alexanderwebber.com` (+ a `www` → apex redirect) in `wrangler.jsonc` and deploy. Verify HTTPS, `/running/api/freshness` and the Garmin attribution on live pages. **Then prompt the owner to become an intervals.icu supporter** ($4/month; owner decision 2026-10-17: they intend to once the live integration works). Put it in the go-live PR as a checkbox question; note the outcome (and the recurring cost, if adopted) in `PROJECT_MEMORY.md` and plan.md *Recurring costs*.

---

## Phase 6: User Story 3 - Training stats and run detail (Priority: P2)

**Goal**: Training totals and trends by week, month, year and all-time; a browsable run list; and
full run detail pages. Training runs show the date only: no start time, map or location.

**Independent Test**: With the full backfill stored, browse the totals, open any training run, and
confirm all available detail appears while no start time, map or place name appears anywhere.

### Implementation for User Story 3

- [ ] T113 [P] [US3] Create `src/sections/running/domain/periods.ts`: totals by week (Monday–Sunday, Europe/London), month, year and all-time. Each has runs, distance, moving time, distance-weighted average pace and elevation gain. Indoor/treadmill runs are **included** in totals (FR-045, FR-058).
- [ ] T114 [P] [US3] Create `src/sections/running/components/PeriodTotals.astro`: a `BarChart` per period, switched with a CSS-only toggle (week/month/year), with supporting figures and all-time totals.
- [ ] T115 [P] [US3] Create `src/sections/running/components/RunList.astro`:
  - Newest first, grouped by month.
  - Each row shows date, title, distance, time and pace, with a race badge and the `TreadmillBadge` (T155) for treadmill runs.
  - A pre-rendered "All runs / Races only" CSS toggle (FR-046) implements routes.md's `?races=1` filter on the static site.
- [ ] T116 [P] [US3] Create `src/sections/running/components/RunSummary.astro`: distance, moving and elapsed time, average and best pace, elevation gain/loss, average and max HR, and training effect (absent with intervals.icu, so normally omitted). Each item is omitted when not recorded (FR-048).
- [ ] T117 [P] [US3] Create `src/sections/running/components/SplitsTable.astro` (per-km splits) and `HrZones.astro`. Each is omitted when absent.
- [ ] T118 [P] [US3] Create `src/sections/running/components/RunDynamics.astro`: cadence, stride length, power, ground contact time, GCT balance, vertical oscillation and vertical ratio. Each is omitted when absent, never shown as 0.
- [ ] T119 [P] [US3] Create `src/sections/running/components/RunSeriesCharts.astro`: pace, HR, elevation, cadence and power, plotted against distance or elapsed time, **never clock time** (FR-013). Each chart is omitted when its series is absent and uses `ChartFigure` with a text alternative and table.
- [ ] T120 [US3] Create `src/sections/running/pages/training.astro` at `/running/training/` (period totals plus the current year's run list and year links) and `src/sections/running/pages/training/[year].astro` at `/running/training/<year>/`. Register the routes. OG: the hub card `/og/running-training.png` and the shared `/og/running-year.png`.
- [ ] T121 [US3] Extend `src/sections/running/pages/runs/[id].astro` to full detail (FR-047), adding:
  - the owner's title and note
  - the race badge and `TreadmillBadge`
  - the shared OG card `/og/running-run.png` (no per-run images)
  - no start time, map, route or place name anywhere in the URL or HTML

  Depends on T102 and T116–T119.
- [ ] T122 [P] [US3] Create `tests/unit/periods.test.ts`, covering week, month and year boundaries in Europe/London, distance-weighted pace and indoor/treadmill runs included.
- [ ] T123 [P] [US3] Create `tests/e2e/training.spec.ts`, `tests/e2e/run-detail.spec.ts` and `tests/a11y/training.spec.ts`. They cover acceptance scenarios US3.1–US3.6 (incl. the treadmill label and no map), privacy assertions on a training run started at 06:42 (date only, no provider free-text name), panels omitted when absent, Garmin attribution present, and zero axe violations.
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
  - **When**: only when `is_race` is true, the run is not `treadmill` (FR-058), and the map is not hidden.
  - **Simplification**: Douglas–Peucker to `<= ~1,000 points`.
  - **Trim and bbox**: applies `trim_ends_m` (default 0) and computes the bbox.
  - **Output**: writes `race-tracks/<run-id>.json` via `PublishedWriter` and sets the run's `track_ref`.
  - **Removal**: removes the track when `hide_map` is set or the run is designated `not_race`.
  - **Hook-up**: wire it into `process/pipeline.py`. The override hash includes `race.yaml`.
- [ ] T126 [P] [US4] Create `ingest/tests/unit/test_race_track.py`. It checks that:
  - training runs never get a track
  - treadmill runs never get a track, even when designated a race
  - `hide_map` removes the track
  - trimming works
  - tracks have `<= 1000` points and are schema-valid
- [ ] T127 [P] [US4] Create `scripts/add-race-photo.ts`, which uses sharp to **strip all metadata**, apply EXIF orientation and cap the long edge at 2,400 px. It writes the photo into `data/running/owner/races/<slug>/photos/` and appends a `photos` entry. A description is required.
- [ ] T128 [P] [US4] Extend `src/sections/running/domain/races.ts` with the race history:
  - It combines provider-flagged (intervals.icu `race`) or owner-designated runs with hand entries, joined **only on an explicit `run_id`** (no fuzzy merge).
  - Official details win (FR-051).
  - The slug is the owner `slug`, else the run ID.
  - Each race appears once, newest first.
- [ ] T129 [P] [US4] Create `src/sections/running/domain/pbs.ts`. For each standard distance (5k, 10k, half, marathon + any other raced distance):
  - the fastest race result (official time beats device time; hand-entered results included)
  - the fastest eligible any-run effort, where it is faster (FR-053); treadmill efforts only with the owner's `include_in_records` (FR-057)
  - a "recent" highlight within `recent_highlight_days.pb` days (US4.7)
- [ ] T130 [P] [US4] Create `src/sections/running/components/PBTable.astro`, `RaceHistory.astro` and `UpcomingRaces.astro`. Upcoming races show the focus race first, then by date, each with days remaining, target time and link. Completed races leave the list (FR-056).
- [ ] T131 [P] [US4] Create `src/sections/running/components/RaceMap.astro`:
  - **Static baseline**: a build-time SVG route with km markers and a km-axis elevation profile, with zero third-party requests.
  - **Interactive enhancement**: a "Load interactive map" button lazy-imports maplibre-gl 6.14.0 with OpenFreeMap tiles **only on click**, with attribution. It is the only JS-budget exception.
  - **Absence**: renders nothing when there is no track.
- [ ] T132 [P] [US4] Create `src/sections/running/components/PhotoGallery.astro`: `astro:assets` AVIF/WebP, lazy loading, with the `description` as alt text and an optional caption (FR-055).
- [ ] T133 [US4] Create `src/sections/running/pages/races.astro` at `/running/races/` (history, PB table, upcoming races) and `src/sections/running/pages/races/[slug].astro`. Each race page shows:
  - the official time, position, results link and note
  - `RaceMap`
  - the full run detail via the US3 components when there is a `run_id`
  - `PhotoGallery`
  - a per-race OG card from `src/sections/running/og/race.ts`

  Register the routes, and link race runs in the run list and run pages to their race pages.
- [ ] T134 [US4] OWNER: Supply pre-Garmin race results (date, name, distance, official time), official chip times and positions for Garmin-recorded races, and race photos with descriptions, and confirm the agent's candidate race list (T157). The agent asks at the US4 PR review.
- [ ] T157 [US4] Draft the candidate race list (Garmin sync never sets intervals.icu's `race` flag, FR-050; RESULTS.md). The agent scans the private raw R2 data (raw activity names, distance/pace patterns such as near-standard distances run near PB pace, and race-day dates the owner recalls) and drafts candidates keyed by opaque public run ID with date, distance and time. Raw names are shown to the owner only in the conversation, never in git or a PR body. The owner confirms or rejects each at the US4 PR review (with T134); confirmed races feed T135.
- [ ] T135 [US4] From the owner's input (T134) and the confirmed candidate list (T157), write `data/running/owner/races/<slug>/race.yaml` entries, record each confirmed race's designation (`designate: race` in its `race.yaml` when it has race details, else `run-overrides.yaml` `is_race: true`), and run `scripts/add-race-photo.ts` for each photo. Raise a PR. `validate-data` must pass, including the duplicate-race check.
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
  - Garmin attribution present as placed (T152)
  - zero axe violations

**Checkpoint**: Races and PBs work on their own, on top of US3's run detail.

---

## Phase 8: User Story 5 - Health and performance metrics (Priority: P3)

**Goal**: Trend charts with current values and targets for VO2 max, fitness/fatigue/form
(intervals.icu's model), Garmin training status and race predictions (owner entries, "as of"),
resting HR, HRV, weight (7-day average only) and body fat, with lab reference markers.

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
  - training-status labels and race-prediction history from `manual-metrics.ts` (T153), each point dated by `as_of`
- [ ] T139 [P] [US5] Create `src/sections/running/components/MetricTrendChart.astro` (a `LineChart` with `RangeToggle`, a target line and labelled "Lab test" / "DEXA scan" markers) and `LabComparison.astro` (device value, lab value and difference).
- [ ] T140 [P] [US5] Create `src/sections/running/components/RacePredictions.astro` (all four distances, latest entry with `AsOf`, plus a trend of the dated entries), `HrvChart.astro` (rMSSD; the baseline band only where baseline data exists, which intervals.icu does not supply; starting at the first point with a short note, never zeros) and `TrainingStatus.astro` (latest status with `AsOf`, plus the dated history; "not recorded yet" when empty).
- [ ] T156 [P] [US5] Create `src/sections/running/components/FitnessChart.astro` and its domain helper in `src/sections/running/domain/health.ts` (FR-060): fitness (`fitness_ctl`), fatigue (`fatigue_atl`) and form (= fitness − fatigue, derived at build) as a `LineChart` with `RangeToggle`, text alternative and table; clearly **labelled as intervals.icu's fitness/fatigue model, not Garmin's training load**. Unit test the form derivation and the label in `tests/unit/health.test.ts`.
- [ ] T141 [US5] Create `src/sections/running/pages/health.astro` at `/running/health/`. It shows:
  - VO2 max, fitness/fatigue/form (T156), training status and race predictions ("as of" owner entries), resting HR and HRV
  - **weight as the 7-day average only**, labelled as such
  - body fat as recorded readings with a trend line and the 17.5% target
  - lab markers
  - `LastUpdated`

  Register the route and add the OG hub card `/og/running-health.png`.
- [ ] T142 [US5] OWNER: When lab tests happen (DEXA, lab VO2 max), share the results. The agent writes `data/running/owner/lab/<date>-<type>.yaml` via a PR. This does not block US5, which is verified with fixtures.
- [ ] T143 [P] [US5] Create `tests/unit/health.test.ts`, covering US5.4 (lab 51.0 vs Garmin 54 gives a difference of −3.0), US5.5 (two DEXA points), range slicing, US5.7 (HRV start), form = ctl − atl, and manual training-status/prediction history ordered by `as_of`.
- [ ] T144 [P] [US5] Create `tests/e2e/health.spec.ts` and `tests/a11y/health.spec.ts`. They cover acceptance scenarios US5.1–US5.7 (incl. "as of" dates and the intervals.icu model label), that no individual daily weights appear anywhere, that **no sleep, stress, Body Battery, steps or SpO2 data appears on any page**, Garmin attribution present, and zero axe violations.

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
  - Owner tasks: T001, T002 and the API key (T003 note) are done. T004 blocks go-live only. T150 (Garmin export import) blocks only the full-history backfill (T085).
  - **Spike 0 (T005–T012) is done** (intervals.icu coverage passed, 2026-10-17).
  - Spike 1 (T013–T014) and the scaffold (T015–T022) are the next agent work and run in parallel.
- **Phase 2 (Foundational)**:
  - Depends on the scaffold. Schemas, storage, gate, processor and shell can start straight after Phase 1c.
  - T051–T055 (intervals.icu adapter + fetch) start once T021 (`pyproject.toml`) and T047 (provider contract) exist; T054 also needs T049 (Spike 0 is done).
  - T070 is a fetch-only smoke check (no publish, commit or deploy).
  - T085 (backfill + first publish) needs the whole pipeline and the graduation tests T077–T084; its full history needs T150.
  - BLOCKS all stories.
- **Phase 3 (US2)** → **Phase 4 (US1)**: both P1. US1's featured goals reuse US2's `goals.ts` and `GoalCard`.
- **Phase 5 (go-live)**: after US2 + US1. It also needs T004.
- **Phase 6 (US3)**: after Phase 2. It can start in parallel with US2/US1. It extends US1's minimal run page (T102 → T121).
- **Phase 7 (US4)**: after Phase 2 and the US3 run-detail components (T116–T119).
- **Phase 8 (US5)**: after Phase 2. It is independent of US1–US4 apart from goal targets (`goals.ts`, T089) for target markers and the manual Garmin figures support (`manual-metrics.ts` + `AsOf`, T153).
- **Phase 9 (Polish)**: after the stories that are in scope.

### Story completion order (graph)

```text
Owner T001-T003 (done) ─┐
Spike 0 T005-T012 (done)┤
T021 pyproject + T047 ──┴─> fetch stage (T051-T055) ─> T070 fetch-only smoke ────────┐
Scaffold T015-T022 ─> Phase 2 (schemas/storage/gate/processor/shell) ─> T077-T084 ───┴─> T085 backfill + first publish
Owner T150 (Garmin export -> intervals.icu) ─────────────────────────────────────────┘ (full history only)
                                                                                     │
                     ┌───────────────────────────────────────────────────────────────┘
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
  - Spike 1a and 1b ([P]) and the whole scaffold block run in parallel.
  - T020, T021 and T022 are [P].
- Phase 2:
  - Every schema task T023–T032 and T151 is [P].
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
Task: "T153 [US2] manual-metrics.ts + AsOf.astro"
# after T089/T091:
Task: "T094 [US2] tests/unit/goals.test.ts"
Task: "T095 [US2] tests/e2e/goals.spec.ts + tests/a11y/goals.spec.ts"
```

## Parallel Example: User Story 1

```text
Task: "T096 [US1] domain/races.ts state machine"
Task: "T097 [US1] domain/weeks.ts"
Task: "T098 [US1] Hero.astro"
Task: "T100 [US1] StoryLink.astro + SectionLinks.astro"
Task: "T155 [US1] TreadmillBadge.astro"
# after T155:
Task: "T099 [US1] ThisWeek.astro + RunCard.astro"
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
Task: "T156 [US5] FitnessChart.astro (intervals.icu fitness/fatigue/form)"
```

---

## Implementation Strategy

### MVP first (US2 + US1; both P1)

1. Phase 1: owner prerequisites and **Spike 0** are done (intervals.icu chosen and verified);
   Spike 1 and the scaffold come next, with T004 and T150 still with the owner.
2. Phase 2: Foundational, ending with the backfill and the first gated bot publish (CRITICAL;
   blocks all stories).
3. Phase 3: US2 Goals. Phase 4: US1 Landing.
4. **STOP and VALIDATE**: run the US1/US2 independent tests at 360 px.
5. Phase 5: graduation review, then go live on alexanderwebber.com.

### Incremental delivery

Each story is a PR-sized slice (one implement session per slice, per the house session norm):

1. Setup (Spike 0 done) → Foundational → data flowing from intervals.icu every 2 h.
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
