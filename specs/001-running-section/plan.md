# Implementation Plan: Running Section

**Branch**: `001-running-section` | **Date**: 2026-10-04 (amended 2026-10-17: provider is
intervals.icu) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-running-section/spec.md`

## Summary

Build the Running section (landing hub, goals, training + run detail, races & PBs, health &
performance) as a **static Astro 7 site on Cloudflare Workers static assets**, fed by a
**two-stage Python pipeline** that keeps the repo safe to publish:

1. **fetch** — an **intervals.icu** provider adapter (official Garmin sync partner; personal API
   key, HTTP Basic, descriptive User-Agent) pulls incrementally by date window, on GitHub Actions,
   into a **private Cloudflare R2 bucket** (full raw history, never in git).
2. **publish** — a deterministic processor normalises the raw payloads (intervals.icu adapter),
   applies an **allow-list sanitiser** (drops start times, training-run GPS (`latlng`) and
   free-text names/descriptions, unapproved metrics; reduces weight to a 7-day average; replaces
   provider activity IDs with **opaque public run IDs** such as `2027-03-14-k3f7`), computes best efforts, and writes **versioned JSON into git** behind a
   storage abstraction. A build gate (schema validation of published + owner data, privacy scan,
   section-boundary check, site build) must pass before the bot commit and deploy.

Owner-entered content (section settings, goals, races, photos, lab results, manual Garmin
figures — training status and race predictions, dated — and overrides) is hand-edited YAML in git,
validated against the same JSON Schemas as machine data. Goals, PBs and charts are derived at
build time (pure functions of stored data), so there is no mutable server state. Charts are
build-time SVG with accessible tables (no chart library); race maps are a static SVG route with a
lazily loaded MapLibre enhancement. A minimal **shared shell** (layout, nav, design tokens, chart
primitives, storage layer) is built here and graduated as shared plumbing; Running is an
Astro integration that injects its own routes so it can be added/removed independently.

**Spike 0 (done, passed 2026-10-17)** was the intervals.icu coverage check: every required field
is returned for Garmin-synced data, locally and from GitHub Actions, except Garmin training status
and race predictions, which become dated owner entries ([spikes/intervals/RESULTS.md](../../spikes/intervals/RESULTS.md),
research.md R0). Garmin views carry Garmin attribution (intervals.icu API terms). Fetch runs on
Actions only; there is no PC fallback.

## Technical Context

**Language/Version**: TypeScript **6.0.3** (Astro 7.4.2, Node >= 22.23.4; local Node 24.15) for
site + Worker; Python >= 3.12 (3.12.10 local) for ingest/processing. TypeScript 7.0.x is
deliberately **not** adopted: `@astrojs/check` 0.9.12 peer-requires `typescript ^5 || ^6`, so TS 7
would break `astro check` in the build gate. Revisit when `@astrojs/check` supports TS 7
(decisions-log entry required — see Complexity Tracking).

**Primary Dependencies**: Astro 7.4.2, TypeScript 6.0.3, `@astrojs/check` 0.9.12, sharp 0.35.5
(images/OG), satori 0.63.2 (OG), ajv 8.20.0, yaml 2.9.1, json-schema-to-typescript 16.0.0,
maplibre-gl 6.15.0 (lazy, race maps only), wrangler 4.152.0; Python: boto3 1.43.114, jsonschema
4.26.0, pyyaml 6.0.3; the intervals.icu client uses the standard library (`urllib.request`, as in
Spike 0), so no HTTP or provider library is added. See [research.md](research.md) for the
comparison tables. (Pins re-verified at scaffold time, T016, 2026-10-17.)

**Storage**: (a) Private Cloudflare R2 bucket `alexanderwebber-private` = raw archive +
operational state (`RawArchive` abstraction: `R2Archive`, `LocalArchive`). No credentials or
tokens are stored there: the only provider secret is `INTERVALS_API_KEY` (GitHub secret). The
provider-ID -> public-run-ID map lives only here. (b) Git = sanitised published JSON
(`data/running/published/`) + owner YAML (`data/running/owner/`) behind a TypeScript
`RunningStore` read interface (`JsonFileStore`) and a Python `PublishedWriter`. See
[contracts/](contracts/).

**Testing**: Vitest 5.0.5 (TS unit + contract), pytest 9.1.1 + moto 5.2.4 (Python), Playwright
1.64.1 + @axe-core/playwright 4.14.0 (e2e, keyboard/a11y), Lighthouse **13.5.0 CLI** run directly
(perf budget, non-blocking; `@lhci/cli` 0.15.1 is not used because it still bundles Lighthouse
12.x). Synthetic anonymised intervals.icu fixtures (shaped from the Spike 0 payloads); shared JSON Schema contract fixtures in both
languages. Test suites run **locally and at graduation**, not in the mandatory gate; the gate is
site build + data-schema validation (privacy scan, image scan and boundary check count as
validation).

**Target Platform**: Cloudflare Workers static assets (+ one small Worker route for freshness);
GitHub Actions (ubuntu-latest) for scheduled jobs, including fetch (Spike 0 confirmed Actions can
reach intervals.icu). Browsers: evergreen mobile-first, 320 px up.

**Project Type**: Web application — static site + serverless Worker + scheduled Python data
pipeline (modular monorepo, one repo).

**Performance Goals**: Lighthouse mobile performance >= 90 on every page (SC-006); landing main
content <= 2.5 s on simulated mid-range phone; 5,000 runs browsable at the same bar (SC-011).

**Constraints**: **Client JS budget: <= 10 KB gzip on every page except race pages' optional
map**; per-page weight budget <= 150 KB HTML+CSS+JS excluding images (race photos lazy, AVIF/WebP);
no render-blocking third-party requests; no visitor request depends on a third party
(interactive map is click-to-load enhancement over a static SVG baseline); refresh within 3 h
(2 h cron) and manual trigger; WCAG 2.2 AA; zero private data in git or `dist/`; every request
to intervals.icu sends a descriptive User-Agent (Cloudflare 403-challenges Python's default
`Python-urllib/x.y`; a 403 with an HTML body is a bot block, not an auth failure); Garmin
attribution on every view of Garmin-sourced data (intervals.icu API terms, effective 2025-10-23).

**Scale/Scope**: ~5,000 runs over the years of Garmin history (~1,500/yr upper bound), daily
health readings for ~7 metrics (several years), a handful of manual Garmin-figure entries, tens
of races, ~10-20 goals, <= 100 photos.
Published JSON at 5,000 runs: **~109 MB** (~22 KB/run, worst case: all seven series at 600 points)
when written **compact** (Spike 1b, 2026-10-17); 2-space indentation would make it ~263 MB, so the
writer never indents (contracts/storage.md). The 600-point cap stays. A 5,000-run dummy build took
~10.5 s on 4 cores. **Deployed file count at
5,000 runs ~= 6,000** (5,000 run pages + ~15 year pages + ~110 race pages + ~20 other pages + ~110
OG images + <= ~600 optimised photo variants + ~150 JS/CSS/font/sitemap files) against the Workers
static-assets free-tier limit of **20,000 files per version** — about 30%, so no plan change;
Spike 1 verifies the limit. This holds only because **training runs share one generic OG image**
(per-run OG images would add ~5,000 files and ~5,000 render passes; rejected).

**Recurring costs**: Cloudflare Workers static assets + R2 within free tiers = **$0/month**;
GitHub Actions free minutes (private repo: ~2,000 min/month — the 2-hourly job is ~2-4 min
=> ~1,000-1,400 min/month; **verify**; public repo would be unlimited); domain renewal at
Namecheap (existing); OpenFreeMap tiles free (optional GitHub Sponsors donation is the owner's
call); intervals.icu free tier (the $4/month supporter tier adds nothing the site needs; the
owner intends to become a supporter once the live integration works, raised at go-live, T112).
No paid service is required. Worst case if free limits are exceeded: Workers Paid $5/month, R2
cents. Raw FIT files archived per run stay well inside R2's 10 GB free tier at 5,000 runs.

**Unknowns** (all resolved in [research.md](research.md) or scheduled as spikes — none left as
NEEDS CLARIFICATION): provider coverage and Actions reachability (Spike 0, **passed**), Workers
file-count limit (Spike 1). The TypeScript pin is settled (6.0.3).

## Constitution Check

*GATE: passed before Phase 0; re-evaluated after Phase 1 design (below).*

| Principle / bar | Assessment | Evidence in design |
|---|---|---|
| I. Move fast, spike first | PASS | Spike 0 (intervals.icu coverage check, locally + from Actions; **passed** 2026-10-17) and Spike 1 (Workers file limits, perf at 5k runs) precede commitment; spikes live under `spikes/` and are unconstrained. Graduation happens per unit (see Graduation plan) |
| II(a) Contract tests at graduation | PASS | Contract tests for storage interface, provider adapter normalised output, published JSON schemas, owner schemas, goal evaluation, best-effort algorithm, sanitiser allow-list, opaque-ID assignment; delivered by graduation (run locally), not as a per-push gate |
| II(b) Eval suite for AI/non-deterministic decisions | N/A | No AI/LLM decision in this feature (no drafted text). Plausibility/best-effort logic is deterministic and covered by unit/contract tests |
| II(c) Error handling + structured logging | PASS | JSON-lines structured logs from every CLI stage (run id, stage, provider, error class); typed failure classes map to alert text; partial failure never corrupts stored data (atomic writes, manifest) |
| III. Own your data | PASS | Ingest -> store -> render; incremental via cursors; full history retained in R2; pages render only from committed data; only the freshness Worker reads R2 and it has a static fallback |
| IV. Pluggable providers & storage | PASS | `ActivityProvider`/`HealthProvider` adapter interface (intervals.icu first; Garmin direct only if intervals.icu hits a blocker); nothing outside the adapter sees intervals.icu's raw format; manual Garmin figures are owner YAML, not a provider; `RawArchive`, `PublishedWriter`, `RunningStore` abstractions; provider failure = staleness only; Principle IV wording per constitution v1.0.1 (2026-10-17) |
| V. Serverless, gracefully degrading | PASS | No servers; 2-hourly ingest + manual `workflow_dispatch`; every view shows last-updated; stale notice; renders from last-good data; only added serverless piece is the freshness Worker. Owner-entered manual Garmin figures sit outside scheduled ingest; their "as of" date satisfies "show when last updated" |
| VI. Privacy by default | PASS | Raw in private R2 (no credentials stored there; sleep/steps/SpO2 dropped before archiving); allow-list sanitiser strips training-run `latlng` and free-text names/descriptions; provider (intervals.icu/Garmin) activity IDs never published (opaque run IDs); schemas `additionalProperties:false`; weight = 7-day average only; GPS races only; photo EXIF stripped before commit + gate scans; privacy scan of `dist/` (SC-004); secrets only in GitHub/Cloudflare secrets. Repo stays publishable |
| VII. Modular sections | PASS | Running is an Astro integration (`src/sections/running/integration.ts`) injecting its routes; shared code limited to `src/shared/` (layout, design tokens, chart primitives, storage interfaces); the gate's **boundary check** fails if `src/shared/` imports a section or one section imports another. Removing Running = delete the section dir + one config line |
| VIII. Authentic voice | PASS | No AI-written public content; run titles are generated from data (neutral), race text is owner-supplied |
| Mobile-first & fast | PASS (budget set) | Budgets above; Lighthouse 13 CLI budget script (non-blocking); minimal JS; static SVG charts |
| Accessible (WCAG 2.2 AA) | PASS (verification planned) | Text alt + table per chart, keyboard-operable range controls, axe + manual SR pass per chart type |
| SEO & social previews | PASS | Per-page title/description, OG images via satori+sharp (unique for landing, hub pages and each race; one shared card for training runs/year lists), sitemap (`@astrojs/sitemap` 3.7.4) |
| Graceful degradation | PASS | See V; interactive map/charts are enhancements |
| Visualisations first | PASS | Hero countdown, progress bars, SVG charts lead pages |
| Tech constraints | PASS | Astro on Cloudflare; Python ingest via the intervals.icu API (technology constraints per constitution v1.0.1 (2026-10-17)); GitHub Actions scheduling; costs noted ($0; intervals.icu supporter tier optional, revisited at go-live) |
| Build gate from day one | PASS | `gate` job = **site build** (`astro check` + `astro build`) + **data-schema validation** (published + owner, incl. referential checks), with the privacy scan, image scan and section-boundary check as validation steps; must pass before bot commit and before deploy; deploy is a gated job, not Cloudflare's auto-build. Test suites are **not** in the gate |
| Broader CI deferred | PASS | pytest/Vitest/Playwright suites run locally and at graduation, plus path-filtered PR test jobs (`tests.yml`, owner-adopted 2026-10-04 as a partial BACKLOG "Broader CI" revisit); full lint on every change stays deferred |

**Gate result: PASS, no unjustified violations.** Complexity Tracking below records the items
worth the owner's eye (not violations).

### Post-design re-check (after Phase 1)

Re-evaluated against [data-model.md](data-model.md) and [contracts/](contracts/): all rows still
PASS. Design tightened two points: (1) publish stage reads owner overrides, so privacy-affecting
overrides (hide run/map, exclude reading) take effect *before* publication (FR-017) rather than at
render time; (2) freshness uses an R2-fed Worker route so a no-change poll does not spam commits.
A third: (3) run IDs are opaque (`YYYY-MM-DD-xxxx`), so provider activity URLs/IDs (intervals.icu
IDs and Garmin `external_id`s) - which could expose a training run's GPS if the provider's privacy
settings allow - never appear in git or `dist/`. The 2026-10-17 provider switch (intervals.icu)
needed only the constitution's PATCH wording amendment of the ingest technology constraint, now
made as constitution v1.0.1 (2026-10-17); all rows still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-running-section/
├── plan.md              # This file
├── research.md          # Phase 0: decisions, version/maintenance comparisons, Spike 0 rationale
├── data-model.md        # Phase 1: entities, raw vs published, sanitisation rules, state
├── quickstart.md        # Phase 1: setup, spikes, run, validate
├── contracts/           # Phase 1: interface contracts (see contracts/README.md)
└── tasks.md             # Phase 2 (/speckit-tasks) — NOT created here
```

