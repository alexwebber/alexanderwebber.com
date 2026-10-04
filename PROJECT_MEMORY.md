# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`.

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
- **Pull requests, not direct commits to `main`.** All changes go on a branch and are raised as
  a PR for the owner to review and merge. Coding agents don't push to `main` or merge their own
  PRs unless explicitly asked.
- **Draw requirements out with questions.** For specs, clarifications and design decisions, the
  agent asks focused rounds of questions with recommended options rather than expecting the
  owner to supply everything up front.
- **Run spec-kit commands as real subagents.** `/speckit-*` commands are dispatched via the
  Agent tool to a subagent that follows the actual `.claude/skills/speckit-*/SKILL.md`, not
  simulated inline by the main conversation. Subagents can't converse with the owner, so the
  main conversation runs the question rounds first and passes the gathered answers in.
- **Model selection, evolved by canaries.** Starting assumption: routine work (spikes,
  implementation, well-scoped specify/tasks/implement runs) stays on the session's default
  model. Architecturally consequential steps (e.g. `/speckit-specify` or `/speckit-plan` on
  foundational pieces) get a per-call Opus override, flagged each time. The agent tests and
  evolves this itself via `speckit.house-process.model-canary`: it reruns a step on another
  model when the owner is unhappy with an output, tries new models once per step type, and
  samples about 1 in 4 high-value steps. Results are logged in `canaries.md`, and norm changes
  are proposed only once a pattern holds.
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

## Upstream candidates

<!-- Lessons that might help future projects, captured the moment they happen (see the working
     norm above). One line each: date, what happened, and the suggested generalisation. The
     harvest command processes this list and removes entries once sent upstream or rejected. -->

- 2026-10-04 — Spec Kit 1.1.0 without the git extension has no `before_specify` branch hook, so
  `/speckit-specify` creates the spec dir but no branch. Generalisation: the orchestrator creates
  the feature branch (`NNN-short-name`) before dispatching the specify subagent.

## Open questions

- Can python-garminconnect log in from GitHub Actions' datacenter IPs (Cloudflare blocking is a
  known open issue)? → first spike of the Running plan; fallback is a scheduled sync on the
  owner's PC. Also: how rotated refresh tokens get persisted between unattended runs.
- JustGiving integration details (public API access/terms vs page scraping, what's displayable)
  → research in the fundraising spec.
- VO2 max target value and Brighton training-build start date → owner supplies when goals are
  first entered.
- See `BACKLOG.md` for deferred/future work items.
