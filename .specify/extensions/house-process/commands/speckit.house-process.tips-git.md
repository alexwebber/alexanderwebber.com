---
description: "Agent tips for git and GitHub PR history: upstream tracking after branching from origin/main, scanning PR refs, confirming deleted PR description revisions, and images in PR bodies. Read before branching, pushing, or cleaning a repo's history."
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
- **`gh` can't attach images to a PR.** Commit them to a side branch that never merges, link
  `raw.githubusercontent.com` by commit SHA, and keep the branch after the merge: deleting it
  breaks the merged PR's images once GitHub drops the commit. Only made-up or public images go
  there, so keeping it costs nothing.