### Source Code (repository root)

```text
astro.config.mjs               # registers integrations (running) + shared config
wrangler.jsonc                 # Workers: static assets dir + R2 binding for freshness route
package.json / tsconfig.json   # TypeScript tooling
schemas/                       # SINGLE SOURCE OF TRUTH: JSON Schema for published + owner data
│   ├── published/             #   run, race-track, health-series, refresh, manifest ...
│   └── owner/                 #   section, goals, upcoming-races, race, run-overrides, lab, manual-metrics ...
src/
├── shared/                    # SHARED PLUMBING (graduates under Principle I/II)
│   ├── layout/                #   Base.astro, Nav.astro, Footer.astro, meta/OG helpers
│   ├── design/                #   tokens.css (colour, type, space, dark mode), components
│   ├── charts/                #   SVG chart primitives + a11y table + range toggle
│   ├── storage/               #   RunningStore-style read interfaces, JsonFileStore, validation (ajv)
│   └── format/                #   UK dates/units/durations, Europe/London week maths
├── pages/index.astro          # site home -> leads to /running until CV/Blog exist
├── worker/freshness.ts        # GET /running/api/freshness (reads R2 public/freshness.json)
└── sections/
    └── running/               # SELF-CONTAINED SECTION (Principle VII)
        ├── integration.ts     #   injectRoute() for all running pages
        ├── pages/             #   landing, goals, training, runs/[id], races, races/[slug], health
        ├── components/        #   Hero, GoalCard, RunCard, SplitsTable, RaceMap, PBTable, GarminAttribution, AsOf ...
        ├── domain/            #   goals.ts, best-effort lookup, pbs.ts, weeks.ts, races.ts (link + upcoming-race state machine)
        ├── data/              #   section loader over shared storage (typed, validated)
        └── og/                #   OG templates: landing, hub pages, race (unique); run + year list (shared card)
data/running/
├── published/                 # MACHINE-WRITTEN, SANITISED, committed by the gated bot only
│   ├── runs/<yyyy>/<run-id>.json      #   <run-id> = opaque YYYY-MM-DD-xxxx, never a provider ID
│   ├── race-tracks/<run-id>.json
│   ├── health/<metric>/<yyyy>.json
│   ├── state/{refresh.json,manifest.json}
├── owner/                     # HAND-EDITED YAML (agent-assisted), PR-reviewed
│   ├── section.yaml  goals.yaml  upcoming-races.yaml  run-overrides.yaml  health-exclusions.yaml
│   ├── manual-metrics.yaml    #   dated Garmin training status + race predictions (as_of)
│   ├── races/<slug>/race.yaml + photos/*.jpg|webp
│   └── lab/<yyyy-mm-dd>-<type>.yaml
ingest/                        # PYTHON (uv project) — fetch + process + publish + alert
├── pyproject.toml  uv.lock
├── src/awingest/
│   ├── cli.py                 #   fetch | process | publish-check | backfill | alert | reprocess
│   ├── providers/
│   │   ├── base.py            #   ActivityProvider / HealthProvider protocols + normalised types
│   │   └── intervals/         #   adapter: client (API key, User-Agent), endpoints, normalise
│   ├── archive/               #   RawArchive protocol; r2.py; local.py
│   ├── process/               #   sanitise.py (allow-list), best_efforts.py, plausibility.py,
│   │                          #   health.py (7-day avg), race_track.py (simplify), titles.py,
│   │                          #   run_ids.py (opaque public IDs; map in R2 state/run-ids.json)
│   ├── publish/               #   PublishedWriter (atomic), manifest, schema validation
│   ├── alerts.py              #   GitHub issue open/close logic
│   └── logging.py             #   structured JSON-lines logging
└── tests/                     # pytest: contract, unit, fixtures/ (synthetic intervals.icu payloads)
scripts/
├── add-race-photo.*           # strip metadata, orient, resize, write into data/ (agent-run)
├── scan-privacy.ts            # scans data/ + dist/ for start times, coords, banned categories,
│                              #   provider activity IDs/URLs (also checks the R2 ID map when creds exist)
├── scan-images.ts             # fails on any EXIF/GPS in repo images
├── check-boundaries.ts        # import-boundary check: shared !-> sections; section !-> section
├── lighthouse-budget.mjs      # Lighthouse 13 CLI against built pages (non-blocking)
└── validate-data.ts           # ajv validation with file/entry/field messages
tests/                         # vitest (unit/contract) + playwright (e2e, a11y) - local/graduation
spikes/                        # throwaway Spike 0/1 code (Principle I); Spike 0 = spikes/intervals/
.github/workflows/
├── refresh.yml                # Worker cron dispatch 2h (+ 6h backup schedule): fetch -> publish -> gate -> commit -> deploy -> alert;
│                              #   the 00:17 UTC catch-all also deploys daily (countdown/OG; T105 replaced rebuild-daily.yml)
├── gate.yml                   # push/PR: validate-data + scans + boundary check + build (no deploy on PR)
├── quality.yml                # non-blocking: Lighthouse 13 CLI + axe (PR + nightly)
└── tests.yml                  # PR, path-filtered: pytest / Vitest (adopted 2026-10-04)
```

