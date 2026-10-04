# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`.

## Next session

<!-- Overwritten by the agent at each session boundary (see the "One session per phase" norm).
     A new session reads this first; the owner only needs to type "continue". -->

- **Status (2026-10-04):** Lessons harvested. All 9 candidates went upstream in
  [sdd-playbook#10](https://github.com/alexwebber/sdd-playbook/pull/10) (house-process 0.8.0),
  plus one line in the owner's global `CLAUDE.md`. This repo's chore PR (branch
  `chore/git-extension`) installs Spec Kit's core `git` extension and records the harvest.
- **Waiting on the owner:**
  - Review and merge sdd-playbook#10 and the `chore/git-extension` PR.
  - Owner prerequisites T001–T004 (Cloudflare account, R2 bucket and tokens, Garmin secrets,
    nameservers). The agent walks the owner through each one at the start of implementation.
- **Next step:** once sdd-playbook#10 has merged, reinstall house-process 0.8.0 here as a quick
  chore PR. Pull the playbook's `main` first. Copy the changed template norms into *Working
  norms* by hand: PR checkbox confirmations, the interactive-commands exception, the canary
  wording. Keep this project's canary override. If #10 hasn't merged, skip straight to the
  slice.
- **Then:** implement slice 1 = Phase 1 (owner prerequisites, Spike 0, Spike 1, scaffold). **Ask
  the owner for a usage screenshot first.** Spike 0's 48-hour schedule needs the spike workflow
  merged to `main` first (T009). Run Phase 2 scaffolding during the 48-hour wait.

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
  are proposed only once a pattern holds. **Project override (2026-10-04):** canaries run only
  when the owner is unhappy with an output, because of plan usage limits. The agent logs each
  step's token cost anyway, never uses a candidate's model as judge, and asks the owner for a
  usage screenshot at checkpoints before big spends (e.g. before `/speckit-implement`).
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

## Upstream candidates

<!-- Lessons that might help future projects, captured the moment they happen (see the working
     norm above). One line each: date, what happened, and the suggested generalisation. The
     harvest command processes this list and removes entries once sent upstream or rejected. -->

- 2026-10-04 — In Windows PowerShell 5.1, `gh pr create --body @'…'@` fails ("unknown
  arguments") when the body contains double quotes. 5.1 splits native arguments at embedded
  `"`. Generalisation (Windows gotchas / agent tips): write PR bodies to a scratch file and pass
  `--body-file`.

## Open questions

- Can python-garminconnect work from GitHub Actions' datacenter IPs? → **Spike 0** of the Running
  plan, with pass criteria. Evidence on 2026-10-04: issue #444 (403s from datacenter networks;
  `curl_cffi` workaround). Fallback: fetch via Task Scheduler on the owner's PC.
- JustGiving integration details (public API access/terms vs page scraping, what's displayable)
  → research in the fundraising spec.
- VO2 max target value and Brighton training-build start date → owner supplies when goals are
  first entered.
- See `BACKLOG.md` for deferred/future work items.
