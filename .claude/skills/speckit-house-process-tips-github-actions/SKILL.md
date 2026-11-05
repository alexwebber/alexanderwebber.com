---
name: speckit-house-process-tips-github-actions
description: 'Agent tips for GitHub Actions: unreliable schedule triggers, billed minutes per job, read-only builds with a separate write job, bash -e in retry loops, setup-node, Playwright installs, red non-required checks, continue-on-error, jq, rulesets and npm overrides. Read before writing or changing a workflow, a composite action, or CI checks.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-github-actions.md
---

# Agent tips: GitHub Actions

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **`schedule` is unreliable for freshness.** A 2-hourly cron fired its first slot 1h45 late
  and then dropped three of five slots in a day (a 4-hour gap). Don't treat a missed first slot
  as a failure; wait about two slots. For a freshness requirement of a few hours, trigger
  `workflow_dispatch` from an external cron (e.g. a Cloudflare Worker cron, with a fine-grained
  token holding Actions: write on that repo only). Keep `schedule` as a sparse backup whose
  first job skips the run if a dispatched run is recent, and opens an issue when dispatches stop,
  so a dead external trigger isn't silent.
- **Minutes are billed per job, each rounded up to a whole minute.** Estimate jobs per run ×
  runs per day, not run time. A 2-hourly refresh split into many short jobs used about 55
  minutes a day, against an estimate based on run time. The runs `timing` API reported 0
  billable ms; measure from job start and end times. Fold short steps into one job unless they
  need different permissions.
- **Bot commits: build read-only, write in a separate job.** A job that runs `npm ci` and the
  build with `contents: write` gives every install script a token that can push to `main`.
  Build and gate with read-only permissions, hand the gated output over as an artifact, and let
  a separate job with write access run only git.
- **`bash -e` and retry loops.** In a `run:` step, `x=$(curl ...)` inside a retry loop exits the
  step on the first failure, so the loop never retries. Add `|| true` to command substitutions
  inside retry loops.
- **Private repos on GitHub Free have no rulesets.** The rulesets endpoints answer 403 "Upgrade
  to GitHub Pro". Read `branches/<name>`'s `protected` flag instead, and treat the 403 as "none
  apply".
- **`setup-node` with a major-only version uses the runner's cached release**, which can be
  below a framework's new minimum. Set `check-latest: true`.
- **Skip Playwright's `--with-deps` on GitHub's Ubuntu runners.** Its apt install hung in font
  downloads on two PRs in a row, and apt timeouts didn't stop it. The image's Chrome already
  brings Chromium's libraries. Give the browser install step its own `timeout-minutes`.
- **A red non-required check is still a failure.** One failed on every PR unnoticed until the
  owner mentioned the emails. Check every workflow's runs on a PR, not just the required gate.
- **Test fixture pages pin every input they assert on.** A test page that read the repo's
  published data broke as soon as a bot published real data to `main` (PR CI tests the merge
  with the base).
- **Performance budgets in CI:** print the metric breakdown on failure, and judge a miss on the
  median of three runs. To reproduce locally, use `--throttling.cpuSlowdownMultiplier` and
  compare long-task start times with first paint.
- **Node scripts: don't block the event loop between `fetch` calls.** A `spawnSync` between
  fetches froze undici's keep-alive timers, so fetch reused a socket the server had closed
  ("other side closed").
- **The GitHub MCP `get_job_logs` returns 404 while a job is running.** Poll the step status,
  then read the logs once it finishes.
- **Cloud sandboxes may block a provider's API** (egress 403). Check real payload shapes with a
  throwaway branch workflow that prints aggregates only (key names, counts, rounded medians),
  never values.
- **`continue-on-error` makes a green run prove nothing about that step.** A first real read
  failed inside a green run, and the expected commit never came. Check what the step should leave
  behind (a commit, a file) and its summary line, not the run's colour.
- **`jq -r` on an empty file prints nothing and exits 0,** so `[ "$(jq ...)" != 0 ]` is true. Use
  `jq -e` with a comparison.
- **A personal repo's ruleset can't exempt GitHub Actions.** Naming the Actions app (integration
  15368) as a bypass actor answers 422 outside organisations. So a bot that pushes to `main` with
  `GITHUB_TOKEN` rules out required PRs and checks there, unless it pushes with a deploy key
  instead. Deletion and force-push rules don't affect it.
- **npm 10's `npm ci` rejects a nested override of an exact pin** (`"miniflare": {"undici":
  "7.30.1"}`: "lock file's undici@7.30.1 does not satisfy undici@7.29.1"), while local npm 11
  accepts it. A version-scoped top-level key (`"undici@7.29.1": "7.30.1"`) works in both. Check
  with `npx npm@10 ci --dry-run` when CI's Node bundles an older npm.
- **Measure CI speed-ups on one runner, back to back.** Hosted runners differ enough (the same
  Playwright suite took 292 s and 414 s) that a PR's own job time can't show a 30% gain. A
  throwaway branch workflow that runs the old and new versions in one job can.