**Structure Decision**: a single repository with a TypeScript site (shared shell + a
self-contained `running` section module), a separate Python `ingest/` project for the unattended
data pipeline, and language-neutral JSON Schemas in `schemas/` as the contract between them.
`data/` holds only publishable content; anything private is in R2. This follows constitution
VII (shared = layout, design system, storage only) and IV (adapters/abstractions at every external
boundary).

### Graduation plan (Principle I/II)

| Unit | Becomes | Graduation bar delivered with it |
|---|---|---|
| Spike 0 (intervals.icu coverage check) | Throwaway (**done, passed**) | none; results in `spikes/intervals/RESULTS.md`; outcome recorded in `PROJECT_MEMORY.md` |
| intervals.icu provider adapter + `ActivityProvider` contract | Adapter | design note (contracts/provider-adapter.md), contract tests on normalised output (fixtures), error taxonomy + logging |
| `RawArchive`, `PublishedWriter`, `RunningStore` | Shared storage layer | design note, interface contract tests run against every implementation, atomic write + failure tests |
| Sanitiser + opaque run IDs + privacy scan | Privacy-critical | exhaustive allow-list tests, property tests that no start time/coord/free-text name/provider ID survives, ID-assignment tests (stable, append-only, collision-free), SC-004 scan in the gate |
| Shared shell (layout, tokens, charts) | Shared plumbing | short design note, component/a11y tests, token contrast checks, boundary check in the gate |
| Running section | Section | e2e + a11y + perf budgets; adversarial self-review before declaring graduated |

