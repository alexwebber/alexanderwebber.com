---
name: pr-ready
description: The PR routine's checks for the current branch in this project — a private-term search of the diff, commit messages and PR body, a dist/ comparison against the branch's base on main, and the PR's own checks. Use before raising a PR, and again before telling the owner it's ready.
---

# PR ready

1. Commit everything first; uncommitted changes aren't checked.
2. Run `node scripts/process/pr-ready.ts` **in the background** (it makes two deploy builds, a
   few minutes). Use `--no-dist` for a PR that changes no site code or data (docs, process,
   ingest-only), and `--reuse-dist` if `dist/` is already a deploy build of this commit.
3. **Private terms** (`C:\temp\private-terms.txt`, one per line, outside the repo): a match
   prints its place and the term's number and mask, never the term. Remove every match before
   pushing, rewording the commit message too if it matched. If the file is missing (a cloud
   session), search by hand and say so in the PR. Add a term to the file whenever the owner
   shares a private name, place or detail, so later PRs check for it.
4. **dist/**: say what changed in the PR body (*How to view it* or a *dist/ against main* line).
   Every changed file should be explained by the PR. An unexplained change, such as reordered
   CSS or a new stylesheet file, is checked in the built pages before the PR is called ready.
5. After `gh pr create`, run it again with `--no-dist` until the **PR checks** section is green
   (every check, not just the required ones), then tell the owner the PR is ready.
