# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`.

## Next session

<!-- Overwritten by the agent at each session boundary (see the "One session per phase" norm).
     A new session reads this first; the owner only needs to type "continue". -->

- **Status (2026-10-23, afternoon):** Phase 3 (US2 Goals) and the 7-goal follow-up (#34) are
  merged. The Spec Kit 1.2.3 upgrade is raised as a PR (`speckit-1.2.3`). Refresh runs are
  green; the one red run (12:41) was a push rejected because PR #31 merged mid-run, as designed.
  The Cloudflare cron dispatches `refresh.yml` every 2 h.
  - **Check first:**
    - whether the `speckit-1.2.3` PR merged. Phase 4 doesn't depend on it, so carry on either
      way (branch from `origin/main`).
    - minutes per day: 500 used at 13:23 UTC on 2026-10-23, and PR #31 merged at 12:43. Expect
      about 35–40 a day, down from 55. If it's still close to the limit, use the owner's lever
      order (2026-10-23 decision).
  - **Dispatch token expiry:** 2027-10-17 23:00 UTC. Raise a new token with the owner in the
    week of 2027-10-11.
- **Sessions are local again (Windows)** (owner, 2026-10-18). Run `check-versions.ps1` at the
  start. Cloud credits remain until 2026-11-05 but are mostly used, so only suggest a cloud
  session for a slice that needs no secrets and no owner input.
- **Each session, first:**
  - **Refresh runs:** fix any red one first, and any `refresh-trigger-failing` or
    `ingest-failing` issue.
  - **Actions minutes:** read the usage
    (`gh api "/users/alexwebber/settings/billing/usage/summary?product=actions"`) and warn before
    the 2,000-minute limit. 435 minutes were used by 2026-10-23; the rate was about 55 a day
    before PR #31. Billing check 2026-10-23: everything is $0. Cloudflare R2 and Workers are far
    inside their free tiers, and Workers is on the Free plan.
- **Owner setup done:** T001 (R2 + `R2_*`), T002 (Cloudflare token and account), the
  intervals.icu key, the `alexanderwebber` workers.dev subdomain, and the `gh` `user` scope.
  T003 is dropped.
- **Still with the owner:**
  - **T004 (nameservers):** the agent walks them through it.
  - **T150:** the Garmin export, still not arrived (2026-10-23). When it does, the agent walks
    them through *intervals.icu → Settings → Import all Garmin data*, re-runs the probe, runs
    T085's backfill, and then **audits the export against intervals.icu run by run** (see
    2026-10-23 decision).
  - **Setup values file:** `C:\temp\2.txt` is already deleted. T004's nameservers can be read
    again in the Cloudflare dashboard.