The tests named above are run locally and as part of each graduation review; they are **not** a
per-push gate (constitution: broader CI deferred). Path-filtered test jobs on PRs (`tests.yml`)
were adopted by the owner on 2026-10-04 as a partial BACKLOG "Broader CI" revisit.

### Delivery order (input to /speckit-tasks)

0. **Spike 0** — done (intervals.icu coverage check passed, 2026-10-17). Spike 1 (file limit,
   size) is next.
1. Scaffold + schemas + storage abstractions + gate workflow (shared plumbing).
2. intervals.icu adapter + fetch + R2 archive + backfill (after the owner's Garmin export is
   imported into intervals.icu); processor + sanitiser + published JSON; refresh workflow +
   alerts + freshness Worker.
3. Shared shell (layout/tokens/charts).
4. Stories in spec order: US2 goals + US1 landing (P1) -> US3 training/run detail -> US4 races &
   PBs -> US5 health. Goal evaluation depends on best efforts and health series, so processor
   output for those lands before US1/US2 UI.

## Complexity Tracking

> No constitution violations. Items below are deliberate choices the owner may want to review.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Two-stage pipeline with private R2 | Owner decision: repo must stay publishable while raw GPS/start times are retained for re-processing (an adapter fix or a later race designation reprocesses R2 without provider calls) | Raw in git violates Principle VI; fetch+publish in one job would re-fetch from intervals.icu on every reprocess |
| Freshness Worker route | Static site + "last updated within a few hours" + no-commit-on-no-change would otherwise show a stale timestamp and force a commit every 2 h | Committing `refresh.json` 12x/day pollutes history; build-time-only stamp misreports freshness |
| Bot commits to `main` after the gate | Unattended ingest must publish without a human; gated by build gate per constitution | PR-per-refresh (auto-merge) adds noise and latency; owner-confirmed 2026-10-04 as a narrow exception to the PR norm (sanitised data files only, after the gate) |
| Owner-editable `section.yaml` and `manual-metrics.yaml` | `section.yaml` keeps thresholds/limits out of code; `manual-metrics.yaml` holds the Garmin figures intervals.icu lacks (training status, race predictions) as dated entries | Constants in code (owner edits need a code change); falling back to Garmin direct for two figures (reintroduces the unofficial-client risk the provider switch removed) |
| TypeScript pinned to 6.0.3 (core-component pin) | `@astrojs/check` 0.9.12 peer range is `^5 \|\| ^6`; TS 7 would break `astro check` in the gate. Logged in the `PROJECT_MEMORY.md` decisions log on 2026-10-04 | Using TS 7: gate breaks. Revisit when `@astrojs/check` supports TS 7 |
| Build-time SVG charts instead of a charting library | Zero JS, accessible by construction, no library churn | uPlot/Chart.js add JS and manual a11y; kept as optional later enhancement |
