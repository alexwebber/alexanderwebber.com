# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`.

## Next session

<!-- Overwritten by the agent at each session boundary (see the "One session per phase" norm).
     A new session reads this first; the owner only needs to type "continue". -->

- **Status (2026-10-24, late):** **Phase 7 (US4 Races and PBs) is live** (#55 merged and
  deployed, all 11 confirmations ticked). The owner reviewed `/running/races/` on phone and
  desktop: all good, and the Brighton card stays without Garmin's prediction (the landing hero
  and goal already show it).
  - **Next: Phase 8 (US5 Health, tasks.md)**, starting with a question round on the health
    metrics before implement.
  - **Race pages, maps and photos** are only on the test preview (`/race-preview/` in a
    `SHELL_PREVIEW=1` build) until Brighton. Real OpenFreeMap tiles are unseen; check them on
    Brighton's page after race day.
  - **Planned order** (owner, 2026-10-24):
    1. ~~Phase 6~~, ~~Phase 7~~, then Phase 8 (US5 Health) and Phase 9 (Polish), each in its own session(s).
    2. **Harvest lessons again** once Phase 9 is done, before starting the next spec
       (fundraising, journey story or CV & Blog).
  - **Check first:** the nightly Quality run is still green (a Cloudflare RUM beacon means RUM
    was re-enabled). Minutes: 995 used by about 19:30 UTC on 2026-10-24; October should end
    around 1,400–1,500 with Phase 8's PR checks.
  - **T105's no-change path** was never seen: every 00:17 refresh so far committed new data.
    That's fine, and the owner has been told; stop looking for it.
  - **Phase 8 touches Astro and charts:** read the matching sections of sdd-playbook's
    `AGENT_TIPS.md` first.
  - **31 Oct:** the 5k's "New" window ends; check the landing page falls back to priority order
    (unit-tested, not yet seen live).
  - **Owner's local files:** reminded once (2026-10-23) that `C:\temp\runs` can go; don't
    repeat. The export zip in Downloads stays as their backup.
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
  intervals.icu key, the `alexanderwebber` workers.dev subdomain, the `gh` `user` scope and
  T004 (nameservers, 2026-10-24). T003 is dropped. The zone's dashboard-only settings are in
  quickstart.md §0.
- **Next step: Phase 8 (US5 Health, tasks.md)** in its own session, starting with a question
  round on health metrics. History is complete from 7 Oct 2025 (T150 and T085 done).
  - **Re-imports, if ever needed:** `refresh.yml` with `reimport_from`/`reimport_to`, one window
    at a time, sized under the 25-minute fetch limit (about 10 runs a minute). A runs-only
    window of 17 days took a few minutes.
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
- **The owner sees the real site** (owner, 2026-10-23). Every PR that changes what visitors see
  has a *How to view it* section: the exact URLs to open once it merges and deploys (workers.dev
  until go-live), what to look at on a phone and on a desktop, and what isn't built yet. After
  the merge, the agent checks that the deploy finished before pointing the owner at it. Each
  phase that ships pages starts its next session with a short guided review of the live site
  and a question round on what the owner saw.
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
  and sampling about 1 in 4 high-value steps happen only if this project opts in. The owner says
  when usage is running low; the agent doesn't ask for usage screenshots. Results, including
  token cost, are logged in `canaries.md`. The judge is never one of the candidate models. Norm
  changes are proposed only once a pattern holds. **Project override (2026-10-04):** this
  project does not opt in. Canaries run only when the owner is unhappy with an output, because
  of plan usage limits. The agent logs each step's token cost anyway.
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
- **2026-10-23** — **Brighton target tightened to sub-3:20** (owner), from sub-3:25. Both places
  changed together: the goal (now `brighton-sub-3-20`, no other file used the old ID) and
  `upcoming-races.yaml` `target_time: "3:20:00"`.

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