- **Next step: Phase 4 (US1 Landing, from T096)** in its own session. It reuses `goals.ts`,
  `loadGoals(today)` (`src/sections/running/data/goals.ts`), `GoalCard` and `AsOf`.
  `section.yaml` already exists (T106's data part); T106 still adds the target-time warning.
  The landing page shows **seven** featured goals (one achieved), so lay the cards out for an
  odd count. Effort times become run links once T102's run pages ship
  (`src/sections/running/links.ts`).
  - Offer the owner a fresh Garmin training-status and predictions reading at reviews; never
    ask as a chore.
  - **Don't invent values** (Principle VIII).

## Vision

alexanderwebber.com is Alexander Webber's personal site: a warm, data-rich home for his running
(progress, targets, races, charity fundraising, PBs, videos, training/health/performance
metrics), and a professional CV & AI/software-engineering blog that opens future job
opportunities. Built spec-first with Spec Kit as a modular site that can grow new sections.

## Phasing

1. **Running** — first feature. Garmin-driven stats, races & PBs, targets, charity fundraising
   (Brighton Marathon, 2027-04-04, for Martlets hospice), videos.
2. **CV & Blog** — professional section; AI-drafted, owner-approved content with a living
   `VOICE.md` style guide.
3. **Future sections** — added as self-contained modules (constitution Principle VII).

## Working norms

House defaults from [sdd-playbook](https://github.com/alexwebber/sdd-playbook), plus
project-specific notes.

- **The agent orchestrates.** The coding agent owns, remembers and runs all process (spec-kit
  steps, version checks, lesson capture, model canaries, follow-ups after PRs merge) and pulls
  what it needs from the owner. The owner contributes thoughts, experience and judgement, and is
  never handed a manual workflow to remember. Any owner input is folded into reviews they're
  already doing. If the agent can check something itself (e.g. whether a PR merged), it does.
- **One session per phase; the agent writes the handoff.** Each Claude Code session covers one
  phase of work: specify (+ clarify), plan, tasks (+ analyze), one implement slice, or one
  unrelated concern (e.g. playbook maintenance). New sessions are cheap, because `CLAUDE.md`
  auto-loads this file and the constitution. Long sessions cost more per turn (the whole
  conversation is re-sent) and lose focus (compaction is lossy). When a phase's PR is raised, or
  the context has been compacted, or the conversation has drifted across concerns, the agent
  updates *Next session* above and tells the owner it's a good point to start a new session. The
  owner then opens one in the project folder and types "continue". Quick follow-ups (PR
  conflicts, small review fixes, an in-progress question round) stay in the current session.
  (Adopted from house-process 0.7.0.)
- **Pull requests, not direct commits to `main`.** All changes go on a branch and are raised as
  a PR for the owner to review and merge. Coding agents don't push to `main` or merge their own
  PRs unless explicitly asked. Anything the owner needs to confirm goes in the PR body as a
  checkbox question. If the PR merges with any left unanswered, the next session asks them
  before building on them.
- **Draw requirements out with questions.** For specs, clarifications and design decisions, the
  agent asks focused rounds of questions with recommended options rather than expecting the
  owner to supply everything up front.
- **Run spec-kit commands as real subagents.** `/speckit-*` commands are dispatched via the
  Agent tool to a subagent that follows the actual `.claude/skills/speckit-*/SKILL.md`, not
  simulated inline by the main conversation. Subagents can't converse with the owner, so the
  main conversation runs the question rounds first and passes the gathered answers in.
  Exception: interactive house-process commands that need the owner's picks partway through
  (e.g. harvest-lessons) run in the main conversation, following their SKILL.md.
- **Model selection, evolved by canaries.** Starting assumption: routine work (spikes,
  implementation, well-scoped specify/tasks/implement runs) stays on the session's default
  model. Architecturally consequential steps (e.g. `/speckit-specify` or `/speckit-plan` on
  foundational pieces) get a per-call Opus override, flagged each time. The agent tests and
  evolves this itself via `speckit.house-process.model-canary`: it reruns a step on another
  model when the owner is unhappy with an output. A canary costs 2–3.5× the step, and the
  agent can't see the owner's remaining plan usage. So trying each new model once per step type
  and sampling about 1 in 4 high-value steps happen only if this project opts in. The agent asks
  for a usage screenshot before big spends (e.g. a canary or `/speckit-implement`). Results,
  including token cost, are logged in `canaries.md`. The judge is never one of the candidate
  models. Norm changes are proposed only once a pattern holds. **Project override
  (2026-10-04):** this project does not opt in. Canaries run only when the owner is unhappy
  with an output, because of plan usage limits. The agent logs each step's token cost anyway.
  **Project override (2026-10-17):** the agent doesn't ask for usage screenshots. The owner says
  when usage is running low.
- **Don't miss important updates.** Check the components in use for updates and adopt the ones
  that matter: new releases of core components (Spec Kit, the main framework, key libraries),
  security fixes that affect us, and fixes/features we'd benefit from. New dependencies start on
  their current release. Routine bumps of supporting tools that work fine can be skipped — the
  agent recommends rather than blanket-upgrading. Run sdd-playbook's `scripts/check-versions.ps1`
  at the start of a work session. A deliberate pin of a core component gets a decisions-log
  entry saying why.
- **Research before choosing dependencies.** Verify a library/service is current and maintained
  rather than picking from memory, and record the comparison here (see the Garmin library
  decision below).
- **Capture lessons in the moment; send them upstream later.** Add a one-line entry to
  *Upstream candidates* below **immediately** — don't wait for a milestone — whenever the agent:
  works around a tool/environment problem; is corrected or told a preference by the owner; finds
  sdd-playbook wrong or missing something; or hits a procedure that behaved unexpectedly.
  Capturing is cheap and needs no approval. Sending upstream happens via
  `/speckit-house-process-harvest-lessons` (offered after `/speckit-plan` and
  `/speckit-implement`, or run any time), which proposes changes for the owner to approve.
- Spec Kit runs via the Claude integration with PowerShell scripts; house standards are
  installed from sdd-playbook in dev mode (preset `house-constitution`, extension
  `house-process`). Open `C:\Projects\alexanderwebber-workspace.code-workspace` to work on the
  site and the playbook side by side.

## Decisions log

- **2026-10-03** — Repo created: `github.com/alexwebber/alexanderwebber.com`, private for now
  (public/private decision deferred — see `BACKLOG.md`). Bootstrapped with Spec Kit 1.1.0 plus
  house standards.
- **2026-10-03** — Constitution v1.0.0 ratified (8 principles: house I–II plus Own Your Data,
  Pluggable Providers & Storage, Serverless Gracefully Degrading, Privacy by Default, Modular
  Sections, Authentic Voice).
- **2026-10-03** — Architecture direction: ingest → store → render. Scheduled jobs (every 1–3h +
  manual trigger) pull incrementally into versioned JSON files in git, behind a storage
  abstraction; serverless functions allowed; no visitor request depends on a third-party API;
  no logins (admin via git). Why: providers don't serve the aggregates needed, rate-limit, and
  break; owning data keeps the site fast and durable.
- **2026-10-03** — Running data source: Garmin Connect via `cyberjunky/python-garminconnect`
  behind a provider adapter. Why: only route to health/performance metrics (VO2 max, training
  status, weight, HRV) — Strava's API lacks them and its 2024 terms restrict showing data to
  others; Garmin's official API is business-only. Research (2026-10-03): `garth` and
  `garminexport` are deprecated (Garmin auth change); GarminDB and garmin-grafana are apps built
  on python-garminconnect; the Node `garmin-connect` client is stale since 2024.
  python-garminconnect is actively released (0.3.17, 2026-09-29) with its own auth, MFA, and
  auto-refreshing tokens.
- **2026-10-03** — Stack & hosting: TypeScript static-site framework (Astro favoured) on
  Cloudflare Pages/Workers; Python ingest jobs; domain at Namecheap. Cost not a constraint.
- **2026-10-03** — Privacy: public = race results/PBs, training totals, individual runs, health
  and performance metrics; GPS maps for races only, never training runs.
- **2026-10-03** — Build gate from day one (site build + data-schema validation on every push and
  ingest commit); broader CI deferred.

- **2026-10-03** — Adopted a PR-based workflow: changes go via branches + pull requests rather
  than direct commits to `main` (first three bootstrap commits predate this).

- **2026-10-03** — Caught up with sdd-playbook (house-constitution 0.1.1, house-process 0.3.0):
  added `CLAUDE.md` (auto-loads this file + the constitution), adopted the house working norms,
  and gained the optional lesson-harvest hooks after `/speckit-plan` and `/speckit-implement`.

- **2026-10-03** — Adopted in-the-moment lesson capture (house-process 0.4.0): lessons go into
  *Upstream candidates* as they happen; the harvest hook sends them to sdd-playbook. Lessons from
  setup day were already sent upstream (sdd-playbook PRs #1–#5).

- **2026-10-03** — Adopted the "don't miss important updates" norm (house-process 0.5.0): run
  sdd-playbook `scripts/check-versions.ps1` at session start; core components (Spec Kit, the site
  framework, python-garminconnect) stay current, supporting-tool bumps only when they matter.
  Checked today: Spec Kit 1.1.0 current; gh/uv behind but nothing important — skipped.

- **2026-10-03** — Adopted "the agent orchestrates" and agent-run model canaries (house-process
  0.6.0): the agent owns all process and pulls input from the owner; model selection is
  tested/evolved via `speckit.house-process.model-canary` (on dissatisfaction, new models, ~1 in
  4 high-value steps), logged in `canaries.md`.

- **2026-10-04** — Running spec (`specs/001-running-section`) scoped via three question rounds.
  In: Brighton-led goals hub landing page (Brighton sub-3:30, may tighten to sub-3:20; plus 10k
  sub-45, 5k sub-20, 17.5% body fat, 93 kg, a VO2 max target), goals as a first-class concept,
  training stats with full Garmin run detail, races & PBs (race-only maps and photos), health &
  performance metrics. Race-time goals are achieved by **any recorded effort**, not only races.
  Weight shown as a 7-day moving average; body fat % exact; source is a Garmin Index scale. Lab
  DEXA + VO2 max tests (planned on reaching 93 kg) are shown as reference points against the
  Garmin estimates. Public metrics: VO2 max, training status/load, race predictions, resting HR,
  HRV, body composition. Sleep, stress and Body Battery stay private. History: all Garmin plus
  manual entries for older races. Training runs: date but no start time, no maps, neutral titles.
- **2026-10-04** — Fundraising split into its own spec; platform is JustGiving (Brighton
  Marathon's event page and Martlets' fundraiser setup both use it). The personal journey/story
  and educational "couch to runner" videos are a separate future spec; the landing page links to
  the story once it exists.
- **2026-10-04** — Running plan inputs: raw Garmin data goes to a private Cloudflare R2 bucket and
  never into git; only sanitised, publishable data is committed. Failed-refresh alerts are GitHub
  issues the ingest job opens and auto-closes. A minimal shared site shell (layout, nav, design
  tokens, chart conventions, storage layer) is built inside the Running plan. The Garmin account
  has no MFA, but tokens are still preferred over password logins.
- **2026-10-04** — Running plan adopted (`specs/001-running-section/plan.md`): the simpler of two
  canary candidates (owner pick after a blind tie), hardened with the other's best ideas.
  - **Site**: Astro 7.3.5 static, on Cloudflare Workers Static Assets (Cloudflare's recommended
    path over Pages).
  - **Data**: JSON Schema is the single schema source; charts are build-time SVG (no chart JS).
  - **Maps**: race maps are a static SVG plus MapLibre with OpenFreeMap tiles on click.
  - **Ingest**: Python ingest with garminconnect 0.3.17; tokens Fernet-encrypted in the private
    R2 bucket.
  - **Privacy**: opaque public run IDs, so no Garmin IDs are ever published.
  - **Config**: `section.yaml` holds the Running config.
  - **Pipeline**: two stages, fetch (Garmin → R2) then publish (R2 → git → gate → deploy).
  - **First step**: Spike 0 (Garmin from Actions; ≥23/24 runs over 48h); fallback is fetch via
    Task Scheduler on the owner's PC.
  - **Cost**: expected $0/month recurring.
  - **Build gate**: build + schema/referential validation + privacy, image and boundary scans.
    Test suites run locally and at graduation (broader CI stays deferred).
- **2026-10-04** — **Deliberate pin: TypeScript 6.0.3, not 7.0.x.** `@astrojs/check` 0.9.10
  (latest) peer-requires `typescript ^5 || ^6`. Revisit when it supports TS 7 (session-start
  update check).
- **2026-10-04** — Owner confirmed the two plan proposals after PR #6:
  - **Ingest bot commits straight to `main`.** It commits only sanitised data files, only after
    the build gate passes. This is a narrow, deliberate exception to the PR norm, because
    unattended 1–3h refreshes can't wait for a human.
  - **Path-filtered PR test jobs are adopted.** pytest and Vitest run on PRs that touch their
    code. This partly picks up the BACKLOG "Broader CI" item; full lint on every change stays
    deferred.

- **2026-10-04** — Reinstalled house-process 0.7.0 (session boundaries + agent-written
  handoffs) from the playbook's `main` after sdd-playbook #9 merged. The norm and the *Next
  session* block were already in use. The norm's wording now matches the template.

- **2026-10-04** — Harvested 9 lessons upstream:
  [sdd-playbook#10](https://github.com/alexwebber/sdd-playbook/pull/10) (house-process 0.8.0).
  It covers the git extension in bootstrap, the canary usage budget and non-candidate judge,
  feature.json for worktree subagents, the peer-range check, PR checkbox confirmations, and
  agent tips (scheduled workflows, the Bash `for` loop, PowerShell `git commit -F -`). "Fetch and
  branch from `origin/main`" went to the owner's global `CLAUDE.md`. The harvest ran in the main
  conversation, not a subagent, because it needs the owner's picks partway through.
- **2026-10-04** — Installed Spec Kit's core `git` extension (1.0.1), so `/speckit-specify`
  creates its `NNN-name` branch itself. Its auto-commit hooks stay off (default config);
  `.specify/extensions/.cache/` is gitignored. It branches from the checked-out commit, so still
  fetch and start from `origin/main`.
- **2026-10-04** — Reinstalled house-process 0.8.0 from the playbook's `main` after
  sdd-playbook #10 merged. Working norms now include PR checkbox confirmations, the
  interactive-commands exception, and the template's canary wording. This project still doesn't
  opt in to new-model or sampling canaries. The reinstall reordered `.specify/extensions.yml`
  so the `git` commit hooks list before the house-process hooks; no hooks were added or removed.
- **2026-10-04** — Owner answered PR #7's unanswered confirmations:
  - **Brighton target lives in two places.** The hero reads `upcoming-races.yaml`, and
    validation warns if it differs from the goal's target.
  - **Schemas stay in top-level `schemas/`.** This accepts the slight bend of Principle VII.
  - **Spike 0's first Garmin login runs locally on the owner's PC.** It is part of the
    expanded Spike 0 below.
- **2026-10-04** — **Spike 0 compares Garmin with intervals.icu** (owner pick, after a risk
  review). The concern is a Garmin lockout. Research:
  - **Garmin login rate limit (429):** per account, on the login endpoint only. It lasts about
    1h (up to 24h reported) and the official app is reportedly unaffected. It comes from
    repeated password logins, not data reads.
  - **403s:** staleness only; the account isn't affected.
  - **Suspension:** the terms reserve the right, but no personal-account bans were found for
    python-garminconnect.
  - **Strava plus manual stats: rejected.** Strava's November 2024 API terms let a user's data be
    shown only to that user, and Strava lacks the health metrics.
  - **intervals.icu:** an official Garmin sync partner with a personal API key. It provides
    activities with FIT files, weight, resting HR, HRV, sleep and running VO2 max. It lacks
    Garmin training status/load and race predictions.

  Spike 0 now has three parts:
  - **Backup first:** a full Garmin data export, as a new owner prerequisite.
  - **Garmin with safeguards:** first login local, then token-only, at a **3-hourly** cadence.
    S0.3 becomes 16 runs over 48h, and passes at ≥15/16.
  - **intervals.icu coverage check:** connect Garmin to intervals.icu and list which required
    fields the API returns.

  Decide the provider (Garmin, intervals.icu, or hybrid) on that evidence. A switch means
  changing the adapter plus a small spec/plan amendment.

- **2026-10-17** — Upgraded Spec Kit 1.1.0 → 1.2.1, following PLAYBOOK > Upgrading Spec Kit.
  The process: re-init, reinstall `house-constitution` 0.1.1, `house-process` 0.8.0 and `git`
  1.0.1, then restore the constitution, `git-config.yml` and `extensions.yml`. Upstream changes
  that reach us are hardened PowerShell plan scripts (literal paths, empty-plan checks) and a
  deprecated `/speckit-taskstoissues`, which we don't use. The release notes had nothing
  touching presets, extensions or hooks.
- **2026-10-17** — **No usage screenshots** (owner preference). Usage reads near zero at the
  start of a session, so a screenshot there says nothing. The owner says when usage is running
  low, and the agent doesn't ask.
- **2026-10-17** — **Running provider: intervals.icu, not Garmin direct** (owner decision; this
  supersedes the 2026-10-04 Garmin-vs-intervals.icu comparison). Why: it is an official Garmin
  sync partner with a personal API key, so there is no login, token rotation, lockout risk or
  datacenter-IP question. Sticking with a sync partner is the more elegant design.
  - **Garmin direct only on a blocker.** It is considered again only if intervals.icu can't
    supply something required.
  - **Missing metrics become manual entries.** Data intervals.icu lacks (Garmin training status
    and race predictions) becomes owner-entered data the owner updates whenever they like.
  - **Terms checked.** The API terms (effective 2025-10-23) grant a royalty-free licence for
    any lawful use. The one condition: views showing Garmin-sourced data must show Garmin
    attribution per Garmin's brand guidelines.
  - **Full history comes from the Garmin export.** It is loaded into intervals.icu through
    *Settings → Import all Garmin data*, so ingest reads only intervals.icu.
  - **API checked.** It publishes an OpenAPI 3 spec at `https://intervals.icu/api/v1/docs`.
    Activities carry HR zone times, vertical oscillation/ratio, stride, power, training load
    and a `race` flag. Wellness includes weight, bodyFat, restingHR, hrv, vo2max and ctl/atl.
  - **Spike 0 is now one check.** It becomes the intervals.icu coverage check
    (`spikes/intervals/probe.py`), which confirms the API actually returns those fields for
    Garmin-synced data.
  - **Dropped:** the 48-hour Garmin schedule, T003, `FETCH_MODE`/PC fetch, Fernet token
    storage and garminconnect.
  - **R2 stays**, for raw data.
  - **Docs follow the evidence.** The spec, plan and tasks, and the constitution's "Garmin access
    via python-garminconnect" wording (a PATCH amendment), are amended once the probe results
    are in.
  - Upstream #444 also closed on 2026-10-16 as a local `.netrc` misconfiguration, not a Garmin
    block.
- **2026-10-17** — **Spike 0 (intervals.icu coverage) passed**, locally and from GitHub
  Actions. Details are in `spikes/intervals/RESULTS.md`.
  - **Covered:** all required fields for Garmin-synced data. Activities have HR zones, running
    dynamics (incl. GCT), power, load, streams and FIT files. Wellness has weight, body fat,
    resting HR, HRV (rMSSD), VO2 max and ctl/atl.
  - **Missing:** only Garmin training status and race predictions.
  - **Ingest needs a User-Agent.** It must send its own User-Agent, because Cloudflare blocks
    Python's default one.
  - **Fetch stays on Actions.** Actions can fetch directly, so there's no `FETCH_MODE` and no
    PC fallback.
  - **History:** it currently goes back to 2025-10-18 until the Garmin export is imported.
- **2026-10-17** — Owner answers on the intervals.icu gaps:
  - **Training status and race predictions** are manual, dated owner entries in YAML. They are
    shown "as of <date>" and updated whenever the owner likes.
  - **Training load** is intervals.icu's fitness/fatigue/form (ctl/atl), labelled as its own
    model, not Garmin's.
  - **Treadmill runs** (`VirtualRun`) count in totals, goals and the run list, with a
    "treadmill" label. They never get maps and are not PB-eligible unless the owner marks them.
  - **Supporter tier:** revisit at go-live. The owner will definitely become a supporter once
    the live integration works, and the agent raises it at T112.
- **2026-10-17** — **Constitution v1.0.1** (PATCH, via `/speckit-constitution`). The Garmin
  wording now says intervals.icu:
  - **Principle IV:** the example source list names intervals.icu, and the rationale no longer
    claims an unofficial client.
  - **Technology constraints:** ingest gets running data via the intervals.icu API.

  No principle's meaning changed.
- **2026-10-17** — Owner ticked all eight PR #14 confirmations:
  - **Constitution v1.0.1 is ratified.**
  - **Treadmill runs** count toward distance and training goals. They count toward race-time
    goals only if the owner marks the run.
  - **Training effect** is left out. FIT extraction is possible later.
  - **HRV** is shown as "HRV" (rMSSD), with a baseline band only where baseline data exists.
  - **Per-run training load** stays private.
  - **Garmin attribution** also goes on the manual Garmin figures.
  - **Refresh cadence** stays every 2 hours.
  - **FR-031 is narrowed** to the closed list of goal metrics.
  - **Spike 1a's workers.dev subdomain** is `alexanderwebber`.
- **2026-10-17** — Spike 1 and the scaffold run as a **cloud session** (owner pick), to use
  the cloud credits before they expire on 2026-11-05.
- **2026-10-17** — **Pins re-verified at scaffold time (T016).** New dependencies start on their
  current release, so the scaffold adopts:
  - **npm:** astro 7.4.0 (needs Node >= 22.22.0, so `engines` and the docs say that), satori
    0.62.0, maplibre-gl 6.14.0, wrangler 4.151.1, vitest 5.0.5, @playwright/test 1.64.1,
    @axe-core/playwright 4.14.0.
  - **PyPI:** boto3 1.43.114, moto 5.2.4, ruff 0.17.1.
  - **Unchanged:** the rest of the plan's pins, and the deliberate TypeScript 6.0.3 pin
    (`@astrojs/check` 0.9.10 is still the latest and still peer-requires `^5 || ^6`; TS 7.0.2
    is out).
  - **Known advisory:** `npm audit` reports a moderate `fflate` issue (infinite loop on
    malformed ZIP64) via satori. Satori only reads our own build-time inputs, so it's accepted;
    the fix `npm audit` offers is a satori downgrade. Re-check at the next session-start check.
  - plan.md and tasks.md carry the new pins. research.md keeps the original comparison.
- **2026-10-17** — **Spike 1b (T013): size and build time pass, cap unchanged.**
  - **Size:** 5,000 synthetic runs, worst case (all seven series at 600 points), are **~109 MB
    as compact JSON** (~22 KB/run), under the ~150 MB estimate. With 2-space indentation they are
    **~263 MB**, so `PublishedWriter` (T063) writes compact JSON with sorted keys
    (contracts/storage.md updated). Compressed (gzip) they are ~36 MB, roughly what git stores.
  - **Build:** a dummy Astro 7.4.0 build of 5,000 run pages took **~10.5 s** on 4 cores
    (65 MB of HTML).
  - The 600-point downsample cap stays.
- **2026-10-17** — **Spike 1a (T014): the Workers free-plan limit is confirmed at 20,000 files
  per version.** Run from a throwaway branch workflow with wrangler 4.151.1:
  - **12,000 files** deployed to `spike-workers-limit.alexanderwebber.workers.dev` in ~18 s
    (asset upload 11.7 s). It served the first and the 12,000th file
    correctly about 10 s after deploy (one 404 first). Runs 39055362164 and 39055450234.
  - **20,001 files** were rejected by the API (code 10304): "exceeds the Workers Free limit of
    20,000 static asset files per Worker version" (Paid: 100,000).
  - The throwaway Worker was deleted, and the workflow removed. The `alexanderwebber`
    workers.dev subdomain is now registered.
  - The plan's ~6,000 deployed files at 5,000 runs is ~30% of the limit, so no plan change.

- **2026-10-17** — **Phase 2a–2b built** (schemas, storage, validation, scans). Design choices
  the later tasks build on:
  - **Schemas:** shared building blocks live in `schemas/defs.schema.json`. An `x-error`
    annotation holds each node's owner-facing message, and goals use a `type` discriminator.
    List-shaped owner files (goals, upcoming races, overrides, exclusions) can't carry
    `schema_version`, so they are always the current version. Manifest `input_hash` is sha256
    hex. Run series values may be `null` (gaps), and each health metric has a fixed unit.
    `status_override` takes only `active` (keep a goal active despite an automatic achievement).
  - **Store:** `RunningStore` methods are async, so a database-backed store stays a drop-in.
    Absent files mean no data yet. A missing `section.yaml` is a warning, so the gate stays
    green before owner data exists. Any unexpected file under `data/running/` is an error.
  - **YAML:** owner YAML is read with YAML 1.2 core rules in both languages, so `3:30:00` and
    dates stay strings. Python uses `awingest.yaml12`, because PyYAML is YAML 1.1.
  - **Scans:** `scan-privacy` takes the provider-ID map as `--provider-ids=<file>`. Its key-based
    rules skip bundled library code in `dist/_astro/`.
  - **Doc fix:** the contract's example run IDs `k3f9` and `p0rt` didn't match the run-ID
    pattern (base32 has no 0, 1, 8 or 9); they are now `k3f7` and `p2rt`.
  - **Versions:** every npm and PyPI pin is still current (TypeScript stays on its deliberate
    6.0.3 pin). The accepted `fflate` advisory is unchanged (the only fix is still a satori
    downgrade).

- **2026-10-17** — **Phase 2c–2d built** (gate, CI workflows, ingest core). Choices later tasks
  build on:
  - **Node version:** CI reads `.nvmrc` (`22`). `engines` stays the `>=22.22.0` floor, because
    setup-node resolves a range to the newest Node available.
  - **Actions pinned by commit SHA** (checkout 7.0.1, setup-node 7.1.0, setup-uv 10.3.0,
    upload-artifact 7.0.2, download-artifact 8.0.2). setup-uv publishes no major tag.
  - **Gate:** the R2 run-ID map is fetched with the runner's AWS CLI into `$RUNNER_TEMP` and
    deleted after the scan. A missing map is a notice; any other R2 failure fails the gate.
    `gate.yml` deploys the `dist/` artifact the gate job built, so production gets exactly the
    gated build.
  - **Gate logs don't leak:** `scan-privacy` findings give `file:line:column` and the matched key,
    never the caught value. The bot path runs the gate on unpublished data, so its log must not
    carry it.
  - **Errors:** every failure class subclasses `awingest.errors.IngestError` (`code`,
    `exit_code`, `likely_cause`, `action`), shared by provider and archive errors.
  - **Archive ETags** are the MD5 hex of the bytes, so `etag_of(data)` after a `get` is the
    `if_match` value; `if_match=ABSENT` means create-only. S3/R2 answer a failed `If-Match` on a
    missing object with 404, which `R2Archive` maps to `ArchiveConflict`.
  - **Privacy in memory:** provider IDs, raw titles and coordinates are kept out of the normalised
    types' `repr`. Logging scrubs secrets, emails and provider IDs from every caller field.

- **2026-10-17** — **Phase 2e built** (intervals.icu adapter, fetch stage, backfill). Choices
  later tasks build on:
  - **Raw layout:** activity parts are keyed by archive file name (`summary.json` is the list
    row, plus `detail.json`, `streams.json`, `time-at-hr.json`, `activity.fit`). A
    `fetch.json` marker (row hash, part names) is written after all parts, so a marker means a
    complete set. `ActivityRef` gained a private `row` field to carry the list row.
  - **Optional parts:** HR time and the FIT file answer 404 for some activities; the bundle
    then lacks them. HR zones come from `icu_hr_zone_times`; `time-at-hr` is archived, not
    parsed.
  - **Start time:** `start_date_local` is read as Europe/London wall time, so a run abroad keeps
    its own calendar date (only the date is ever published).
  - **Windows:** with no cursor, `fetch` covers the last 14 days; history comes from `backfill`
    (default `--from 2000-01-01`, 90-day windows). Backfill sets the cursors only if none exist,
    and never touches `last_success_at` or `public/freshness.json`.
  - **Failures:** one failing activity makes the run `partial` (exit 0) and holds the activity
    cursor, so it is retried. Three network failures in a row end the run. A 429 with a
    `Retry-After` of 60 s or less is waited out in-run; otherwise `rate_limited_until` is
    recorded (15 min without the header) and runs exit 11 without calling the provider until
    it passes.
  - **Freshness:** only a successful run whose window ends today sets `last_success_at` and
    rewrites `public/freshness.json` (so an old `--reimport` window doesn't claim freshness).
  - **Wellness:** a day with no approved values isn't archived, so it can't blank a stored day.
  - **CLI:** `fetch` and `backfill` are wired now (part of T066), with `--archive r2|local` and
    `--archive-dir` (default `$AWINGEST_ARCHIVE_DIR` or `.archive`, gitignored).
  - **New pin:** `tzdata` 2026.5, because Windows has no system time-zone database and the owner
    runs `backfill` locally.
  - **Checked against real data** (throwaway workflow, run 39060846318: full backfill into a
    runner-local archive, nothing written to R2): 189 runs (137 `Run`, 52 `VirtualRun`) and 367
    wellness days fetched in ~20 min with no failures, and all 189 normalised. Every run had
    all five parts. `latlng` is lat in `data` and lon in `data2`. An incremental `fetch`
    straight after found nothing new. History still starts in Oct 2025 (T150 pending).
  - **Cadence is doubled:** intervals.icu keeps Garmin's running cadence as strides per minute
    (median 78); the published schema wants steps per minute.
  - **Calibrated streams are scaled:** when the `distance` stream ends more than 0.5% from the
    summary distance (one run was 1.2 km off), the stream is scaled to the summary.
- **2026-10-17** — Owner confirmed PR #19: **computed average power matches Garmin Connect**
  (six recent runs, 518–591 W, from the `watts` stream mean). Reference run for the publish
  stage: the 2026-10-17 5k (5,010 m, harder effort) shows **677 W average and 1,036 W max** in
  Garmin Connect. Use it as a check value once power is published (the normaliser keeps the
  per-sample `power`, so a max can be derived if wanted).

- **2026-10-17** — **Phase 2f built** (processor, publish stage, alerts, CLI). Choices later
  tasks build on:
  - **Races:** a `race.yaml` linked by `run_id` makes the run a race by itself, because Garmin
    sync never sets intervals.icu's race flag. `designate: not_race` un-designates it, and a
    `run-overrides.yaml` `is_race` wins over both. Owner confirmation asked in the PR.
  - **Best pace** is the fastest kilometre (the 1 km best effort) if plausible, else the average.
  - **Plausibility:** the threshold is 0.85 x the current men's world record, rounded down to the
    second (so it errs towards plausible). Other distances scale with Riegel's formula.
  - **Weight average:** one decimal; points run to the last day with any wellness data.
  - **Edited start dates:** a run keeps the date in its ID, because IDs are never reassigned and
    the gate requires the prefix to match. The process log says `run_date_changed`.
  - **Unpublishable runs:** no distance or duration means no published file and no ID.
  - **Failure handling:** one activity that fails to normalise makes the run `partial` and keeps
    its last good file. Invalid owner or published data writes nothing (exit 20). An unreadable
    ID map, or a missing one while runs are published, aborts (exit 14).
  - **Idle runs change nothing:** `processed_at` and `refresh.json` change only with data, so a
    refresh that finds nothing new makes no commit.
  - **Writer:** stages the new tree beside the published one (hard links for unchanged files) and
    swaps it in. The `published.staging`/`published.old` folders are gitignored.
  - **Python validation:** `awingest.schemas.SchemaSet` validates owner and published files.
    Its messages give path and rule, never the value.
  - **Size:** a 1 Hz marathon sanitises in under 0.1 s, to a 17.6 KB file.

- **2026-10-17** — Owner confirmed PR #21's three points:
  - **Linked races:** a `race.yaml` with `run_id` makes the run a race by itself.
  - **Best pace** is the fastest kilometre.
  - **Weight average:** days stay in even when their 7-day window holds only one or two
    weigh-ins (so the first day shows that weigh-in exactly). The owner isn't worried about
    privacy here, so the spec's rule stands: a day is left out only when its window has none.

- **2026-10-17** — **Phase 2g built** (refresh workflow, freshness Worker). Choices later tasks
  build on:
  - **Only one job can write.** `publish` (process, `publish-check`, gate, path check) runs with
    `contents: read`, because it runs npm and ingest code. `commit`, the only job with
    `contents: write`, runs just git and tar: it unpacks the gated tree, checks the paths again
    and pushes `HEAD:main` from the gated commit. If `main` moved, the push is rejected and the
    next run re-publishes.
  - **Branch runs are fetch-only.** A run on any ref but `main` behaves like `fetch_only: true`, so
    a branch can't publish. T070's Actions half ran this way, before merge.
  - **Fetch failures don't block publishing:** `publish` runs unless the run is cancelled, so
    archived data and owner edits still publish. A failed fetch still turns the run red.
  - **Worker:** the R2 record is re-shaped to the contract's two fields; a missing or malformed
    record is a 503 (`no-store`). `HEAD` is answered; other methods get 405.
  - **No rulesets to bypass:** the repo is private on the free plan, where rulesets aren't
    available, and classic branch protection is off.

- **2026-10-17** — Owner ticked all four PR #23 confirmations:
  - **Merging starts publishing.** The 2-hourly schedule publishes what R2 holds, ahead of
    T085's full backfill.
  - **A failed fetch turns the run red**, even before the 24-hour `ingest-failing` issue opens.
  - **Publish-failure alerts go to the backlog.** The alert only watches fetch staleness for now.
  - **T070's local half is dropped**, so T070 is done.

- **2026-10-17** — **Phase 2h built** (the shared shell). Choices later tasks build on:
  - **Tokens:** the dataviz reference palette, re-validated against our surfaces and the Running
    warm ones. Light slots 3–5 are below 3:1, so charts that use them carry direct labels or the
    table. Single-series Running charts use `--running-series` (slot 2, orange). Dark mode
    follows the OS only (a toggle would need JS). A Vitest suite enforces AA contrast for every
    token pair in both themes.
  - **Charts:** a stretched SVG (`preserveAspectRatio="none"`, non-scaling strokes) draws the
    lines. Labels, dots and columns are HTML placed by percentage, so text is real-size at 320 px
    with no JS. Native `title` tooltips are the hover layer, and the `<details>` table is the full
    data view. Minor x labels hide below 40rem. Range switching is CSS `:has()` over native
    radios.
  - **Share images:** satori (WOFF Inter 5.3.0; it can't read WOFF2) then sharp PNG.
    `ogEndpoint()` makes a static endpoint, and `ogPath('/running/goals/')` gives
    `/og/running-goals.png`.
  - **Freshness:** without JS, `LastUpdated` shows `last_success_at_build` from `refresh.json`,
    with the stale notice decided at build time (the daily rebuild keeps it honest). The script
    (~680 B, inlined) takes the later of the live and build values. On failure it leaves the
    page as built. The instant is epoch milliseconds, because run pages can't hold ISO
    datetimes (scan-privacy).
  - **Garmin attribution placement** (T152): title level. It goes under each page's `<h1>`
    (`SectionLayout garmin`) and also at each chart, tile or card heading (`ChartFigure` source
    slot), plus in share images showing Garmin data. Text only: "Source: Garmin [device]", or
    "Derived in part from Garmin device-sourced data" for fitness/fatigue/form. Why: the
    guidelines (V 6.30.2025) want "Garmin [device model]" next to the primary heading of every
    data view, cards and charts included, and accept text instead of the logo. They were read
    through excerpts, because the sandbox and WebFetch can't reach developer.garmin.com, so
    re-check the PDF at T112.
  - **Testing:** `vitest.config.ts` uses Astro's `getViteConfig`, so Vitest renders `.astro`
    components with the container API. `/shell-preview/` (synthetic data) is injected only
    when `SHELL_PREVIEW=1`, and the `tests.yml` Playwright job builds that way. The deploy build
    never does.
  - **No site-wide nav yet.** The header carries the site name, and each section passes its own
    nav (one section can't list others, by Principle VII). A site nav comes with CV/Blog.
  - **Versions:** every npm pin is still current, and TypeScript stays on 6.0.3
    (`@astrojs/check` still peer-requires `^5 || ^6`). The `fflate` advisory via satori is
    unchanged and still accepted: satori now runs, but only reads our own fonts and card text,
    never ZIP archives.

- **2026-10-18** — Owner ticked all four PR #25 confirmations:
  - **Garmin attribution placement** is OK: title level, under each page heading and at each
    chart, tile or card heading, plain text. Re-check the PDF at T112.
  - **Device names: yes.** No models were given yet, so the next session asks which watch(es)
    and which scale. Until then the text stays "Source: Garmin".
  - **Running's warm look** is OK as a starting point.
  - **Dark mode follows the OS setting only**, with no toggle.

- **2026-10-18** — **Back to local sessions** (owner). The owner has a large local allowance and
  has used much of the cloud credit, so sessions run locally on Windows again.
- **2026-10-18** — **Garmin devices in the attribution** (owner answers):
  - **Kit:** a Venu X1 watch, an Index S2 scale, and an HRM 600 strap (new).
  - **Runs publish their own watch.** The new `device` field comes from intervals.icu's
    `device_name`. Only a plain Garmin model name is kept, with the "Garmin " prefix stripped.
    Recent history shows Venu X1 (236 activities) and Venu 2 Plus (43), so naming today's kit on
    every view would have mislabelled older runs.
  - **Multi-run views** list their watches, newest first, falling back to plain "Garmin" past
    three.
  - **Weight and body fat** name the scale from `section.yaml` `garmin_devices.scale`
    (`Index S2`; it has always been the S2). T106 writes it when it creates `section.yaml`.
  - **Watch wellness and manual figures** say plain "Garmin".
  - **The HRM 600 isn't named**, because the recording device is the watch.
  - **Shoes and gear** went to the backlog.
- **2026-10-18** — **`PROCESSOR_VERSION` in the input hashes** (T086 review). Bumping it makes
  the next scheduled refresh reprocess everything, so a processor change (like `device`) needs no
  manual `process --all`. It is now 2.
- **2026-10-18** — **Scheduler and Actions minutes** (owner picks):
  - **Watch the schedule for a day.** GitHub fired only the 22:17 slot (at 00:03) and the 04:17
    slot (at 04:37), and dropped the 00:17, 02:17 and 06:17 slots. If gaps over 3 h persist, the
    agent raises a PR in which the freshness Worker's Cloudflare cron dispatches `refresh.yml`.
    That needs a fine-grained token with Actions: write on this repo only.
  - **Minutes are monitored.** The private repo meters Actions: a refresh bills about 3 minutes,
    or 5 when it publishes, so roughly 1,200–1,500 a month against GitHub Free's 2,000. Once the
    owner grants `gh` the `user` scope, the agent checks usage each session and warns before the
    limit.

- **2026-10-18** — Owner ticked all three PR #27 confirmations:
  - **Each run publishes its watch model** (`device`), a newly approved public field.
  - **Two review findings stay in the backlog:** deploy ordering across workflows, and Garmin
    `external_id`s in the provider-ID scan.
  - **`gh` has the `user` scope**, so the agent reads Actions minutes each session.
- **2026-10-18** — **Refresh trigger: Cloudflare cron dispatches `refresh.yml`** (PR #28). The
  watch-for-a-day check failed: after 04:37 UTC the 06:17 and 08:17 slots were dropped too (a
  4 h 10 min gap and counting).
  - **Worker cron** `17 */2 * * *` POSTs a `workflow_dispatch` on `main`. The token is a
    fine-grained one with Actions: write on this repo only, held as the Worker secret
    `GITHUB_DISPATCH_TOKEN`. The ingest still runs on Actions. Free plan: 5 crons per account,
    and this uses 1.
  - **`schedule` is a thinner backup**, `47 1-23/6 * * *`. A `guard` job (schedule events only,
    about 1 billed minute) skips the run if a dispatched run started in the last 150 min. If
    none has started in 6 h, it opens a `refresh-trigger-failing` issue, which closes itself
    once dispatches resume. Why every 6 h, not every 2: a guard on every 2-hourly slot would
    cost about 360 minutes a month against GitHub Free's 2,000.
  - **Failures are visible:** a failed dispatch logs `refresh_dispatch_failed` (code, status,
    likely cause, action, never the token) and fails the invocation. Worker logs are on
    (`observability.enabled`).
- **2026-10-18** — Owner ticked all three PR #28 confirmations. The dispatch token has a
  **1-year expiry: 2027-10-17 23:00 UTC** (18 Oct UK time). GitHub offers no expiry, but
  advises against it. The agent raises a new token a week before; if it lapses, the backup
  schedule keeps refreshing and the `refresh-trigger-failing` issue opens within 6 h. The secret
  was set with the Cloudflare API token from the setup file (no `wrangler login`), and a test
  dispatch with it returned 204.
- **2026-10-18** — **No credential rotation** (owner decision). A shape check printed the R2
  access key and secret, the Cloudflare API token and the intervals.icu key into the session
  transcript (not the repo or any log). Only the owner has access to the chat, so they're kept
  as they are.

- **2026-10-18** — **Phase 3 goal answers** (owner question round; goals not yet written):
  - **Featured, in priority order:**
    1. Brighton sub-3:25 (`upcoming-races.yaml` `target_time: "3:25:00"`)
    2. Half sub-1:40 (new)
    3. 10k sub-43
    4. 5k sub-20 (already achieved: 19:44 on 17 Oct 2026, track run `2026-10-17-ofka`; the
       goal finds it, so no override is needed)
    5. Weight 93 kg (`at_most`)
    6. Body fat 17.5% (`at_most`)
    7. VO2 max 52.5 (`at_least`, "superior" for the owner's age; Garmin reports whole numbers,
       so it counts at 53)

    With the 5k achieved, the six active goals fit `featured_goal_limit: 6`.
  - **VO2 max 55 comes next.** The agent adds it at the review after 52.5 is achieved.
  - **Progress start: October 2025.** `created: 2025-10-01` on weight, body fat and VO2 max, so
    the start doesn't jump back years when the Garmin export is imported.
  - **Build start:** `section.yaml` `build_start: 2026-09-05`, when the owner's Garmin Coach
    plan started. The current block ends on 26 Dec with a fast solo half, and then the Brighton
    block starts. No other races are planned.
  - **Lab VO2 max test:** some time in the new year, recorded as a lab reference point.
  - **Still needed:** Garmin training status and race predictions (T154).
- **2026-10-23** — **The 17 Oct track session never reached intervals.icu** (three Track
  Running activities: a warm-up, a 19:44 5k and a cool-down). intervals.icu had no activity of
  any type that day, while later runs synced normally. So Garmin didn't push those activities
  to intervals.icu. The owner uploaded the FIT files on the Calendar page, and a dispatched
  refresh published them.
  - **Stay on intervals.icu** (agent recommendation; the owner had asked about Strava).
    Strava's API terms forbid showing data to others, and Strava receives Garmin's activities
    by the same partner push, so it wouldn't be more complete.
  - **Audit at T150:** compare every run in the Garmin export with intervals.icu, to size the
    gap and decide whether ongoing detection is needed. A daily Garmin-direct activity-list
    check is an option, used only to raise an issue, never as a data source.
  - **Device override:** manual uploads have no intervals.icu device name, so
    `run-overrides.yaml` gained `device`, which wins over intervals.icu's (owner: Venu X1 for
    the three runs).
- **2026-10-23** — **If Actions minutes still run close to the limit** (owner, PR #31): first
  move the refresh to every 3 hours (the constitution allows 1–3 h). After that, weigh making
  the repo public against paying a few dollars a month.
- **2026-10-23** — **T154 entered:** Garmin training status Productive, and race predictions
  5k 19:31, 10k 40:56, half 1:32:01, marathon 3:25:18, all read on 2026-10-23
  (`manual-metrics.yaml`).

- **2026-10-23** — **Phase 3 (US2 Goals) built** (`001-goals` PR; implement subagent about
  265k tokens). Choices later tasks build on; the owner confirms them in the PR:
  - **The achieved 5k is featured** (owner, PR #33 comment: "a major milestone"), back at
    priority 4. `section.yaml` was written early to set `featured_goal_limit: 7`, with the
    known focus race, build start, charity and scale. The other seven confirmations were
    ticked.
  - **`created` limits achievement too:** only data on or after it counts, so the Garmin
    export can't achieve a goal with an old reading.
  - **Race-time progress** is target ÷ fastest time (46:00 against 43:00 is 93%), with the
    gap in words. An effort counts only if its time rounded to the second is under the target.
  - **Body fat's headline** is the latest reading; the 7-day mean only drives progress.
  - **Validation at build start:** the Running integration validates all data in
    `astro:build:start`, because Astro 7 empties `dist/` before rendering, so a bad goal would
    otherwise wipe the last good build (US2.7).
  - **Run links** wait for T102's run pages (`links.ts`), so there are no dead links.
  - **Real data:** 5k achieved 17 Oct 2026 by `2026-10-17-ofka`; half 1:47:21, 10k 46:00,
    weight and body fat 7–8% of the way, VO2 max 52 (80%); Brighton has no marathon effort yet.

- **2026-10-23** — Upgraded Spec Kit 1.2.1 → 1.2.3, following PLAYBOOK > Upgrading Spec Kit
  plus the project's notes on its missing steps. The process: re-init, reinstall `git` 1.0.1,
  `house-constitution` 0.1.1 and `house-process` 0.8.0, then restore the constitution,
  `feature.json`, `git-config.yml` and `extensions.yml` (the hooks were identical, only
  reordered). What reaches us: `-LiteralPath` in the PowerShell prerequisite and task scripts
  (bracketed feature paths). The skills came out unchanged.

## Upstream candidates

- 2026-10-23 — On the 1.2.3 upgrade, a text diff of the regenerated `extensions.yml` showed
  whole hook blocks as deleted, because only the key order had changed. Strengthen the
  *Upgrading Spec Kit* note: compare the backup and the new file as parsed YAML (installed
  list, settings, hooks per event), not by `diff`, before restoring the backup.
- 2026-10-23 — Astro 7 empties `outDir` before it renders pages, so a data error thrown while
  rendering still wipes the previous `dist/`. Agent tip (Astro): when a failed build must leave
  `dist/` untouched, validate in an integration's `astro:build:start` hook.
- 2026-10-23 — `scripts/lighthouse-budget.mjs` calls `spawn('npx', ...)`, which fails on Windows
  with ENOENT (it needs `shell: true` or `npx.cmd`), so the Lighthouse budget runs only in CI.
  Agent tip (Windows gotchas): spawn `npx` via `shell: true` in cross-platform scripts.
- 2026-10-23 — A keyboard-path test that de-duplicated focus stops by `href` stopped early,
  because the site name and the footer both link to `/`. Agent tip (a11y tests): key focus
  stops on the `href` plus the link text.
- 2026-10-23 — The owner's goal list (seven featured goals) broke a validator limit (six) that
  the question round never mentioned. Generalisation (question rounds): when collecting owner
  data, check the answers against the schema's rules before the round ends, so a conflict is
  asked about while the owner is there.

- 2026-10-23 — GitHub Actions bills each job as at least a whole minute, so a 2-hourly refresh
  split into many short jobs used about 55 minutes a day (about 1,700 a month on a private repo,
  against Free's 2,000). The plan's estimate of 1,200–1,500 had counted run time, not jobs.
  Also, the runs `timing` API reported 0 billable ms, so measure from job start and end times.
  Agent tip (CI cost): estimate minutes as jobs per run x runs per day, and fold short steps
  into one job unless they need different permissions.

- 2026-10-23 — Garmin's push to a sync partner (intervals.icu) silently skipped three Track
  Running activities from one day, while other activities synced. Generalisation (provider
  choice): a partner sync is not a complete copy of the source. Plan a reconciliation against
  the source of truth, such as a full export at onboarding, and a way to repair gaps, such as a
  manual upload that flows through the normal pipeline.

- 2026-10-18 — A secrets-file shape check (`awk -F=` printing the key and value length) assumed
  `KEY=value` lines. The owner's file used `Key: value`, so each whole line, value included,
  printed as the "key", leaking four credentials into the transcript. Agent tip for the secrets
  file helper: never print any part of a line. Print line numbers, a fixed label for known keys,
  and lengths only, and treat a line with no `=` as unparsed rather than as a key.

- 2026-10-18 — Tests written in Linux cloud sessions symlinked a directory into temp repos. On
  Windows that needs the symlink privilege (WinError 1314), so 48 pytest cases errored on the
  first local run, while CI and the cloud were green. Agent tip (Windows gotchas): when a
  project alternates between cloud and local sessions, run the full suites locally on return.
  Test helpers should fall back to a directory junction (`_winapi.CreateJunction`; Node
  `symlinkSync(..., 'junction')`).
- 2026-10-18 — Incremental processing keyed on input hashes alone meant a processor change
  (a new published field) would never reach already-published files without a manual `--all`
  that no workflow ran. Generalisation (pipelines): include a code or processor version in
  every incremental cache key, so a change reprocesses on its own.

- 2026-10-18 — The browser-test page for the shared shell read "Last updated" from the repo's
  published data. Its tests assumed there was none, so they broke on the PR as soon as the first
  scheduled refresh published real data to `main` (PR CI tests the merge with the base).
  Generalisation (testing): test fixture pages pin every input they assert on, never repo data
  that a bot can change underneath an open PR.
- 2026-10-18 — A newly merged GitHub Actions `schedule` fired its first slot about 1h45 late
  (22:17 slot, run started 00:03 UTC), with zero schedule runs listed in between. Agent tip:
  don't treat a missed first slot as a failure or dispatch a publishing run to "unstick" it.
  Wait about two slots, and check the workflow is `active` on the default branch. Later that
  day it **dropped** three of five 2-hourly slots outright, not just delayed them (a 4 h gap).
  So a freshness requirement of a few hours can't rest on GitHub `schedule` alone; plan for an
  external trigger (e.g. Cloudflare cron calling `workflow_dispatch`). Pattern adopted here
  (PR #28): keep `schedule` as a sparse backup whose first job skips the run when a dispatched
  run is recent, and opens an issue when dispatches stop, so a dead external trigger isn't
  silent.
- 2026-10-17 — satori sizes boxes content-box. A root with `width: 100%` plus padding and a border
  rendered at 1360 x 790 on a 1200 x 630 canvas, and the footer line fell off the image. Agent
  tip: give the sized root no padding or border, and put the padding on a `flexGrow: 1` child.
  Look at a rendered PNG before trusting a share-image layout.
- 2026-10-17 — The `pkill -f` self-kill recurred with a *specific* pattern
  (`pkill -f 'astro preview --port 4321'`), because the pattern was in the same Bash command's
  own text, so it matched the agent's shell (exit 144). Strengthen the tip: never `pkill -f` at
  all from an agent shell. Find the PID by port (`ss -ltnp`) or keep the PID from when it was
  started.
- 2026-10-17 — Cloud session: `@playwright/test` 1.64.1 wants `chromium_headless_shell-1248`,
  but the image ships chromium 1194 under `/opt/pw-browsers`, so `playwright test` can't launch.
  Agent tip: run locally with a throwaway config that spreads the repo config and sets
  `launchOptions.executablePath: '/opt/pw-browsers/chromium'`. Don't edit the committed config;
  CI installs its own browser.
- 2026-10-17 — Cloud session: developer.garmin.com is blocked for both the sandbox and WebFetch,
  so the brand guidelines T152 says to re-read could only be read through search excerpts.
  Generalisation (research before choosing): when a required primary source can't be fetched,
  say so in the code comment and the decisions log, and name the checkpoint where it gets
  re-checked (here T112), rather than presenting excerpts as a full read.

- 2026-10-17 — A private repo on GitHub Free answers the rulesets endpoints with 403 "Upgrade
  to GitHub Pro", so the plan's `gh api .../rulesets` check can't succeed there, and a job's
  `GITHUB_TOKEN` can't read the default workflow permissions either. Agent tip: read
  `branches/<name>`'s `protected` flag instead, and treat the rulesets 403 as "none apply".
- 2026-10-17 — A bot-commit workflow that runs `npm ci` and the build in the same job as
  `contents: write` gives every install script a token that can push to `main`. Generalisation
  (CI security): build and gate with read-only permissions, then hand the gated output as an
  artifact to a separate job that has write access and runs only git.

- 2026-10-17 — Astro 7 runs `astro preview` in the background when it detects a coding agent
  (`CLAUDECODE` set), so Playwright's `webServer` reports "exited early" locally while CI works.
  Agent tip: clear `CLAUDECODE`/`AI_AGENT` in the web server's env (done in
  `playwright.config.ts`), and stop strays with `astro preview stop`.
- 2026-10-17 — A privacy scan that prints ±30 characters around each match puts the caught
  values (coordinates, provider IDs) into CI logs, which become public with the repo.
  Generalisation (privacy checks): scanners report position and rule, never the matched value.
- 2026-10-17 — ruff's PLE1205 flags any `<name>.error("event", exc)` as a stdlib logging
  format-string call. Agent tip: give custom structured loggers keyword-only extras (`exc=`).

- 2026-10-17 — In a cloud session, a Bash call with a stray `cat > file` and no input waited on
  stdin until it timed out. The `pkill -f cat` used to clean up then killed the agent's own
  shell, because the pattern matched its command line. Agent tips: always give `cat >` a
  heredoc or a source file. Kill background tasks by task ID or exact PID, never with
  `pkill -f <common word>`.
- 2026-10-17 — Contract docs carried example IDs (`k3f9`, `p0rt`) that broke the schema's own
  pattern, and nobody noticed until the schemas were written. Generalisation (spec quality):
  when schemas land, validate the contract's examples against them, or make the examples
  fixtures.
- 2026-10-17 — Python's PyYAML is YAML 1.1, so unquoted `3:30:00` becomes 12600 and `2027-04-04`
  becomes a date. JS `yaml` 2.x defaults to YAML 1.2, where both stay strings. Generalisation
  (agent tips): when two languages read the same YAML, pin both to one YAML version and test it
  with shared fixtures.
- 2026-10-17 — ajv's `schemaPath` restarts at every `$ref`, so you can't group branch errors
  under a failed `anyOf`/`oneOf` by path prefix. ajv emits them directly before the composite
  error, so group by that order instead. Agent tip for owner-friendly schema errors.

- 2026-10-17 — In a GitHub Actions `run:` step (`bash -e`), `x=$(curl ...)` inside a retry loop
  exits the step on the first curl failure (here exit 35, TLS not yet ready on a newly
  registered workers.dev subdomain), so the loop never retries. Agent tip: add `|| true` to
  command substitutions inside retry loops, and allow a few minutes for a new workers.dev
  subdomain's certificate.
- 2026-10-17 — Cloud session: the sandbox's egress policy blocks intervals.icu and
  `*.workers.dev` (CONNECT 403), not only secrets. So an adapter can't be checked against the
  real API from the sandbox. Agent tip: check real payload shapes with a throwaway branch
  workflow that prints aggregates only (key names, counts, rounded medians), never values.
- 2026-10-17 — An "aggregates only" report used `Counter.update(record)` to count a dict's
  keys, but `Counter.update(mapping)` adds the mapping's *values*. So it printed every wellness
  date and summed health values into an Actions log. Agent tip: count keys with
  `update(d.keys())`, and dry-run a report on fixtures and read its output before it touches
  real data.
- 2026-10-17 — Cloud session: the GitHub MCP `get_job_logs` returns 404 while a job is still
  running, and works once it finishes. Agent tip: poll the job's step status, then read the
  logs at the end. This made the planned "commit RESULTS.md back" fallback unnecessary.

- 2026-10-17 — The Agent tool's `isolation: "remote"` quietly ran the subagents in a local git
  worktree (`.claude/worktrees/agent-*`), not in the cloud. That spent plan usage, not the
  owner's cloud credits. The agent also couldn't check out the branch held by the main
  checkout, so it pushed with `HEAD:<branch>` and left a stray worktree and branches behind.
  Worktrees lack the gitignored `.specify/feature.json`, so the speckit scripts needed
  `SPECIFY_FEATURE_DIRECTORY=specs/<feature>`. Agent tips:
  - Check `git worktree list` after a "remote" run, and clean up.
  - Pass the branch and that env var in the prompt of any isolated speckit subagent.
  - Don't promise cloud-credit spend from `remote` isolation; a claude.ai/code session is the
    reliable route.

- 2026-10-17 — The mandatory `/speckit-git-initialize` pre-hook of `/speckit-constitution` was
  blocked by the auto-mode permission classifier inside a subagent. It is a no-op when a repo
  already exists, so nothing was lost, but the run reported a failed mandatory hook. Agent
  tip: when dispatching speckit commands to subagents in an existing repo, say this hook can
  be skipped. Alternatively, the git extension could make it conditional.
- 2026-10-17 — `/speckit-constitution` writes its Sync Impact Report as an HTML comment at the
  top of the constitution, to be removed before commit. Agent tip: copy it into the PR body
  first, so the owner still reviews it (the governance section says the owner reviews it).

<!-- Lessons that might help future projects, captured the moment they happen (see the working
     norm above). One line each: date, what happened, and the suggested generalisation. The
     harvest command processes this list and removes entries once sent upstream or rejected. -->

- 2026-10-04 — In Windows PowerShell 5.1, `gh pr create --body @'…'@` fails ("unknown
  arguments") when the body contains double quotes. 5.1 splits native arguments at embedded
  `"`. Generalisation (Windows gotchas / agent tips): write PR bodies to a scratch file and pass
  `--body-file`.
- 2026-10-17 — In Windows PowerShell 5.1, `Get-Content -Raw` followed by
  `[IO.File]::WriteAllText` garbled every em dash and arrow in a UTF-8 file without a BOM. 5.1
  reads BOM-less files as ANSI. Agent tip: edit repo files with the Edit tool. If PowerShell
  must do it, use `Get-Content -Encoding utf8`.
- 2026-10-17 — Cloudflare-fronted APIs (here intervals.icu) return a 403 HTML challenge for
  Python `urllib`'s default `Python-urllib/x.y` User-Agent, while PowerShell's request with the
  same key succeeds. Agent tip: always send a descriptive User-Agent from scripts and ingest
  clients. Read a 403 with an HTML body as a bot block, not an auth failure.
- 2026-10-17 — The owner pointed out that an official sync partner (intervals.icu) removes most
  of the risk of an unofficial client (python-garminconnect), and the agent had kept planning
  around the riskier source. Generalisation (research before choosing dependencies): when a
  provider is reachable through an official partner or aggregator, evaluate that route
  first, and make manual entry the fallback for the few fields it lacks before adopting
  an unofficial client.
- 2026-10-17 — The owner offered secrets in a temp file rather than using the
  hidden-prompt helper. The agent read it while printing only key names and value lengths,
  then set the secrets directly. Generalisation: a secrets helper should also accept a file
  path (shape-checked, never echoed), and the agent reminds the owner to delete the file.
- 2026-10-04 — Piping a here-string into `git commit -F -` from the PowerShell tool succeeds,
  but the subject starts with a UTF-8 BOM (`EF BB BF`), because PowerShell adds one when it
  writes to a native stdin. Strengthen the existing agent tip: never pipe commit messages; use
  `git commit -m @'…'@`. Optionally check with `git log -1 --format=%B | od -c | head -1`.
- 2026-10-17 — The owner overrode "ask for a usage screenshot before big spends". Usage reads
  near zero at the start of a session, so screenshots there are useless, and the owner would
  rather flag low usage themselves. Generalisation: make the canary/usage norm "the owner flags
  low usage", with screenshots optional.
- 2026-10-17 — PLAYBOOK > Upgrading Spec Kit is missing steps. It should say: reinstall the
  `git` extension too, before `house-process`, because install order sets the hook order in
  `extensions.yml`. It should also say to back up and restore `.specify/feature.json` and
  `extensions/git/git-config.yml` alongside the constitution, and to diff `extensions.yml`,
  restoring it if only the order changed.
- 2026-10-17 — Python's jsonschema ignores the OpenAPI-style `discriminator` keyword that ajv
  honours, so a goal with a bad `target.time` reported only "is not a goal type" (the `oneOf`).
  Agent tip: when two validators share schemas, compare their error output on the shared invalid
  fixtures, not just pass/fail. Here the fix was choosing the branch by discriminator in Python.
- 2026-10-17 — jsonschema's error messages quote the offending value (`'2026-10-11T07:15' is not
  valid`), so logging them from a publish stage would put unpublished data in public CI logs.
  Generalisation (privacy checks): validators in a privacy-sensitive pipeline report path and rule
  only.

## Open questions

- The owner has **$100 of cloud session credits that expire 2026-11-05** (noted 2026-10-17).
  Prefer running self-contained slices (spikes, scaffold, review passes) as cloud sessions
  until the credits are used or expire. `remote` subagent isolation fell back to local on
  2026-10-17, so it doesn't spend them.
- intervals.icu's $4/month supporter tier adds nothing the site needs (its extras are Strava
  imports, plan building and UI features), so the owner stays on the free tier for now. At
  go-live (T112) the agent raises it again. The owner intends to become a supporter once the
  live integration works (decided 2026-10-17).
- JustGiving integration details (public API access/terms vs page scraping, what's displayable)
  → research in the fundraising spec.
- VO2 max target value and Brighton training-build start date → owner supplies when goals are
  first entered.
- See `BACKLOG.md` for deferred/future work items.
