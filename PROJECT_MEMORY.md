# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`. **Decisions and their reasons are in [`DECISIONS.md`](DECISIONS.md)**,
read on demand (search it for the topic at hand); this file keeps what's next and how we work.

## Next session

- **Status (2026-11-07):** Running (001), Fundraising (002) and the journey story (003) are live, and
  003's launch is done: live checks (T087), guided review (T088), reader test skipped (T089). The
  review's desktop changes are live (#134 to #137): on a wide screen the chapter list sits beside the
  text, 18 px from 1200 px, the usual frame. The first nightly Quality run with the story passed every
  page type. House-process 0.17.0 is installed (2026-11-25). Open: 003's standing follow-ups (T090–T092, below).
- **Spec 004, the interactive CV (2026-11-27):** planned and tasked (`specs/004-interactive-cv/tasks.md`,
  119 tasks in seven slices, each its own PR). Slice 1, files and checks (T001–T038), is merged (#163).
  **Slice 2, the page and the phone form (T039–T068), is in its PR**: the whole CV over made-up previews
  at `/cv-preview/<state>/` as the phone drill (themes, a theme's changes, a card; roles, threads and next
  as lists; hash routing and the trail), readable without scripts, in the visual CV's palette and fonts;
  nothing a visitor sees changes (`DECISIONS.md`, 2026-11-27). Its PR asks the owner to confirm Q4, the
  email (T067): if he changes it, make the change on that branch before it merges, as T067 says.
  **Next: slice 3, the landscape form (T069–T084, with the show-and-confirm steps T082 and T083)**, with
  `/speckit-implement` in a session opened from HQ's *career* stream, once slice 2's PR is merged. Build
  the Chart skill first (`process/skill-candidates.yaml`, now 9 times: slice 2's strips and axis rows are
  its newest precedents), and put the palette's values in the brief rather than naming a private source.
  Slices 4 to 6 follow, one session each. Four picks the
  owner made before he could see them are confirmed by eye in the slice that first shows them (T067,
  T082, T083, T095). Real CV text comes in only in slice 7, after the owner's sharing rules are
  re-checked (FR-023); until then, made-up text in `/cv-preview/<state>/` from
  `tests/fixtures/cv-export/<state>/`. Use counts (US6) are built outside this repo. The CV's paper forms
  are done in the private career repo; nothing comes here before the owner approves that exact text.
- **Parallel workstreams (owner, 2026-11-14):** several workstreams run side by side, coordinated
  from the private repo `alexwebber/hq` (`C:\Projects\hq`, set up 2026-11-14), not this site. This
  repo is one stream among several (HQ's *maintenance* and, later, the CV page and blog). A session
  on any other stream opens in `C:\Projects\hq`.
- **Elevation corrected from repeat passes (2026-11-20, this PR):** the altimeter's drift is fitted
  from the places a run passes more than once, with the 2026-11-19 gain-and-loss levelling as the
  fallback (`DECISIONS.md`). `PROCESSOR_VERSION` 7 republishes every run only when Refresh fetches
  something new or at its 00:17 UTC daily run: after the merge, dispatch Refresh with
  `reimport_from=<today>` and `missing_only=true`, then check a few run pages' charts and notes
  live. To be re-evaluated once it has been live for a while (owner).
- **Body fat joined across the scale's reset (#157, live 2026-11-25):** `health-steps.yaml`
  (FR-062a) shifts readings from 6 Nov 2026 by 8.5 points; the goal stays paused until a DEXA at
  about 93 kg (`DECISIONS.md`). Checked live: the joined chart at 25.7%, its note, the goal card's
  pause, and the first new reading (25 Nov) joined at 25.7%.
- **SC-002 measured (T149, 2026-11-25):** all 19 runs synced since go-live appeared on the site
  within 3 h (100%; slowest 2.0 h, median 1.1 h), measured from intervals.icu's `created` in each
  raw `detail.json` to the end of the Refresh run that first published it (`DECISIONS.md`).
- **`/pr-ready` runs only the touched files' tests by default (2026-11-25):** the PR's checks run
  the full suites; `--suites` is for what CI can't cover (the skill says when).
- **Next session (here):** work in this repo comes from HQ's *maintenance* stream: the recurring
  site-upkeep task, designed after HQ's cloud-sessions review. astro 7.4.13 and maplibre-gl 6.19.0
  are routine bumps with no security alert: skipped. Sessions open in `C:\Projects\hq`. Nothing
  from the career repo comes into this repo before the owner approves that exact text.
- **The Martlets story is live** (2026-11-10, #141) on the site and JustGiving. When the CV & Blog
  work specifies its drafting eval suite, its first example is this story, anonymised (owner, #141;
  the draft is in `C:\temp\story-draft.md`).
- **At reviews** (fold in, never as chores):
  - Offer a fresh Garmin training-status and predictions reading.
  - 002 T118 (to about 1 Dec 2026): note donation times the owner mentions, to compare with the
    bot's commit times.
  - 002 T119: check the site's figures match JustGiving's; the tally is **2 of 10**.
- **The journey story (003):**
  - **Private files:** answers and every approval `C:\temp\journey-answers.md` (its privacy rules at
    the end of each round), the read-through `C:\temp\journey-story-review.md`, the wording drafts
    `C:\temp\journey-wording-draft.md`. Words the owner cut stay out of the repo for good.
  - **Standing follow-ups after launch** (event-triggered; T090, a new chapter after Brighton, is in
    `process/triggers.yaml`): **T091**, whenever the owner wants photos in a chapter, check each
    against FR-062 with them, `npm run add-chapter-photo`, and a fresh approval. (T092 is done: the
    Martlets story extended `VOICE.md`, 2026-11-10.)
- **Spec order** (owner, 2026-11-07, replacing 2026-11-01's): **1. the CV:** a CV document first,
  drafted from a private single source of truth (`alexwebber/career`) that also feeds the site's CV
  page and a LinkedIn profile; then the CV page as spec 004, unlisted at first. **2. the private
  family-admin tool**, in its own repo, not this site (details in the agent's local memory).
  **3. the blog**, its own spec.
- **The career SSOT (private):** facts are marked `[draft]`, `[confirmed]` or `[approved]`, each with
  its source; work sources come through the repo's `briefs/`, run by the owner at work, outputs in
  `C:\temp\career-sources\` (raw files never committed anywhere). Its PRs follow the house rule.
- **Standing notes:**
  - **Secrets from the owner** come through a local file outside the repo (`C:\temp\keys.txt`,
    `NAME: value` lines) that the agent passes to `gh secret set --body` and the user environment,
    printing nothing. Never a PowerShell pipe, which adds a BOM to the secret.
  - **Private terms** for `/pr-ready` are in `C:\temp\private-terms.txt`. Add one whenever the owner
    shares a private name, place or detail.
  - **Spec Kit upgrades:** run `C:\Projects\software-factory\scripts\upgrade-speckit.ps1` from the
    project folder after upgrading the CLI (PLAYBOOK > Upgrading Spec Kit).
  - **A refresh that logs "Publishing: the last refresh's deploy didn't finish"** redeployed after
    a failed deploy (002 T108). Check why the earlier deploy failed.
  - **Race pages, maps and photos** are only on the test preview (`/race-preview/` in a
    `SHELL_PREVIEW=1` build) until Brighton.
  - **Sessions are local (Windows)** by default; the cloud credits ended on 2026-11-05. A cloud
    session sets itself up (SessionStart hook: check `node_modules/.session-start.sha256` exists) and
    can reach the live site, but has no `gh api`, `pwsh` or secrets.

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

House defaults from [software-factory](https://github.com/alexwebber/software-factory), plus
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
  before building on them. Before telling the owner a PR is ready, and again after it merges,
  the agent checks that every check on it is green (`gh pr checks`), not just the required ones.
  After a merge, that includes `main`'s own run, which it waits for to the end. `/pr-ready`
  runs the PR routine's checks, and `/after-merge <pr>` the post-merge ones.
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
  agent recommends rather than blanket-upgrading. `/session-start` runs software-factory's
  `scripts/check-versions.ps1` and checks the core npm packages. A deliberate pin of a core
  component gets a `DECISIONS.md` entry saying why, and a line in `HOLDS` in
  `scripts/process/session-start.ts`.
- **Research before choosing dependencies.** Verify a library/service is current and maintained
  rather than picking from memory, and record the comparison in `DECISIONS.md` (see the Garmin
  library decision there).
- **Capture lessons in the moment; send them upstream later.** Add a one-line entry to
  *Upstream candidates* below **immediately** — don't wait for a milestone — whenever the agent:
  works around a tool/environment problem; is corrected or told a preference by the owner; finds
  software-factory wrong or missing something; or hits a procedure that behaved unexpectedly.
  Capturing is cheap and needs no approval. Sending upstream happens via
  `/speckit-house-process-harvest-lessons` (offered after `/speckit-plan` and
  `/speckit-implement`, or run any time), which proposes changes for the owner to approve.
- **Repeated procedures become scripts** (owner, 2026-11-05). The recurring checks are
  `scripts/process/` scripts behind thin project skills: `/session-start` at the start of every
  session, `/pr-ready` before raising a PR and calling it ready, `/after-merge <pr>` once a PR
  merges. When the agent finds itself doing a procedure by hand a second time, it extends
  these or adds one. Dated follow-ups go in `process/triggers.yaml`, which `/session-start`
  lists when due. **This covers every part of the SDLC** (owner, 2026-11-05): implementation
  patterns (cards, charts, data files, tests) and reviews become skills too, here or in
  software-factory when they'd help any project. A lesson about how to do a task updates its skill.
  **The loop that keeps them improving** (owner, 2026-11-05) is agent-run: each subagent brief
  asks for skill gaps, which the same PR fixes; each handoff adds or counts up tasks done by hand
  in `process/skill-candidates.yaml` (listed by `/session-start`), and a candidate is built before
  the work its `next` names; the lesson harvest reviews skills used, unused or out of date.
- Spec Kit runs via the Claude integration with PowerShell scripts; house standards are
  installed from software-factory in dev mode (preset `house-constitution`, extension
  `house-process`). Open `C:\Projects\alexanderwebber-workspace.code-workspace` to work on the
  site and the playbook side by side.

## Upstream candidates

Since the harvest of 2026-11-25 ([software-factory#22](https://github.com/alexwebber/software-factory/pull/22)),
which took every entry up to then:

- On a branch not named `NNN-feature` (e.g. `004-interactive-cv-tasks`), `setup-tasks.ps1` ignores
  `SPECIFY_FEATURE` and fails ("Feature directory not found"); setting `SPECIFY_FEATURE_DIRECTORY` to the
  feature folder's absolute path works. A subagent brief should give that variable (spec 004's tasks,
  2026-11-25).
- json-schema-to-typescript declares a `$defs` object that another file references (titled or not) in
  every file that uses it, so a generated index of `export type *` clashes (TS2308). Copying the def into
  each file doesn't help; the index has to export each name once (and refuse two different declarations
  of one name). Spec 004 slice 1's `scripts/gen-types.ts` does (2026-11-26).
- Git for Windows converts the line endings of a PDF it guesses is text (a small hand-written one is all
  ASCII), which changes its bytes and so any hash over them; a repo's first PDF needs `*.pdf binary` in
  `.gitattributes` (spec 004 slice 1, 2026-11-26).
- `check-prerequisites.ps1 -Json` on a slice branch (`004-interactive-cv-slice1`) reported spec 003's
  folder, from a stale feature pointer; `/speckit-implement` should check FEATURE_DIR against the branch's
  number before trusting it (2026-11-26).
- A sentinel test found what reading didn't: a schema message's value was stripped only when it matched
  `JSON.stringify(value)`, but the shared messages quote the raw string, so a value with a line break
  came back whole. Strip values the way the message writer writes them (spec 004 slice 1, 2026-11-26).
- `@axe-core/playwright` hangs on a page opened with `javaScriptEnabled: false` (it injects a script);
  check a no-script layout's accessibility with scripts on and the script's classes removed (spec 004
  slice 2, 2026-11-27).
- On back and forward, Chrome focuses the element the URL's fragment names (when it's focusable) after
  `popstate`, overriding focus a hash router set; restore it in a `setTimeout` and test focus after
  `goBack()` (spec 004 slice 2, 2026-11-27).
- A phone-number scan over built HTML matched an SVG path's coordinates ("M12 2.5l2.9 6.1 6.6.8…"); scan
  and test the whole HTML, not tag-stripped text, and write path data with commas (spec 004 slice 2,
  2026-11-27).
- Astro's Fonts API copies the configured font files into `dist/_astro/fonts/` on every build, even when
  no page renders `<Font />`, so a `dist/` comparison shows them added (spec 004 slice 2, 2026-11-27).
- A subagent without a private file (the private-terms list) ran `pr-ready` and was told "Ready: no
  private terms"; a check that was skipped must say so in its verdict line (spec 004 slice 2, 2026-11-27).
- A brief that names a design source the subagent can't read ("the visual CV's palette", in a private
  repo) gets an invented substitute: copy the values the slice needs into the brief, or into the plan,
  before dispatch (spec 004 slice 2, 2026-11-27).

## Open questions

- None open. See `BACKLOG.md` for deferred/future work items.
