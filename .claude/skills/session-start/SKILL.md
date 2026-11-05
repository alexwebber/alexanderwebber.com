---
name: session-start
description: Run this project's session-start checks (git, main's workflows, issues, security alerts, PRs with unticked boxes, live freshness, versions, dated triggers) in one report, then act on what it flags. Use at the start of every session, before other work.
---

# Session start

1. Run `node scripts/process/session-start.ts` (about 15 s). Lines starting with `!` need action.
   If the report says main was fast-forwarded and `PROJECT_MEMORY.md` changed, re-read its
   *Next session* block before going on.
2. Act on the flags, in this order:
   - **A red workflow on `main`, a Refresh run that isn't green, or too few Refresh runs**: open the
     run (`gh run view <id> --log-failed`) and fix it first. A `refresh-trigger-failing` or
     `ingest-failing` issue counts as red.
   - **A secret-scanning alert**: raise it with the owner at once. Other alerts: fix what affects
     us in a PR, and dismiss the rest with a reason.
   - **A merged PR with unticked boxes**: if `DECISIONS.md` already records the owner's answer
     (e.g. given in a comment), it's settled: add the PR to `SETTLED` in the script so it stops
     flagging. Otherwise ask the owner before building on it.
   - **Stale live data** (over 6 h): check the latest Refresh run's fetch step.
   - **Versions**: adopt new core releases and security fixes in a PR, and skip routine bumps
     (say so in one line). A hold shown with its reason stays until the reason ends; then remove
     it from `HOLDS` in the script.
   - **Due triggers**: do them in this session if they're small, or tell the owner they're next.
     Remove a done trigger from `process/triggers.yaml` in the same PR, and record the outcome
     in `DECISIONS.md`.
   - **Skill candidates with a `next`**: if this session's work is that `next`, build the skill
     first (or say it's next). The rest wait for the lesson harvest's skills review.
3. Then read the event follow-ups in *Next session* (e.g. "ask whether the reviewers replied")
   and fold them into what you say to the owner.
4. Report to the owner in a few lines: what was flagged and what you did, then the session's
   planned work. Don't paste the whole report.

In a cloud session, some sections say UNAVAILABLE (no `gh api` and no `check-versions.ps1`).
Mention it in one line, and leave those checks to the next local session.
