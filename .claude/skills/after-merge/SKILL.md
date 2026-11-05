---
name: after-merge
description: After one of this project's PRs merges, check its boxes and checks, follow main's Gate run for the merge commit to the end (deploy included), check the live site, and tidy the local branch. Use whenever a PR is found merged, before pointing the owner at anything live.
---

# After a merge

1. Run `node scripts/process/after-merge.ts <pr> --live=<path>[=<text>] ...` **in the background**
   (`run_in_background`). It waits for `main`'s Gate run to finish, which takes several minutes.
   - Give a `--live` for each page the PR changed (from its *How to view it* section), with
     `=<text>` set to a phrase the change put on the page. Without `--live` it checks `/` and
     `/running/`.
   - `--timeout=<minutes>` (default 30) limits the wait.
2. When it finishes, act on each `!` line:
   - **Unticked boxes**: ask the owner now, or record that they answered in a comment.
   - **The PR's checks or the Gate weren't green**: find out why (`gh run view <id> --log-failed`).
     A failed deploy after a green gate (e.g. Cloudflare's upload error 10013) heals with the next
     deploy. Say so, and check that the next refresh deployed.
   - **A live page doesn't answer 200 or lacks the text**: it's a real fault until shown
     otherwise. Check the deploy job's log and the page itself.
3. Record the outcome in `DECISIONS.md` (one entry: merged, boxes, Gate and deploy green, live
   checks), and update *Next session* in `PROJECT_MEMORY.md` if the PR changed what's next. Those
   edits go in the next PR.
4. Only then tell the owner it's live, with the *How to view it* URLs.
