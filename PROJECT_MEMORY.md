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
  page type. House-process 0.16.2 is installed. Open: 003's standing follow-ups (T090–T092, below).
- **Next session:** `/session-start`, then **the CV** (owner, 2026-11-07; the top priority, see
  *Spec order* below). Carry on the role-by-role career interview, writing each answer into the
  private career repo's `ssot.md` (`C:\Projects\career`, `alexwebber/career`, private). Fold in
  whatever has arrived in `C:\temp\career-sources\` from the work briefs. Once every role is
  covered, draft the CV document (Word and PDF) from the SSOT for the owner's approval.
  Nothing from the career repo comes into this repo before the owner approves that exact text.
- **The Martlets story** (002 T114): the family's text came in and the owner approved it on
  2026-11-10; it's in its own PR (branch `content-martlets-story`) with `VOICE.md`. Once that PR
  merges and deploys (`/after-merge`), confirm https://alexanderwebber.com/running/fundraising/ shows
  exactly the approved text, then guide the owner through pasting it into JustGiving and, if they
  wish, retitling the page "Running Brighton for Martlets, in memory of Eileen" (FR-054). Then tick
  T114 and remove this note.
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

Since the evening harvest of 2026-11-06 ([software-factory#21](https://github.com/alexwebber/software-factory/pull/21)):

- `gh pr view <branch>` falls back to a merged PR when a branch name is reused (the upgrade script's
  `chore-speckit-<version>` on a bundle-only reinstall), and a PR's checks list is empty for a few
  seconds after a push: a "checks green" routine filters to `state == OPEN` and treats zero checks as
  not ready (fixed in `pr-ready.ts`, 2026-11-06).
- A site copy outside the repo (a scratchpad, to keep it out of git) can't build: Astro resolves
  `astro/tsconfigs/strict` by walking up to `node_modules`. Add a junction to the repo's
  `node_modules` (`mklink /J`), and remove it on its own (`cmd /c rmdir`) before deleting the copy,
  so a recursive delete can't reach the repo's packages (003 T080, 2026-11-06).
- **Two sessions at once:** the owner ran a side task (the Martlets story) in one session while
  another worked in the same checkout. The side session works in a `git worktree` from `origin/main`
  with a `node_modules` junction, so neither switches the other's branch; it edits only the parts of
  `PROJECT_MEMORY.md` the other branch doesn't touch (2026-11-10).
- A chart's `nowrap` axis labels count towards its minimum width, so the bot's weekly data changed
  which dates showed and widened the landing page by half a pixel at 320 px under Linux's font: red
  `playwright` on an unrelated text PR (#141). `contain: inline-size` on the label cells keeps
  labels out of the minimum width. Data-driven text needs the same care as fixed text (2026-11-10).
- A test that plants files into a copy of the real data must set aside and restore what was there,
  not delete the folder afterwards: it passed while the folder was empty, and broke the next test
  once the content PR filled it with real files (`scratch-site.test.ts`, 2026-11-06).
- Open a PR as a **draft** and mark it ready only once every check is green: the owner merged #135
  while its `playwright` check was still running, and it was red (Linux font). `pr-ready` also called a
  PR merged at the current commit "no PR yet"; it now reads its checks (2026-11-07).
- Before pushing a layout sized from measured widths (a frame, a grid track), measure it under DejaVu
  Sans too (injected from jsdelivr, as tips-testing says): twice in one day a layout fitted Windows'
  Segoe UI and failed CI's Linux font by a few pixels (#135's menu, #137's grid, 2026-11-07).

## Open questions

- None open. See `BACKLOG.md` for deferred/future work items.