- **2026-10-23** — **Phase 4 owner picks** (question round before implement):
  - **Daily rebuild rides the refresh.** T105 drops the separate `rebuild-daily.yml` (two crons,
    gate + deploy, about 8–10 minutes a day). The 00:17 UTC catch-all refresh, which already
    publishes daily, also deploys its gated build when no data changed: about 1–2 minutes a day.
    00:17 UTC is after UK midnight in BST and GMT. Without JS the countdown can lag by up to
    about 1h20 in summer; the client-side countdown corrects it.
  - **Landing goal layout:** one column on phones. Wider, the Brighton goal spans the full width
    as the lead card, and the other six sit in a 2-column grid.
- **2026-10-23** — **Phase 4 (US1 Landing) built** (`001-landing` PR; implement subagent about
  360k tokens). Choices later tasks build on; the owner confirms them in the PR:
  - **Achieved featured goals stay on the landing page** in priority order (celebratory card);
    "newly achieved" adds a tint and a "New" badge for 14 days. `featuredGoals()` no longer drops
    achieved goals.
  - **Compact landing goal cards:** what's left ("3:00 to go"), now vs target, the Garmin
    prediction, the bar and the deadline. The progress sentence is screen-reader text only. The
    Goals page cards are unchanged.
  - **Training build chart** starts at the first published run when data starts after
    `build_start`, with a note, rather than drawing zero weeks (until T150's history import).
  - **Latest-run card** shows the longest run of a multi-run day (runs have no start time), with
    "One of N runs that day".
  - **Run pages** (`/running/runs/<id>/`, shared `/og/running-run.png`) sit in the landing area of
    the route registry until US3's Training area takes them. Registry areas gained optional
    `description` and `inNav`.
  - **After race day** the hero drops the Garmin prediction and shows the official time, else the
    linked run's elapsed time.
  - **T105:** the refresh's `decide` step outputs `daily=true` in UTC hour 00, and `deploy` also
    runs when that run's commit was skipped. No new jobs.
  - **T106 warning** ignores retired and hand-achieved goals.
  - **Inline spacing:** Astro strips line-break whitespace between inline elements, so explicit
    `{' '}` spaces were added (also fixing "17 Oct 2026New" on the Goals page).
- **2026-10-23** — **First look at the live site** (owner feedback, after #38):
  - **Garmin's predictions are for today**, not forecasts for race day. They now read
    "Garmin: 3:25:18 if raced today (23 Oct 2026)" in the hero and goal cards (owner's pick of
    three wordings); the full goal card's label is "Garmin race predictor".
  - **Efforts inside a longer run are labelled** "(in a longer run)" when the run is more than 5%
    longer than the effort's distance (`Effort.inLongerRun`). The owner's 46:00 10k came from a
    10.74 km tempo run, and they've never attempted a fast 10k. 5% clears normal GPS overrun on a
    real attempt (1–3%).
  - **History backfilled now, not after T150.** The half showed 1:47:21 because the site only
    held runs from 3 Oct 2026; the owner's best is 1:43:52 (5 Apr 2026). Two `refresh.yml`
    re-imports (2025-10-01 to 2026-04-30, then 2026-05-01 to 2026-10-02) pull everything
    intervals.icu holds. The Garmin export's older history still follows at T150.
  - **Body fat uses its 7-day average throughout** (owner pick; this replaces Phase 3's "body
    fat's headline is the latest reading"). The card said "8.7% to go" (from the 26.2% average)
    next to "Now 26.0%" (that day's reading). "Now" is now the same average, labelled
    "(7-day average)" like weight, so every figure on a card agrees.
  - **History backfilled:** both re-imports succeeded (19 min of fetch for Oct 2025 to Apr 2026),
    so the site has **197 runs** back to October 2025, and the training build fills from 5 Sep.
  - **Best efforts use timer time** (owner pick; replaces the plan's elapsed-time rule). The April
    half read 1:46:02 because two watch pauses (71 s and 70 s) counted; the owner's figure was
    1:43:52, and intervals.icu's `icu_recording_time` for it is 6,231 s (1:43:51). A watch pause
    shows in the time stream as a jump with almost no distance, so `track()` leaves out any gap
    over 1 s covering under 0.5 m/s. A throwaway check on all 197 runs found these jumps match
    the paused time to within 5 s in 168 runs. A stop with the watch running still counts, and
    races keep their official times. `PROCESSOR_VERSION` 3 makes the next refresh reprocess
    everything.
- **2026-10-23** — **No full Garmin history import; audit the last year instead** (owner
  decision, after asking whether the import was safe). The full import would add no PBs (none
  before 2025) and no goal data (goals ignore data before `created`, 2025-10-01), and the owner's
  fitness only started in October 2025. It isn't risk-free either: intervals.icu's FAQ lists
  re-imports as a cause of duplicate activities, a bulk import is hard to undo in the account,
  and the backfill would cost a few hundred Actions minutes.
  - **History starts at what intervals.icu holds** (from 2025-10-18). Wellness history stays as
    it is.
  - **The export is audited** (T150 rewritten): its activity list is compared with the published
    runs from 2025-10-01, and missing runs are uploaded as FIT files (the 17 Oct route). The zip
    stays outside the repo as the owner's backup.
  - **No older races** to enter by hand (owner).
  - Spec (History assumption, SC-009) and tasks (T150, T085) amended.
  - **Audit result** (export of 468 activities, 2016-02-15 to 2026-10-23; 199 runs since
    2025-10-01): **nothing is missing from 2025-10-18 on**. 195 runs match by date and distance
    (within 3%). The 4 misses are treadmill runs on 7, 9, 12 and 14 Oct 2025, before
    intervals.icu's history starts; their FIT files were found in the export by start time,
    and the owner uploads them (device override Venu 2 Plus, as that month's runs show).
  - **Junior parkruns hidden:** the two published runs with no matching export run (8 and
    15 Mar 2026, about 2 km, Sundays just after 9am) are junior parkruns with the owner's son.
    Garmin logged them as "Other", and intervals.icu typed them as runs. Owner: ignore them, so
    `run-overrides.yaml` hides them.
- **2026-10-23** — **Phase 5 guided site review** (owner, on phone and desktop). Every figure
  agreed with Garmin Connect. Answers, built in the `001-review-fixes` PR:
  - **Seven landing goals stay** (SC-001 is fine).
  - **Newly achieved goals lead.** For their 14-day "New" window they come first on the
    landing page (full width, above Brighton), with a larger medal and title and the achieving
    figure in large type, and in a "Just achieved" section at the top of the Goals page. Then
    they drop back to their priority place. On wider screens a lone last card spans its row.
  - **Start values:** progress for weight and body fat runs from the start of the current
    journey, 2 Jun 2025 (127.6 kg, 33.7%), dated on the card. New goal fields `start_date`
    (needs `start_value`) and `all_time_start` (a reference only, shown as "32.1 kg down since
    31 Jan 2023 (133.2 kg)"). The owner remembered about 128 kg and 34% in Jun 2025 and 133.2 kg
    in Feb 2023; the Garmin export's weigh-ins gave the exact values and dates. No 2023 body
    fat was estimated (Principle VIII). VO2 max's start (37, Oct 2025) was confirmed. `created`
    stays 2025-10-01, so only data from then counts toward achievement.
  - **Race targets read "sub-3:20"** (runners' shorthand, and it matches the hero), not
    3:19:59. Achievement is unchanged: any time under 3:20:00. Gaps still run to the target
    line ("3:43 to go", "3:43 off sub-1:40").
  - **Prediction wording:** "Garmin predicts 3:25:18 at current fitness (23 Oct 2026)",
    replacing "if raced today", which still read as unclear.
  - **CI:** the Playwright job's `--with-deps` apt install stalled in the font packages on
    PR #44 (10 minutes) and again on #45, where apt timeouts didn't help. The job now installs
    Chromium without `--with-deps` (the runner image's Chrome brings the libraries), with a
    5-minute step limit.

- **2026-10-23** — **T110 graduation review done** (`001-graduation-review` PR). Choices later
  work builds on:
  - **Unreached targets cap at 99%.** An unreached goal's progress fraction stops at 0.99
    (`UNREACHED_MAX`), so the bar, its `aria-valuenow` and the words never say 100% early
    (93.1 kg from 127.6 kg is 99.7%). A race time that rounds to the target (42:59.6 against
    sub-43:00) doesn't count, and reads "Under a second to go", not "Beaten by 0:00".
  - **Pins:** Astro 7.4.2 raises its Node floor to 22.23.4 for the October 2026 Node security
    releases, so `engines` follows. Every `setup-node` step now has `check-latest: true`: with
    `.nvmrc` at `22`, setup-node took the runner's cached 22.23.3, so PR #46's first CI run
    failed (the refresh's publish would have too). Also `@astrojs/check` 0.9.12 (still TypeScript `^5 || ^6`, so
    the 6.0.3 pin stays), wrangler 4.152.0, maplibre-gl 6.15.0 and satori 0.63.2 (still the
    same `fflate`, so the accepted advisory is unchanged).
  - **Lighthouse budget runs locally** on Windows now (bins run with `node`, not `npx`).
  - **Playwright needs `SHELL_PREVIEW=1`** in the build it tests, as `tests.yml` does; a
    deploy build fails the 28 shell-preview cases.
- **2026-10-24** — **The Lighthouse budget judges a miss on the median of three runs**
  (`001-landing-perf` PR). After #46, the PR check's landing page scored 87, 77 and 84, all of it
  total blocking time, with no script files on the page. The same build scored 100 locally (even
  on Node 22.23.4 and at 12x CPU slowdown) and against production on the same runner. The build
  output was byte-identical under Astro 7.4.0 and 7.4.2, and the runner image wasn't the cause.
  A page under budget is now measured twice more (median decides), and failures name the
  metrics behind them. The real cost was the landing page's `Countdown` script: it set up `Intl`
  with a time zone and rewrote the day count on every load, forcing a relayout after first paint
  (about half the page's blocking time at 16x CPU slowdown). It now does nothing while the
  visitor's clock is inside the build's own UK day (`data-day-from`/`data-day-to`, from the new
  shared `londonMidnight()`), so it only works in the hour or so after UK midnight before the
  daily deploy, or on an old build. On the 2-core runner the page sat near the 90 line, so it
  failed after #46 on noise alone.
- **2026-10-24** — **Go-live set-up** (T004 done, T112 built in the `001-go-live` PR):
  - **Nameservers:** the domain is a Cloudflare zone (Free plan) and stays registered at
    Namecheap (Cloudflare's "Transfer a domain" isn't wanted). It had no records, no email and no
    DNSSEC, so nothing was carried over.
  - **AI crawlers allowed** (owner pick): search, agent and training bots are all "Allow", with
    Bot Preference Sync on. Everything on the site is public by design, and being known to AI
    models can help the CV and blog be found. It can be changed any time in the zone.
  - **`www` → apex** is the zone's "Redirect from WWW to root" template rule (301, query string
    kept), set in the dashboard. Cloudflare's docs recommend a redirect rule, because a Worker
    custom domain only answers on its exact hostname. `www` is also a custom domain, so it still serves the site if the rule is
    ever lost. *Always Use HTTPS* is on. These dashboard-only settings are listed in
    quickstart.md §0.
  - **workers.dev stays up** as a fallback address. Every page's canonical URL is the domain, so
    it isn't indexed as a second copy.
  - **Garmin brand PDF read in full** (it downloads fine locally): still V 6.30.2025 and one page.
    It matches the excerpts the attribution was built from, and the live pages follow it.
- **2026-10-24** — **Live on alexanderwebber.com** (#48 merged). The existing token attached
  both custom domains (no DNS permission needed). Live checks passed: apex 200, `www` 301 to the
  apex with the query string, `http://` to HTTPS, freshness endpoint, Garmin attribution. The
  owner's screen-reader and share-preview checks (T111) were fine.
  - **intervals.icu supporter:** the owner subscribed, **£9 every 3 months** (about £36 a year),
    now in plan.md *Recurring costs*. It's support for the service; the site doesn't depend on
    supporter features.
  - **Phase 5 is complete** (T110–T112): the Running MVP (goals and landing) has graduated and
    is live.
- **2026-10-24** — **Harvested about 60 lessons upstream** (2026-10-04 to go-live), merged into
  50: [sdd-playbook#11](https://github.com/alexwebber/sdd-playbook/pull/11) (house-process
  0.9.0). Owner picks:
  - **Split by when they're needed.** Process lessons go in `PLAYBOOK.md`: session-health
    checks, one session per checkout, the fuller Spec Kit upgrade steps, Windows gotchas, and
    nine project lessons. Technical tips (shell, secrets, Actions, pipelines, Astro, Cloudflare,
    UI) go in a new `AGENT_TIPS.md`. `CLAUDE.md` here and in the template points at it before
    CI, framework or hosting work, so it isn't loaded every session.
  - **"Show me the real thing"** (How to view it, guided review of the live site) went to the
    owner's global `~/.claude/CLAUDE.md`.
  - **The usage-screenshot rule** is dropped from the template's canary norm.
  - **A Spec Kit upgrade script** waits in the playbook's backlog, to be built at the next
    real release.
  - **Not sent:** Garmin export FIT matching (already in the audit decision), ruff PLE1205
    (niche), and the cloud image's Playwright Chromium mismatch.
- **2026-10-24** — **No visitor analytics script** (owner pick). The first nightly Quality run
  against the domain failed every page on "third-party requests: static.cloudflareinsights.com"
  (scores 98–100). Cloudflare had switched on Real User Monitoring by default for the new Free
  zone, excluding EU/UK visitors, so a US runner always got the beacon, while UK fetches and
  workers.dev never did (shown with a throwaway branch workflow). Nothing in the dashboard
  showed it as on. The owner turned it off (*Speed → Observatory*), keeping the plan's
  zero-third-party rule. Cloudflare's server-side zone analytics (requests, visits) need no
  script and stay. Recorded in quickstart.md §0.
- **2026-10-24** — **Phase 6 owner picks** (question round before implement; tasks.md amended):
  - **Garmin's own HR zones, with bpm ranges.** intervals.icu's 7 zones (its own LTHR model)
    disagree with Garmin Connect: on the 23 Oct 10k, intervals.icu put most time in Z2 and Garmin
    in Z3–Z4. Garmin's original FIT (`/activity/{id}/file`, not the generated `/fit-file` we
    archived) carries `time_in_zone` with that day's boundaries (% of max HR; max 172–180 over the
    year), present on all 199 runs since Oct 2025. New part `original.fit`, parsed with
    `garmin-fit-sdk` 21.218.0 (Garmin's SDK, current; `fitparse` 1.2.0 is stale since 2020 and
    can't decode message 216; `fitdecode` 0.11.0 is maintained but unofficial). A one-off
    re-fetch of originals after merge costs about 20–30 Actions minutes. No fallback to
    intervals.icu's zones (T159).
  - **Run charts:** distance on the axis, with a no-JS switch to elapsed time.
  - **Best efforts in each run** are shown on its page (an approved addition to FR-047; T160).
  - **Training hub** opens on weekly totals for the last 26 weeks.

- **2026-10-24** — **Phase 6 (US3 Training and run detail) built** (`001-training` branch;
  implement subagent). Choices later tasks build on; the owner confirms them in the PR:
  - **Garmin's own HR zones (T159).** Fetch archives the watch's original upload
    (`/activity/{id}/file`) as `original.fit` (gzip or one-file zip unwrapped; a non-FIT original
    counts as absent). The normaliser reads the session `time_in_zone` message with
    `garmin-fit-sdk` 21.218.0: zone *k* spans boundary *k-1* to *k*, time below zone 1 is left out
    (Garmin Connect's chart starts at zone 1) and time above the top boundary counts in zone 5.
    No original or no message means no zones; intervals.icu's zone times are never used.
    Decoding costs about 0.2 s a run, so a full reprocess of 200 runs adds about 40 s.
    `PROCESSOR_VERSION` 4.
  - **Bundle layouts.** `fetch.json` now records the adapter's bundle layout (2 = with
    `original.fit`). A refresh tops up unchanged bundles in its window with just the new parts,
    and `fetch --missing-only` (refresh.yml input `missing_only`, with `reimport_from`) does it
    over any window with one call per run, instead of a full re-import.
  - **Schema transition.** `hr_zones` is now `{zone, name, low_bpm, high_bpm, seconds}` (five
    entries). The schema keeps the old `{zone, seconds}` shape as a deprecated branch, because
    `main`'s published runs use it until the first refresh after merge republishes them; remove
    the branch once no published run has it.
  - **Training hub** opens on the last 26 weeks (weeks start at the first run when history is
    shorter); months and years cover all history; distance and moving time are both charted.
    The list shows the latest year's runs; "Races only" lists races from every year. Year pages
    hold each year's runs.
  - **Run page:** summary, then charts (pace, HR, elevation, cadence, power) against distance
    with a CSS-only switch to elapsed time, zones, splits, best efforts (plausible only), dynamics.
    Pace, cadence and power charts draw the 2nd–98th percentile range, so stops don't flatten
    them; tables give per-km (or per-5-minute) means. Cadence reads "spm", never "steps" (the
    privacy scan treats "<n> steps" on a page as a step count).
  - **Shared plumbing:** `Toggle.astro` (a positional CSS-only switch for up to four views) and
    `XYChart.astro` (a numeric x axis), both in `src/shared/charts/`.
  - **Scale (T124):** 5,000 synthetic runs build in 48 s to 5,032 files; every page scores 100.

- **2026-10-24** — **Zone names aren't published** (`001-zone-names` PR). After #52 merged,
  the first publish with Garmin zones failed the gate: `scan-privacy` rejects any `name` key in
  a published run (reserved for provider titles), and each zone carried `name: "Warm Up"`. The
  gate held, so nothing bad deployed. Published zones are now `{zone, low_bpm, high_bpm,
  seconds}`, the site names zones from their number, and `PROCESSOR_VERSION` is 5. The backfill
  (`reimport_from=2025-10-01`, `missing_only`) hit the 25-minute fetch limit after topping up
  about 151 runs; a second run tops up the rest (finished ones are skipped).
- **2026-10-24** — **Phase 6 post-merge checks:** the cleanup PR (#54) merged and deployed, and
  all 199 published runs carry Garmin's zones. The owner had nothing more on the Training pages.
- **2026-10-24** — **Phase 7 owner picks** (question round before implement; tasks.md amended):
  - **No races yet.** T157's scan of 201 raw runs found three plausible candidates (a half on
    5 Apr 2026, the 17 Oct track 5k, a 5k on 27 Feb 2026), and the owner rejected all three.
    With no older races either (2026-10-23), Brighton is the first race. T134, T157 and T135 are
    done with nothing to write.
  - **Solo time trials aren't races:** they count in the PB table and goals as efforts, with no
    race page or map.
  - **PB table:** 5k, 10k, half and marathon.
  - **Races page:** Brighton countdown, then PBs, then "No races yet: Brighton Marathon on
    4 Apr 2027 will be the first." "Races" joins the Running menu now.
  - **All of Phase 7 is built now** (race pages, maps, photos) on synthetic races, so Brighton's
    page works on the day.

- **2026-10-24** — **Phase 7 (US4 Races and PBs) built** (`001-races` branch; implement
  subagent about 457k tokens). There are no real races yet, so live only `/running/races/` shows anything. Choices
  later tasks build on; the owner confirms them in the PR:
  - **Race tracks (T125)** are written only for a race that isn't a treadmill or indoor run and
    whose `race.yaml` doesn't hide its map. Douglas–Peucker runs in local metres until the track
    fits 1,000 points. Points keep the race's own distances after `trim_ends_m`. Hiding or
    dropping a run, `hide_map`, or un-designating it removes the track. **`PROCESSOR_VERSION`
    stays 5**: no published run is a race, so no existing output changes, and a future
    designation changes that run's owner hash, which reprocesses it.
  - **Photos live beside `race.yaml`**, not in a `photos/` folder as T127 said, because the
    Phase 2 schema, loader, validator and research R7 already put them there.
    `scripts/add-race-photo.ts` strips all metadata, applies the orientation and caps the long
    edge at 2,400 px. The gallery makes AVIF, WebP and JPEG at 640 and 1280 px (6 files a photo).
  - **Race history** uses the published `is_race`. A `race.yaml` joins a run only by `run_id`;
    one whose run isn't published (yet) shows nothing. A race without an official time shows the
    run's elapsed time, labelled "(watch time)", as the landing hero does.
  - **PB table**: 5k, 10k, half and marathon always, plus any other named distance once raced
    (FR-053). The race column takes official times first; the any-run column reuses the goals'
    Best Effort index (same eligibility, timer time, "(in a longer run)"), shows only an effort
    faster to the second, and leaves out a race run's own stretch at its race distance. A race
    run with no `race.yaml` counts at the named distance within 5% of its length. "New" marks a
    best set within `recent_highlight_days.pb` (14). An empty row reads "Not run yet: <next race
    over the distance> on <date> will be the first."
  - **Live today** the PB table shows 5k 19:44 (New, 17 Oct), 10k 46:00 (in a longer run), half
    1:43:43 (timer time, as the goals page shows) and the marathon row pointing at Brighton.
  - **Race map (T131)**: a build-time SVG with S/F and km labels (every 1, 2 or 5 km), the page
    holding projected figures only. Coordinates go to `/running/races/<slug>/route.json`, fetched
    on click with maplibre-gl and OpenFreeMap's `liberty` style; the button appears only with JS.
    The course profile is left out when the run detail already charts elevation (the same chart).
  - **Race pages** show the result (official time with the watch's beside it), the map, the full
    US3 run detail and the photos. Share images: `/og/running-races.png` and one per race
    (`/og/running-races-<slug>.png`, Garmin attribution only for a watch time).
  - **Links**: "Races" joins the section nav; run lists' "Race" badge and run pages' "Race"
    label link to the race page.
  - **Race preview (tests only)**: `SHELL_PREVIEW=1` adds `/race-preview/`, rendering the real
    `RacesPage`/`RacePage` over synthetic races in `tests/fixtures/race-preview/` (routes in open
    sea, generated photos, made-up names and times, `generate.ts`). `JsonFileStore` and
    `validateData` gained an optional schema root so the fixture tree validates against the
    repo's schemas.
  - **Fixed on the way**: `run-detail.spec.ts` still expected published zone names after #53, so
    it failed on `main` too.
  - **Tests**: pytest 416 passed (1 skipped), Vitest 489, Playwright 177 passed (1 skipped,
    both projects), ruff and `astro check` clean. The full gate (validate-data, scan-images,
    check-boundaries, build, scan-privacy) passed with a synthetic race, track and photos
    temporarily in the real data tree, then removed. Lighthouse (mobile, local): every page type
    100, including a race page with a map (1.6 KB gzip JS, 27.2 KB total, no third-party
    requests).

- **2026-10-24** — **Phase 8 owner picks** (question round before implement; tasks.md amended):
  - **Body first:** weight and body fat lead the Health page, then VO2 max, predictions and
    training status, then fitness/fatigue/form, resting HR and HRV.
  - **Fitness starts 42 days in** (18 Nov 2025), with a note. intervals.icu's history starts on
    7 Oct 2025, so fitness (a 42-day average) climbs from 0 at first, an artefact of where the
    data starts.
  - **Weight header:** the 2025 journey start leads ("26.5 kg down since 2 Jun 2025"), and the
    2023 heaviest weigh-in follows as a quieter line, as on the Goals page card (owner: 2025 is
    the effective start of this push).
  - **Daily metrics** (body fat, resting HR, HRV) are faint dots under a 7-day average line;
    "now" is the 7-day average. Weight stays the average only.
  - **Race predictions sit beside their goals**; their trend appears at two entries.
  - **Charts open on 1 year.**
  - **HRV note** names the watches: HRV starts on 1 Dec 2025, the day the Venu X1 replaced the
    Venu 2 Plus (seen in the runs' `device`).

## Upstream candidates

- 2026-10-24 — maplibre-gl 6 loads its worker from `./maplibre-gl-worker.mjs` beside its own
  module, which a bundler moves. Import the worker and stylesheet with Vite's `?url`, call
  `setWorkerUrl()`, and lazy-import the library on click; the page then loads only a ~1.6 KB
  gzip loader. Agent tip (Astro, maps).
- 2026-10-24 — sharp's file cache keeps images open on Windows, so a Vitest temp folder couldn't
  be deleted (EPERM). Call `sharp.cache(false)` in tests that write images to temp folders.
  Agent tip (Windows).
- 2026-10-24 — A test-only preview route over synthetic fixture data, rendering the same page
  components as the real pages, let race pages, maps and photos be built and tested end to end
  before any real race existed, without putting invented data in the real tree (Principle
  VIII). Playbook lesson (testing features whose data doesn't exist yet).
- 2026-10-24 — The agent's Bash tool turned `\\n` in a quoted heredoc into `\n`, so Python
  string edits written in it got real newlines and broke a test file. Use the Edit tool for
  edits whose text holds backslashes. Agent tip (shell).

- 2026-10-24 — A new published field passed every local check, but its first real publish
  failed the gate's privacy scan (a `name` key). Locally, the published data still had the old
  shape, so the scan never saw the new field. Agent tip (pipelines): when a change adds fields to
  published data, put a sample of the new shape into a real data file temporarily and run the
  full gate (validate, build, scan-privacy) before the PR.

- 2026-10-24 — intervals.icu's `/activity/{id}/fit-file` is a FIT file intervals.icu generates,
  not Garmin's original, and it drops Garmin-only messages such as `time_in_zone` (216). Use
  `/activity/{id}/file` for the original. Agent tip (intervals.icu): archive the original, and
  check which endpoint a "FIT" download really is before relying on device-specific messages.
- 2026-10-24 — The common `.visually-hidden:not(:focus):not(:active)` rule (meant for skip
  links) reveals a hidden radio when its label is clicked, since the radio takes focus. A
  native radio popped into CSS-only toggles and shifted the options. Locally it went unnoticed
  (the subagent ran only one Playwright project). On CI's 360 px project with different fonts,
  the shift moved the next option from under the pointer ("fieldset intercepts pointer events",
  about 165 retries). Agent tips (UI, testing): always hide `input.visually-hidden`, even when
  focused; run every Playwright project locally before a PR; when a CI click retries on
  "intercepts pointer events", look for a layout shift, not slowness.
- 2026-10-24 — `fitparse` (last release 2020) reads message 216 as `unknown_216` with no fields;
  Garmin's own `garmin-fit-sdk` decodes it. Agent tip (FIT files): use Garmin's SDK for newer
  messages.

- 2026-10-24 — Cloudflare switched on Real User Monitoring by default for a new Free zone,
  excluding EU/UK visitors, so it injected a third-party beacon (`static.cloudflareinsights.com`)
  into pages served to everyone else. Fetches from the UK and the workers.dev address never
  showed it, the account's Web Analytics page said "Get started", and the Observatory opened
  with a welcome offering to *enable* RUM. Only a production Lighthouse run from a US runner
  caught it, and a throwaway branch workflow curling from there confirmed it. Agent tip
  (Cloudflare, go-live): after attaching a domain, check the live HTML from outside Europe
  (a branch workflow) for injected scripts, and turn RUM off explicitly in *Speed →
  Observatory* if the site promises no third-party requests. Run production budget checks from
  a non-EU location.

- 2026-10-24 — When an ingest adapter adds a raw part, version the bundle layout in each item's
  fetch marker and let the fetch stage top up older items with just the new parts. A full
  re-import of history would have re-fetched five parts per run; the top-up is one call per run
  (about 7 minutes for 200 runs instead of an hour of Actions minutes). Agent tip (pipelines).
- 2026-10-24 — Git Bash: with `MSYS_NO_PATHCONV=1` (needed to pass `/running/...` URL paths to
  node), a `/c/Users/...` argument reaches node unconverted and resolves to `C:\c\Users\...`,
  so a script wrote its output into a stray `C:\c\` tree. Pass Windows-style `C:/...` paths
  whenever path conversion is off. Agent tip (Windows).

## Open questions

- The owner has **$100 of cloud session credits that expire 2026-11-05** (noted 2026-10-17).
  Prefer running self-contained slices (spikes, scaffold, review passes) as cloud sessions
  until the credits are used or expire. `remote` subagent isolation fell back to local on
  2026-10-17, so it doesn't spend them.
- JustGiving integration details (public API access/terms vs page scraping, what's displayable)
  → research in the fundraising spec.
- VO2 max target value and Brighton training-build start date → owner supplies when goals are
  first entered.
- See `BACKLOG.md` for deferred/future work items.
