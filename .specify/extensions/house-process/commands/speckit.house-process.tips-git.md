---
description: "Agent tips for git and GitHub PR history: upstream tracking after branching from origin/main, scanning PR refs, and confirming deleted PR description revisions. Read before branching, pushing, or cleaning a repo's history."
---

# Agent tips: Git

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **`git checkout -b x origin/main` tracks `origin/main`,** so a bare `git push` targets `main`.
  Use `git push -u origin x`, or `--no-track` when branching.
- **Check `git rev-list --all --not main` before scanning PR refs.** GitHub keeps
  `refs/pull/*/head` after branches go; if that list is empty, `main`'s history covers them.
- **Confirm PR description-revision deletes through the API.** GraphQL
  `pullRequest.userContentEdits` lists each revision with `deletedAt`. An owner missed one of
  three on the first pass.
