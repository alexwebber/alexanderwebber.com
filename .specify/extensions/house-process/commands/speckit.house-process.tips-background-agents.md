---
description: "Agent tips for background agents (scheduled or event-fired cloud runs nobody is present for): what a cloud session loads, the owner's rights a run holds, the procedure read from main, a log line per run, notifications of the owner's own activity, markers on process comments, standing jobs, the lesson harvest through a pick issue, claims, and webhook triggers. Read before designing, changing or reviewing a scheduled or background agent."
---

# Agent tips: Background agents

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here. These come from a private
control-tower project that has run a daily and an event-fired cloud task since 2026-11-16.

- **A cloud session loads the repository's `CLAUDE.md`, not the owner's global one,** so a repo
  meant for cloud or scheduled agents carries its working norms itself. There, `gh pr` and
  `gh issue` fail (use `gh api` or the built-in GitHub tools), and `gh auth status` reports an
  invalid token while `gh api` works: never use it as a check.
- **A run acts as the owner, with their rights on every attached repository.** A task's
  allowed-tools list doesn't remove the built-in GitHub tools, merge and push among them, so "read
  only" and "never merge" are prompt rules. The check that catches a breach matters more than the
  wording: a script, run at every start, that every commit on `main` is a PR merge.
- **Keep the procedure in the repository and only the hard rules in the task's prompt.** Each run
  reads its steps from protected `main`, so a merged PR changes what runs do with no task update,
  and an unmerged branch can't.
- **Every run ends with one fixed-format line on a log issue** (`RESULT done: ...`,
  `RESULT nothing-unblocked`, `RESULT cap: ...`). Scheduled tasks have no daily cap, and a run
  refused at the plan's limit leaves no other trace, so a script reading these lines can count
  cap stops and spot a slot with no run. Test such a script at its window's edges.
- **GitHub doesn't notify a user of their own activity,** and a run acts under the owner's
  account: its PRs and issues arrive silently unless the owner's "Your own updates" email setting
  is on. Decide how the owner hears about output before going live.
- **Give process comments a fixed first word** (`Chase`, `RESULT`). Everything a run does carries
  the owner's login, so the agent's comments and the owner's replies can't be told apart by
  author. Base a "don't repeat it" check on the act (any comment starting `Chase`), not on who did
  it: a rule keyed on the run's own marker would have repeated a local session's chase hours
  later.
- **Give runs standing jobs that don't depend on a workstream being active:** chasing the owner's
  overdue issues, a weekly lesson harvest, a weekly version check. A week of runs keyed on stream
  status found nothing to do while issues went overdue and lessons piled up. Review the first week
  for work *not* picked up, not only for wrong picks, and rank the weekly jobs above routine stream
  work so they can't starve.
- **The lesson harvest runs in two halves.** First an issue listing each candidate with its
  destination and the exact text, written for any project; the owner replies with picks and closes
  it, so nothing reaches the shared repo that they haven't read word for word. The close fires the
  second half: the PR with the approved text, and one clearing the settled candidates.
- **A claim on work is a branch holding commits not on `main`.** "A branch named for the stream
  exists" broke as soon as merged branches stayed on the remote, and a branch can hold a commit
  that reached `main` as a copy. Count only branches where `git cherry origin/main <branch>` shows
  a `+`, delete head branches on merge, and have the start script print the claims.
- **Attaching a GitHub event to a scheduled task:** the task API's `create_webhook_trigger` takes
  `routine_trigger_id`, `source: github`, `hook_type: app`, `scope_id: <owner>/<repo>` and
  `events: ["issues.closed"]`. The body isn't documented and was found from the validation errors.
  A run isn't told which event fired it, so its steps make it look (an issue closed in the last 30
  minutes).
