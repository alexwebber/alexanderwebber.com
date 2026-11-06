# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`. **Decisions and their reasons are in [`DECISIONS.md`](DECISIONS.md)**,
read on demand (search it for the topic at hand); this file keeps what's next and how we work.

## Next session

- **Status (2026-11-06):** Running (001) and Fundraising (002) are live and graduated. Spec 003, the
  journey story: Phases 1–6 merged (graduated, nothing visible yet). House-process 0.16.2 is in the
  PR raised on 2026-11-06 (`chore-speckit-1.3.2`).
- **Next session, first:** `/session-start`; `/after-merge` the house-process 0.16.2 PR if it merged
  (no visible change, so `/` and `/running/` only). Read the first nightly Quality run after #130
  (03:41 UTC on 7 Nov or later; 003 T071: the `story` page type shows as skipped, every other page
  type within budget) and record it in `DECISIONS.md`.
- **Then 003 Phase 7, the content PR: a session with the owner** (T078–T088 in
  `specs/003-journey-story/tasks.md`; its header has the *How to view it*). In order: draft the "not
  medical advice" note and the page wording (title ≤ 70, description ≤ 160, share text ≤ 90 with no
  digits, link label) outside the repo, from the approved text, in the owner's voice, for the
  owner's edits and explicit yes (T078); write the journey files from the approved text only, with
  figures traced statement by statement and a scale question for each weight (T079); the SC-005
  comparison on a scratch copy in the scratchpad, **against the approved text itself, not the private
  hashes** (they can't be reproduced; T080); the owner looks at the rendered chapters on that copy's
  local preview, phone width and desktop (T081); `approve-story --journey` in the repo only after
  their yes, with `--date=2026-11-04` for unchanged chapters and the closing section, and set
  `story_link` (T082); create `VOICE.md` (T083); the full gate, tests, drills, Lighthouse and axe on
  the real data (T084); the privacy search and a PR body by shape only (T085, T086). After the merge,
  the live checks (T087), and the session after that starts with a guided review (T088). Load
  `tips-owner-content` and `owner-data-file` first.
- **Waiting on others** (ask at each session start until it happens):
  - **The Martlets story reviewers** (002 T113–T115): when they reply, take their passage into the
    draft (`C:\temp\story-draft.md`), the owner approves the final text, then create or extend
    `VOICE.md` (lessons so far: personal or family passages are written by the people they belong
    to, and the agent's draft covers framing and facts; the owner keeps their own fitness journey
    out of it). Re-check Martlets' figures (almost £12 million a year, NHS grant around 22%,
    https://www.martlets.org.uk/give-in-your-will/) before committing. Commit the approved story and
    `VOICE.md` in a PR; the owner pastes the story into JustGiving and may retitle the page after
    it. Nothing from the draft goes in the repo, PRs or commit messages before approval.
- **At reviews** (fold in, never as chores):
  - Offer a fresh Garmin training-status and predictions reading.
  - 002 T118 (to about 1 Dec 2026): note donation times the owner mentions, to compare with the
    bot's commit times.
  - 002 T119: check the site's figures match JustGiving's; the tally is **1 of 10**.
- **The journey story (003):**
  - **Private files:** the clean read-through `C:\temp\journey-story-review.md`, working notes
    `C:\temp\journey-draft.md`, answers `C:\temp\journey-answers.md`. **Nothing from them goes in
    the repo, a PR, a commit message or this file** before the content PR (FR-036). The privacy
    rules the owner set are at the end of each round's notes in `journey-answers.md`; read them
    before touching the text.
  - **Approved** (owner, 2026-11-04): every chapter and the closing section, exactly as
    `journey-story-review.md` reads. At the content PR, compare the committed text with that file
    (its private hashes can't be reproduced, see `DECISIONS.md`), and show the owner the rendered
    chapters (plan question 6). It's the first story approved, so the build creates `VOICE.md` from
    the owner's edits, which the approval notes in `journey-answers.md` list.
  - **Still to approve at the content PR** (plan open questions 5 and 6): the "not medical advice"
    note, which holds back launch, and the page's title, description, share text and landing-link
    label (FR-039). Draft them from the approved text, in the owner's voice.
  - **Standing follow-ups after launch** (event-triggered; T090, a new chapter after Brighton, is in
    `process/triggers.yaml`): **T089**, at the first review after launch, offer the reader test once
    (≥ 5 non-runners on phones; ≥ 4 call it a story and name one thing that worked), or record the
    owner's choice to skip it; **T091**, whenever the owner wants photos in a chapter, check each
    against FR-062 with them, `npm run add-chapter-photo`, and a fresh approval; **T092**, when the
    Martlets reviewers reply, that story extends `VOICE.md` (keep this until both stories have
    contributed).
- **Spec order after 003** (owner, 2026-11-01): **a private family-admin section** (details in the
  agent's local memory), then CV & Blog, which is parked. Before specifying it, raise that it
  clashes with the constitution: the site has no logins (Principle V) and is public, repo included
  (Principle VI), while that data is private and belongs to other people too. It needs a
  constitution amendment, or a separate private app.
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

- None yet.

## Open questions

- None open. See `BACKLOG.md` for deferred/future work items.
