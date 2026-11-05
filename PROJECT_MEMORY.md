# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`. **Decisions and their reasons are in [`DECISIONS.md`](DECISIONS.md)**,
read on demand (search it for the topic at hand); this file keeps what's next and how we work.

## Next session

- **Status (2026-11-05):** Running (001) and Fundraising (002) are live and graduated. Spec 003, the
  journey story, has its spec, plan and tasks merged (#101, #105, #108), with nothing visible yet,
  and the owner approved the whole story on 2026-11-04. The process retro (`chore-process-retro`
  PR, and [sdd-playbook#15](https://github.com/alexwebber/sdd-playbook/pull/15) for the
  harvest step) moved the decisions log to `DECISIONS.md` and
  added the `/session-start`, `/after-merge` and `/pr-ready` skills.
- **Next session, first:** `/session-start`, and `/after-merge` for the house-process 0.12.0 PR
  if it has merged. (#109, #110 and sdd-playbook#15 are merged and checked.)
- **Then the skills inventory** (owner, 2026-11-05; `DECISIONS.md` has the picks), in the main
  conversation, as one session:
  1. From evidence (`DECISIONS.md`, the three specs' tasks, *Upstream candidates*, sdd-playbook's
     `AGENT_TIPS.md`), list every SDLC task done more than once: implementation (e.g. a landing
     card, a chart, an owner data file with its schema and store fakes, a test-only preview state,
     Playwright tests, an ingest step), reviews (graduation, privacy, maintainability, live guided
     review, alert triage) and process (question rounds, subagent briefs, PR bodies, handoffs,
     dependency research). For each: how often, rough cost, project or playbook.
  2. The owner picks. Then build the **first batch**: the skills 003 Phase 1 needs (e.g. owner data
     file + schema, tests, the PR routine), written from the real code, each naming the files to
     copy and the checks that prove it's done. A PR here, and one in sdd-playbook for the general
     ones plus `AGENT_TIPS.md` turned into topic skills shipped by house-process.
  3. **Then 003 Phase 1** (slice 1, T001–T023) via `/speckit-implement` as a subagent, in its own
     session, with the brief naming the skills. Compare its token cost with 002's slices (about
     350–470k each).
- **Waiting on others** (ask at each session start until it happens):
  - **The Martlets story reviewers** (002 T113–T115): when they reply, take their passage into the
    draft (`C:\temp\story-draft.md`), the owner approves the final text, then create or extend
    `VOICE.md` (lessons so far: personal or family passages are written by the people they belong
    to, and the agent's draft covers framing and facts; the owner keeps their own fitness journey
    out of it). Re-check Martlets' figures (almost £12 million a year, NHS grant around 22%,
    https://www.martlets.org.uk/give-in-your-will/) before committing. Commit the approved story and
    `VOICE.md` in a PR; the owner pastes the story into JustGiving and may retitle the page after
    it. Nothing from the draft goes in the repo, PRs or commit messages before approval.
  - **A first lab result** (DEXA or lab VO2 max, 001 T142): offer the plainer wording first: "Lab
    test (Clinic, 15 Mar 2026): 51.0. Your Garmin said 54 that day, 3.0 higher than the lab." The
    built wording is the alternative.
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
  - **Spec Kit upgrades:** run `C:\Projects\sdd-playbook\scripts\upgrade-speckit.ps1` from the
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
  agent recommends rather than blanket-upgrading. `/session-start` runs sdd-playbook's
  `scripts/check-versions.ps1` and checks the core npm packages. A deliberate pin of a core
  component gets a `DECISIONS.md` entry saying why, and a line in `HOLDS` in
  `scripts/process/session-start.ts`.
- **Research before choosing dependencies.** Verify a library/service is current and maintained
  rather than picking from memory, and record the comparison in `DECISIONS.md` (see the Garmin
  library decision there).
- **Capture lessons in the moment; send them upstream later.** Add a one-line entry to
  *Upstream candidates* below **immediately** — don't wait for a milestone — whenever the agent:
  works around a tool/environment problem; is corrected or told a preference by the owner; finds
  sdd-playbook wrong or missing something; or hits a procedure that behaved unexpectedly.
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
  sdd-playbook when they'd help any project. A lesson about how to do a task updates its skill.
- Spec Kit runs via the Claude integration with PowerShell scripts; house standards are
  installed from sdd-playbook in dev mode (preset `house-constitution`, extension
  `house-process`). Open `C:\Projects\alexanderwebber-workspace.code-workspace` to work on the
  site and the playbook side by side.

## Upstream candidates

- When analyze's fixes are applied, resume the tasks subagent (`SendMessage`), which already holds
  the docs, rather than starting a fresh one.
- sharp given a file path keeps the file open in its cache (`sharp.cache` holds up to 20 files), so
  an in-process caller can't delete it on Windows (EPERM, retries don't help) until the process exits.
  Pass `readFileSync(path)` for read-only checks.
- To convert a supplied logo without altering it, use lossless WebP with `exact: true` and compare the
  raw RGBA of both files; without `exact`, the hidden colour under transparent pixels changes.
- A cosmetic element beside a heading that doesn't wrap (`white-space: nowrap` dates) can push a
  320 px page into sideways scrolling; the existing "fits 320px" tests across every preview state
  caught it, where the active state alone looked fine.

- `python -I` (isolated mode) also ignores user site-packages, so a module installed with
  `pip install --user` (PyYAML here) is missing. Safe scripts in a folder you created don't need it.

- When recording an approval hash outside the repo, record exactly what was hashed (byte range, line
  endings, trailing newline) or the script. The journey story's private hashes couldn't be reproduced
  a day later, and only the files' modified times showed the text was unchanged.
- A privacy scan that prints its matched excerpt is harmless over data files but quotes free text
  when run over prose. Redact findings in prose files before a scan's output reaches a public log.

- Hidden minor axis labels (`visibility: hidden`) still take up layout, so a label at a chart's edge
  can widen the page at 320 px though nobody sees it. Find these by walking text nodes' ranges, not
  element boxes.
- Playwright's `getByRole(..., { name })` matches substrings by default, so real data that adds a
  heading containing the name ("Just achieved" vs "Achieved") breaks strict mode. Use `exact: true`.
- In an owner interview, people volunteer private details they then ask to keep out. Redact them in
  the private notes too (a placeholder plus a rule), and search the public repo for earlier mentions.
- Owner-volunteered figures from a data export still need the owner's confirmation before a story
  uses them: the export misses activities recorded in other apps.
- If the owner asks to review a multi-part draft once at the end, keep a clean read-through file
  apart from the working notes, with choices marked inline.

- With both cloud and local sessions, a local session auto-loads `PROJECT_MEMORY.md` from whatever
  its checkout holds, so a stale `main` means a stale handoff. Here it pointed at work already done,
  until `git log` showed 27 new commits. Fast-forward first, then read the handoff.
- Write a brief for a spec from the owner's exact answer. "No one else in the family appears" became
  "names no one else" in the agent's brief and reached the spec, where it would have banned crediting
  a published source. Only the agent's own read of the spec caught it.
- For a personal story in a public repo, tell the specify subagent what mustn't appear, then search
  its output yourself. Keep the owner's raw answers in a private file the next session can find.
- PowerShell 5.1 breaks `gh --jq` expressions that contain `\(...)`: the quotes are lost, and `gh`
  reports "unknown command". Run those through Bash.
- `scan-privacy` (and scanners like it) report only a rule's first match per file, so a test that
  plants two forbidden keys in one file proves only one. Plant each alone, then both.
- Cloud image: there's no `pwsh`, so Spec Kit's PowerShell prerequisite scripts can't run in a cloud
  session; the implement subagent took the feature folder from `feature.json` instead.

- `gh` can't attach images to a PR. Commit them to a side branch that never merges, link
  `raw.githubusercontent.com` by commit SHA, and delete the branch after the merge.
- `Astro.slots.has('x')` is true for `{cond && <C slot="x" />}` even when `cond` is false. Test the
  empty case, or pass a prop.
- A percentage height shared from a card shell resolves against a stretched grid item, so a card
  placed lower in it overflows. Every test passed; only a phone screenshot caught it.
- Growing a shared stylesheet by a few bytes can pass Vite's 4 KB inline limit and turn inline CSS
  into a new render-blocking file on some pages. Check `dist/`'s file list, not just the HTML.
- For a before/after computed-style check, a temporary `git worktree` under a gitignored folder finds
  `node_modules` by walking up. Run `gen-types` there, then call Astro's bin by its relative path.
- A long `python - <<'EOF'` heredoc through the Bash tool failed with "unexpected EOF while looking
  for matching quote". Write the script to a scratchpad file and run that.
- `Remove-Item` on a variable-built scratchpad path was refused as a "system path", which rejected
  the whole PowerShell call. Keep cleanup out of chained commands.
- `gh run list --commit` needs the full SHA; a short one returns nothing, not an error.
- CodeQL's PR alerts don't show under `?ref=refs/pull/N/merge` here; `alerts?pr=N` and the check run's
  annotations do. A CodeQL fail in `gh pr checks` is the results check, not the Analyze jobs.
- JustGiving's staging: new pages can vanish minutes after creation, but existing shared test pages
  work and accept test-card donations, which reach the API at once (1 Nov 2026).
- Before calling a third-party test environment broken, try something already in it. The agent
  gave up after one failed page, and the owner found a working one.
- Removing a scratch folder that holds a Windows junction: delete the junction first with
  `cmd /c rmdir`, as a recursive delete could reach the junction's target.
- PowerShell 5.1 strips embedded double quotes from native arguments, so `python -c` with quotes
  fails. Use a script file, and don't hide stderr while checking it.
- `gh run list` and `gh run view` showed `createdAt` an hour ahead of the run's own log timestamps
  (09:24:08Z listed, 08:24:16Z logged, 1 Nov 2026), which looked like a missed refresh slot. Check
  a run's log before trusting a gap in the listing.
- A second page sharing a component can change Vite's CSS chunking either way; here it removed a
  chunk file from two pages. Compare `dist/`'s file list and computed styles, not just the HTML.
- A running `astro preview` blocks Playwright's `webServer` even on another port ("Another astro
  preview server is already running"). Run `astro preview stop` first.
- On a `core.autocrlf` checkout, scripted edits must normalise line endings first, and a generator's
  LF output shows as modified until `git add`.
- For an SVG with `aria-labelledby` on its title and desc, the desc is part of the accessible name, so
  `toHaveAccessibleDescription` reads empty. Assert on `toHaveAccessibleName`.
- On a chart climbing towards a target, put the target label at the start of the line; at the end it
  collides with the last point.
- When a preview renders a component twice (card and page), older tests hit Playwright's strict mode.
  Scope each locator to its container.
- PowerShell 5.1's `Invoke-WebRequest` shows a UTF-8 page's `£` as `Â£`, so a text pattern misses it
  and looks like a site bug. Check bytes or use `curl`.
- Run a quickstart's failure scenario for real, not only as unit tests. A check in the validator isn't
  a check in the build: a plain build rendered text the validator would have refused.
- A `<style>` in a new component a page imports can reorder that page's inlined CSS even when the
  component isn't rendered. Keep the rule on the page, or compare `dist/`.
- A Bash-tool heredoc lost backslashes even with a quoted `'EOF'` (`\\S` became `\S`). Write such
  files with the Write tool.
- A full-page Playwright screenshot with `isMobile` failed with "Unable to capture screenshot". Use a
  phone-width viewport with `isMobile` off for that shot.
- The auto-mode permission check refused `git push origin --delete` on the agent's own screenshot side
  branch, so the routine of deleting it after a merge needs the owner, or a permission rule.
- Cloud image: the preinstalled Chromium (build 1243) didn't match the project's pinned Playwright
  1.64.1 (wants 1248). Symlinking `/opt/pw-browsers/chromium*-1248` to the 1243 folders let the
  whole suite run without `playwright install`.
- A cloud session may push only to its own branch, so PR screenshots can't use a side branch: add
  them in one commit, link by that SHA, remove them in the next. Convert to WebP first (1.6 MB of
  PNG became 420 KB).
- `pkill -f "astro preview"` inside a compound Bash command matched the tool's own shell and killed
  the call (exit 144). Use `npx astro preview stop` on its own.
- `spikes/<x>/out/` (gitignored, outside `tsconfig`) is a good home for a temporary `git worktree`
  used to build `main` for a `dist/` comparison: `astro check` doesn't scan the copy.
- For cloud-session set-up, a SessionStart hook committed to the repo (gated on `CLAUDE_CODE_REMOTE`,
  installs gated on lockfile hashes) beats the environment's setup script: it's versioned, reviewed
  in a PR, and needs no settings screen. Only the network allowlist still needs the owner.

## Open questions

- None open. See `BACKLOG.md` for deferred/future work items.
