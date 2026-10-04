# Implementation Plan: Running Section

**Branch**: `001-running-section` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-running-section/spec.md`

## Summary

Build the Running section (landing hub, goals, training + run detail, races & PBs, health &
performance) as a **static Astro 7 site on Cloudflare Workers static assets**, fed by a
**two-stage Python pipeline** that keeps the repo safe to publish:

1. **fetch** — `python-garminconnect` (behind a provider adapter) pulls incrementally from Garmin
   Connect into a **private Cloudflare R2 bucket** (full raw history, never in git).
2. **publish** — a deterministic processor normalises the raw payloads (Garmin adapter), applies
   an **allow-list sanitiser** (drops start times, training GPS, unapproved metrics; reduces
   weight to a 7-day average; replaces Garmin activity IDs with **opaque public run IDs** such as
   `2027-03-14-k3f9`), computes best efforts, and writes **versioned JSON into git** behind a
   storage abstraction. A build gate (schema validation of published + owner data, privacy scan,
   section-boundary check, site build) must pass before the bot commit and deploy.

Owner-entered content (section settings, goals, races, photos, lab results, overrides) is
hand-edited YAML in git,
validated against the same JSON Schemas as machine data. Goals, PBs and charts are derived at
build time (pure functions of stored data), so there is no mutable server state. Charts are
build-time SVG with accessible tables (no chart library); race maps are a static SVG route with a
lazily loaded MapLibre enhancement. A minimal **shared shell** (layout, nav, design tokens, chart
primitives, storage layer) is built here and graduated as shared plumbing; Running is an
Astro integration that injects its own routes so it can be added/removed independently.

**First spike (Spike 0)** answers the known open risk — can `python-garminconnect` log in and
fetch from GitHub Actions' datacenter IPs, with rotating tokens surviving at the real 2-hourly
cadence for 48 h? — and the design holds either way: the fetch stage moves to a Windows Task
Scheduler job on the owner's PC with no downstream change.

## Technical Context

**Language/Version**: TypeScript **6.0.3** (Astro 7.3.5, Node >= 22.12; local Node 24.15) for
site + Worker; Python >= 3.12 (3.12.10 local) for ingest/processing. TypeScript 7.0.x is
deliberately **not** adopted: `@astrojs/check` 0.9.10 peer-requires `typescript ^5 || ^6`, so TS 7
would break `astro check` in the build gate. Revisit when `@astrojs/check` supports TS 7
(decisions-log entry required — see Complexity Tracking).

**Primary Dependencies**: Astro 7.3.5, TypeScript 6.0.3, `@astrojs/check` 0.9.10, sharp 0.35.5
(images/OG), satori 0.35.0 (OG), ajv 8.20.0, yaml 2.9.1, json-schema-to-typescript 16.0.0,
maplibre-gl 6.12.0 (lazy, race maps only), wrangler 4.147.0; Python: garminconnect 0.3.17,
curl_cffi 0.16.3, boto3 1.43.108, cryptography 50.0.2 (Fernet token encryption), jsonschema
4.26.0, pyyaml 6.0.3. See [research.md](research.md) for the comparison tables.

**Storage**: (a) Private Cloudflare R2 bucket = raw archive + Garmin tokens + operational state
(`RawArchive` abstraction: `R2Archive`, `LocalArchive`). The Garmin token file is stored
**Fernet-encrypted** (key = GitHub secret `GARMIN_TOKEN_KEY`) and re-uploaded on rotation; the
Garmin-ID -> public-run-ID map lives only here. (b) Git = sanitised published JSON
(`data/running/published/`) + owner YAML (`data/running/owner/`) behind a TypeScript
`RunningStore` read interface (`JsonFileStore`) and a Python `PublishedWriter`. See
[contracts/](contracts/).

**Testing**: Vitest 5.0.3 (TS unit + contract), pytest 9.1.1 + moto 5.2.3 (Python), Playwright
1.63.0 + @axe-core/playwright 4.13.0 (e2e, keyboard/a11y), Lighthouse **13.5.0 CLI** run directly
(perf budget, non-blocking; `@lhci/cli` 0.15.1 is not used because it still bundles Lighthouse
12.x). Synthetic anonymised Garmin fixtures; shared JSON Schema contract fixtures in both
languages. Test suites run **locally and at graduation**, not in the mandatory gate; the gate is
site build + data-schema validation (privacy scan, image scan and boundary check count as
validation).

**Target Platform**: Cloudflare Workers static assets (+ one small Worker route for freshness);
GitHub Actions (ubuntu-latest) for scheduled jobs; owner's Windows 11 PC (Task Scheduler) only as
the Spike-0 fallback fetch host. Browsers: evergreen mobile-first, 320 px up.

**Project Type**: Web application — static site + serverless Worker + scheduled Python data
pipeline (modular monorepo, one repo).

**Performance Goals**: Lighthouse mobile performance >= 90 on every page (SC-006); landing main
content <= 2.5 s on simulated mid-range phone; 5,000 runs browsable at the same bar (SC-011).

**Constraints**: **Client JS budget: <= 10 KB gzip on every page except race pages' optional
map**; per-page weight budget <= 150 KB HTML+CSS+JS excluding images (race photos lazy, AVIF/WebP);
no render-blocking third-party requests; no visitor request depends on a third party
(interactive map is click-to-load enhancement over a static SVG baseline); refresh within 3 h
(2 h cron) and manual trigger; WCAG 2.2 AA; zero private data in git or `dist/`.

**Scale/Scope**: ~5,000 runs over the years of Garmin history (~1,500/yr upper bound), daily
health readings for ~5 metrics (several years), tens of races, ~10-20 goals, <= 100 photos.
Estimated published JSON <= ~150 MB in git at 5,000 runs (~30 KB/run incl. downsampled streams) —
**verify in spike**; downsample cap (<= 600 points/stream) is the lever. **Deployed file count at
5,000 runs ~= 6,000** (5,000 run pages + ~15 year pages + ~110 race pages + ~20 other pages + ~110
OG images + <= ~600 optimised photo variants + ~150 JS/CSS/font/sitemap files) against the Workers
static-assets free-tier limit of **20,000 files per version** — about 30%, so no plan change;
Spike 1 verifies the limit. This holds only because **training runs share one generic OG image**
(per-run OG images would add ~5,000 files and ~5,000 render passes; rejected).

**Recurring costs**: Cloudflare Workers static assets + R2 within free tiers = **$0/month**;
GitHub Actions free minutes (private repo: ~2,000 min/month — the 2-hourly job is ~2-4 min
=> ~1,000-1,400 min/month; **verify**; public repo would be unlimited); domain renewal at
Namecheap (existing); OpenFreeMap tiles free (optional GitHub Sponsors donation is the owner's
call). No paid service is introduced. Worst case if free limits are exceeded: Workers Paid
$5/month, R2 cents.

**Unknowns** (all resolved in [research.md](research.md) or scheduled as spikes — none left as
NEEDS CLARIFICATION): GH Actions login viability + token rotation at cadence (Spike 0), Workers
file-count limit (Spike 1), Garmin endpoint coverage (Spike 0 checklist). The TypeScript pin is
settled (6.0.3).

## Constitution Check

*GATE: passed before Phase 0; re-evaluated after Phase 1 design (below).*

| Principle / bar | Assessment | Evidence in design |
|---|---|---|
| I. Move fast, spike first | PASS | Spike 0 (Garmin from Actions, 48 h at real cadence) and Spike 1 (Workers file limits, perf at 5k runs) precede commitment; spikes live under `spikes/` and are unconstrained. Graduation happens per unit (see Graduation plan) |
| II(a) Contract tests at graduation | PASS | Contract tests for storage interface, provider adapter normalised output, published JSON schemas, owner schemas, goal evaluation, best-effort algorithm, sanitiser allow-list, opaque-ID assignment; delivered by graduation (run locally), not as a per-push gate |
| II(b) Eval suite for AI/non-deterministic decisions | N/A | No AI/LLM decision in this feature (no drafted text). Plausibility/best-effort logic is deterministic and covered by unit/contract tests |
| II(c) Error handling + structured logging | PASS | JSON-lines structured logs from every CLI stage (run id, stage, provider, error class); typed failure classes map to alert text; partial failure never corrupts stored data (atomic writes, manifest) |
| III. Own your data | PASS | Ingest -> store -> render; incremental via cursors; full history retained in R2; pages render only from committed data; only the freshness Worker reads R2 and it has a static fallback |
| IV. Pluggable providers & storage | PASS | `ActivityProvider`/`HealthProvider` adapter interface (Garmin first); nothing outside the adapter sees Garmin's raw format; `RawArchive`, `PublishedWriter`, `RunningStore` abstractions; provider failure = staleness only |
| V. Serverless, gracefully degrading | PASS | No servers; 2-hourly ingest + manual `workflow_dispatch`; every view shows last-updated; stale notice; renders from last-good data; only added serverless piece is the freshness Worker |
| VI. Privacy by default | PASS | Raw in private R2 (Garmin tokens Fernet-encrypted there); allow-list sanitiser; Garmin activity IDs never published (opaque run IDs); schemas `additionalProperties:false`; weight = 7-day average only; GPS races only; photo EXIF stripped before commit + gate scans; privacy scan of `dist/` (SC-004); secrets only in GitHub/Cloudflare secrets. Repo stays publishable |
| VII. Modular sections | PASS | Running is an Astro integration (`src/sections/running/integration.ts`) injecting its routes; shared code limited to `src/shared/` (layout, design tokens, chart primitives, storage interfaces); the gate's **boundary check** fails if `src/shared/` imports a section or one section imports another. Removing Running = delete the section dir + one config line |
| VIII. Authentic voice | PASS | No AI-written public content; run titles are generated from data (neutral), race text is owner-supplied |
| Mobile-first & fast | PASS (budget set) | Budgets above; Lighthouse 13 CLI budget script (non-blocking); minimal JS; static SVG charts |
| Accessible (WCAG 2.2 AA) | PASS (verification planned) | Text alt + table per chart, keyboard-operable range controls, axe + manual SR pass per chart type |
| SEO & social previews | PASS | Per-page title/description, OG images via satori+sharp (unique for landing, hub pages and each race; one shared card for training runs/year lists), sitemap (`@astrojs/sitemap` 3.7.4) |
| Graceful degradation | PASS | See V; interactive map/charts are enhancements |
| Visualisations first | PASS | Hero countdown, progress bars, SVG charts lead pages |
| Tech constraints | PASS | Astro on Cloudflare; Python ingest permitted; GitHub Actions scheduling; costs noted ($0) |
| Build gate from day one | PASS | `gate` job = **site build** (`astro check` + `astro build`) + **data-schema validation** (published + owner, incl. referential checks), with the privacy scan, image scan and section-boundary check as validation steps; must pass before bot commit and before deploy; deploy is a gated job, not Cloudflare's auto-build. Test suites are **not** in the gate |
| Broader CI deferred | PASS (proposal flagged) | pytest/Vitest/Playwright suites run locally and at graduation. **Proposal for owner**: path-filtered test jobs on PRs = the BACKLOG "Broader CI" revisit; not adopted unless confirmed |

**Gate result: PASS, no unjustified violations.** Complexity Tracking below records the items
worth the owner's eye (not violations).

### Post-design re-check (after Phase 1)

Re-evaluated against [data-model.md](data-model.md) and [contracts/](contracts/): all rows still
PASS. Design tightened two points: (1) publish stage reads owner overrides, so privacy-affecting
overrides (hide run/map, exclude reading) take effect *before* publication (FR-017) rather than at
render time; (2) freshness uses an R2-fed Worker route so a no-change poll does not spam commits.
A third: (3) run IDs are opaque (`YYYY-MM-DD-xxxx`), so Garmin activity URLs/IDs - which could
expose a training run's GPS if Garmin privacy settings allow - never appear in git or `dist/`. No
constitution amendment required.

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
│   └── owner/                 #   section, goals, upcoming-races, race, run-overrides, lab ...
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
        ├── components/        #   Hero, GoalCard, RunCard, SplitsTable, RaceMap, PBTable ...
        ├── domain/            #   goals.ts, best-effort lookup, pbs.ts, weeks.ts, races.ts (link + upcoming-race state machine)
        ├── data/              #   section loader over shared storage (typed, validated)
        └── og/                #   OG templates: landing, hub pages, race (unique); run + year list (shared card)
data/running/
├── published/                 # MACHINE-WRITTEN, SANITISED, committed by the gated bot only
│   ├── runs/<yyyy>/<run-id>.json      #   <run-id> = opaque YYYY-MM-DD-xxxx, never a Garmin ID
│   ├── race-tracks/<run-id>.json
│   ├── health/<metric>/<yyyy>.json
│   ├── state/{refresh.json,manifest.json}
├── owner/                     # HAND-EDITED YAML (agent-assisted), PR-reviewed
│   ├── section.yaml  goals.yaml  upcoming-races.yaml  run-overrides.yaml  health-exclusions.yaml
│   ├── races/<slug>/race.yaml + photos/*.jpg|webp
│   └── lab/<yyyy-mm-dd>-<type>.yaml
ingest/                        # PYTHON (uv project) — fetch + process + publish + alert
├── pyproject.toml  uv.lock
├── src/awingest/
│   ├── cli.py                 #   login | keygen | fetch | process | publish-check | backfill | alert | reprocess
│   ├── providers/
│   │   ├── base.py            #   ActivityProvider / HealthProvider protocols + normalised types
│   │   └── garmin/            #   adapter: auth+tokens, endpoints, #444 workaround, normalise
│   ├── archive/               #   RawArchive protocol; r2.py; local.py; tokens.py (Fernet token store)
│   ├── process/               #   sanitise.py (allow-list), best_efforts.py, plausibility.py,
│   │                          #   health.py (7-day avg), race_track.py (simplify), titles.py,
│   │                          #   run_ids.py (opaque public IDs; map in R2 state/run-ids.json)
│   ├── publish/               #   PublishedWriter (atomic), manifest, schema validation
│   ├── alerts.py              #   GitHub issue open/close logic
│   └── logging.py             #   structured JSON-lines logging
└── tests/                     # pytest: contract, unit, fixtures/ (synthetic Garmin payloads)
scripts/
├── add-race-photo.*           # strip metadata, orient, resize, write into data/ (agent-run)
├── scan-privacy.ts            # scans data/ + dist/ for start times, coords, banned categories,
│                              #   Garmin activity IDs/URLs (also checks the R2 ID map when creds exist)
├── scan-images.ts             # fails on any EXIF/GPS in repo images
├── check-boundaries.ts        # import-boundary check: shared !-> sections; section !-> section
├── lighthouse-budget.mjs      # Lighthouse 13 CLI against built pages (non-blocking)
└── validate-data.ts           # ajv validation with file/entry/field messages
tests/                         # vitest (unit/contract) + playwright (e2e, a11y) - local/graduation
spikes/                        # throwaway Spike 0/1 code (Principle I)
.github/workflows/
├── refresh.yml                # schedule 2h + dispatch: fetch(mode=actions) -> publish -> gate -> commit -> deploy -> alert
├── rebuild-daily.yml          # 23:05 + 00:05 UTC: gate -> build -> deploy (countdown/OG)
├── gate.yml                   # push/PR: validate-data + scans + boundary check + build (no deploy on PR)
└── quality.yml                # non-blocking: Lighthouse 13 CLI + axe (PR + nightly)
                               # (proposal, not adopted: tests.yml with path-filtered pytest/Vitest jobs)
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
| Spike 0 (Garmin from Actions, 48 h) | Throwaway | none; pass criteria in quickstart.md; outcome recorded in `PROJECT_MEMORY.md` |
| Garmin provider adapter + `ActivityProvider` contract | Adapter | design note (contracts/provider-adapter.md), contract tests on normalised output (fixtures), error taxonomy + logging |
| `RawArchive`, `PublishedWriter`, `RunningStore` | Shared storage layer | design note, interface contract tests run against every implementation, atomic write + failure tests |
| Sanitiser + opaque run IDs + privacy scan | Privacy-critical | exhaustive allow-list tests, property tests that no start time/coord/Garmin ID survives, ID-assignment tests (stable, append-only, collision-free), SC-004 scan in the gate |
| Shared shell (layout, tokens, charts) | Shared plumbing | short design note, component/a11y tests, token contrast checks, boundary check in the gate |
| Running section | Section | e2e + a11y + perf budgets; adversarial self-review before declaring graduated |

The tests named above are run locally and as part of each graduation review; they are **not** a
per-push gate (constitution: broader CI deferred). Adding path-filtered test jobs on PRs is a
**proposal for the owner** (it is the BACKLOG "Broader CI" revisit); the plan works without it.

### Delivery order (input to /speckit-tasks)

0. **Spike 0** (48 h at the real 2-hourly cadence; blocks pipeline design only if it fails —
   design already covers both outcomes). Spike 1 (file limit, size) runs in parallel.
1. Scaffold + schemas + storage abstractions + gate workflow (shared plumbing).
2. Provider adapter + fetch + R2 archive + local backfill; processor + sanitiser + published
   JSON; refresh workflow + alerts + freshness Worker.
3. Shared shell (layout/tokens/charts).
4. Stories in spec order: US2 goals + US1 landing (P1) -> US3 training/run detail -> US4 races &
   PBs -> US5 health. Goal evaluation depends on best efforts and health series, so processor
   output for those lands before US1/US2 UI.

## Complexity Tracking

> No constitution violations. Items below are deliberate choices the owner may want to review.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Two-stage pipeline with private R2 | Owner decision: repo must stay publishable while raw GPS/start times are retained for re-processing; also makes the PC fallback a drop-in | Raw in git violates Principle VI; fetch+publish in one job would make the PC fallback a redesign |
| Freshness Worker route | Static site + "last updated within a few hours" + no-commit-on-no-change would otherwise show a stale timestamp and force a commit every 2 h | Committing `refresh.json` 12x/day pollutes history; build-time-only stamp misreports freshness |
| Bot commits to `main` after the gate | Unattended ingest must publish without a human; gated by build gate per constitution | PR-per-refresh (auto-merge) adds noise and latency; **needs owner confirmation** as an exception to the PR norm |
| Encrypted token file + owner-editable `section.yaml` | Tokens in R2 (Fernet, key as a GitHub secret) because workflows cannot rewrite secrets and the repo must stay publishable; `section.yaml` keeps thresholds/limits out of code | Plain tokens in R2 (one leak away from account access); constants in code (owner edits need a code change) |
| TypeScript pinned to 6.0.3 (core-component pin) | `@astrojs/check` 0.9.10 peer range is `^5 \|\| ^6`; TS 7 would break `astro check` in the gate. Needs a `PROJECT_MEMORY.md` decisions-log entry (made by the caller, not this plan) | Using TS 7: gate breaks. Revisit when `@astrojs/check` supports TS 7 |
| Build-time SVG charts instead of a charting library | Zero JS, accessible by construction, no library churn | uPlot/Chart.js add JS and manual a11y; kept as optional later enhancement |
