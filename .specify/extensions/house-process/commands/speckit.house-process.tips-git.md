---
description: "Agent tips for git and GitHub: upstream tracking after branching from origin/main, scanning PR refs, confirming deleted PR description revisions, images in PR bodies, worktree folders left behind, labels before issues, gh pr view on reused branch names, gh repo create --clone, checking main without branch protection, reading a repo's visibility, and two PRs appending to one log. Read before branching, pushing, raising PRs or issues with gh, or cleaning a repo's history."
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
- **`git worktree add` onto a folder an earlier worktree left behind fails, but still creates
  the branch.** Run `git worktree list` first, and reuse the old folder with `git switch` once its
  branch is verified merged.
- **A label must exist before `gh issue create --label` uses it** (`gh label create` first).
- **`gh pr view <branch>` falls back to a merged PR when a branch name is reused,** and a PR's
  checks list is empty for a few seconds after a push. A "checks green" routine filters to
  `state == OPEN` and treats zero checks as not ready (alexanderwebber.com).
- **`gh repo create --clone` clones into the current folder,** even when a clone path follows:
  it left an empty nested clone inside another repo. Create without `--clone`, then
  `gh repo clone <repo> <path>` (alexanderwebber.com).
- **Without branch protection, check `main` with a script.** Where a private repository can't
  have rules (GitHub's free plan), a script over `git log --first-parent` can check that every
  commit on `main` is GitHub's own merge of a PR. Test it by planting a commit on a throwaway
  local branch, never on `main`.
- **Read a repository's visibility before writing a privacy rule about it**
  (`gh repo view --json visibility`): a norms file called a repo public from memory, and it was
  private.
- **Two PRs that both append to one log file** (a decisions log) conflict as soon as the first
  merges. Rebase the second onto `main` straight after the first merge, or tell the owner the
  order to merge them in when raising them.
