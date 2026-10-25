# Backlog

Deferred or future work, tracked here so it doesn't get lost or buried in the decisions log.
Each item: what it is, and why it's deferred. When something is picked up, move its entry to
the Decisions log in `PROJECT_MEMORY.md` and remove it from here.

- **Maintainability review and refactor** (owner, 2026-10-25). **Next after the T158 lesson
  harvest, before the next spec.** The Running section was built in eight slices by separate
  subagents, and the reviews so far (T110, T147) checked correctness, speed, accessibility,
  privacy and SEO, not simplicity. CV & Blog will be the second section, the first real test of
  Principle VII, so any coupling between shared plumbing and Running is cheapest to fix now.
  - **Review first (one session, read-only):** a ranked list of findings, each with its payoff
    and risk. It covers patterns that drifted between phases, duplicated helpers, dead code and
    leftover transition shims, and Running details leaking into `src/shared/`, `schemas/` or the
    gate. It also covers the ingest package's structure, tests that are slow or duplicated, and
    docs that have drifted from the code. The owner picks what to do.
  - **Then small refactor PRs:** one concern each, with no change visitors can see. The existing
    tests and the gate are the safety net, and published data must not change unless a finding
    says why.
- **Decide repo visibility (public vs private)** — a public repo showing a spec-first, AI-built
  site could be a CV piece. Deferred by owner; constitution Principle VI already requires the
  repo be kept safe to publish.
- **Set up Martlets fundraising page** for Brighton Marathon (2027-04-04) —
  https://www.martlets.org.uk/set-up-fundraiser/. Owner action; needed before the fundraising
  provider can be built.
- **Broader CI: full lint on every change.** Path-filtered PR test jobs were adopted on
  2026-10-04 (see the decisions log). Lint and the remaining full-suite runs are still deferred
  per the house default. Revisit once the shared surface area grows.
- **Alert on publish failures, not only fetch staleness.** The `ingest-failing` alert only
  watches `last_success_at` from fetch, so a gate or processor failure on the bot path that keeps
  recurring opens no issue, and `/running/api/freshness` still reads as fresh. Plan: record the
  publish outcome in R2 (e.g. `state/publish-status.json`) and have `alert` include it.
  Owner agreed on 2026-10-17 (PR #23); deferred because it's a separate slice from Phase 2g.
  It happened on 2026-10-24: a zone backfill's publish failed the gate (a `name` key, fixed
  in #53), and no issue opened. The agent was watching that run, so it was caught.
- **Running gear (shoe rotation).** The owner rotates shoes for different kinds of run and
  thinks per-shoe mileage and which shoe each run used could be interesting. intervals.icu syncs
  Garmin gear, so the adapter could carry it. It's a new published category, so it needs the
  owner's approval (Principle VI) and a small spec amendment. Raised 2026-10-18, deferred by the
  owner ("don't worry about that for now").
- **Deploy ordering across workflows** (T086 review, 2026-10-18). Deploys share the `deploy`
  concurrency group, but nothing stops an older build deploying after a newer one. Example: a
  PR merge's Gate deploy (commit A) finishes after a refresh deploy (A plus new data, pushed as
  B). The live pages then lag the data until the next refresh that changes something (usually
  within a day, since wellness changes daily), while "Last updated" still reads fresh. Plan:
  each deploy job skips itself when `main` has moved past the commit it built. Refresh compares
  against the commit it pushed. Rare, and the impact is bounded, so it's deferred to a pipeline
  slice.
- **Privacy scan: Garmin activity IDs** (T086 review). `scan-privacy --provider-ids` checks the
  intervals.icu IDs from `state/run-ids.json`, but not the Garmin `external_id`s, which no file
  in R2 lists. The sanitiser never reads `external_id`, and the log scrubber removes long
  numeric IDs, so this is defence in depth only. Option: record the external IDs in a private
  state file the gate also checks.
- **Faster FIT zone reading on a full reprocess** (2026-10-24). Reading Garmin's zones decodes
  each whole original FIT file with `garmin-fit-sdk` (pure Python), about 3.4 s a run on CI, so a
  `PROCESSOR_VERSION` bump reprocesses ~200 runs in about 11 minutes (and grows with history).
  Normal refreshes only touch new runs, so it's cheap day to day. Options: cache the zones by the
  FIT file's hash in R2, or stop decoding after the session's `time_in_zone` message. Deferred:
  it costs minutes only on a processor bump.
- **Why do archived runs get re-fetched in full?** (2026-10-24). The zone backfill
  (`missing_only`) re-fetched 44 of 201 activities in full, because their list row's hash had
  changed, and rewrote 356 of 383 wellness days. Something in intervals.icu's rows (probably
  recomputed fields) changes after the fact. Check which fields change, and leave volatile ones
  out of the row hash if they don't affect what's published. Deferred: correct, just slower.
- **Fundraising spec (Running)** — Martlets via JustGiving for Brighton Marathon: total vs
  target, donate link, cached with last-known fallback. Next spec after Running; the Running
  landing page reserves a slot beside the Brighton hero.
- **Journey/story spec (Running)** — motivational/educational "couch potato to runner" story and
  videos, plus training-run photos. Running landing page links to it once it exists.
- **CV & Blog section** — phase 2, after Running.
- **Report Spec Kit 1.1.0 Windows issue upstream?** — PowerShell scripts prefer `python3` even
  when it's the Microsoft Store stub, and need PyYAML installed. Worked around locally
  (disabled app execution aliases, `pip install --user pyyaml`).
- **Bound the Health page's data tables** (owner, PR #57). Each chart's "Show data" table holds
  every reading, so `/running/health/` grows about 40 KB gzip a year (54 KB in Oct 2026) and
  reaches the 150 KB page budget in about two years. Plan: keep daily rows for the last year
  and weekly means before that. Revisit by autumn 2027, or sooner if the page passes 100 KB.
- **Security headers** (T147 review, 2026-10-25). The site sends no `Content-Security-Policy`,
  `X-Content-Type-Options: nosniff` or `Referrer-Policy`. They aren't one of the constitution's
  quality bars, and the site has no forms, logins or third-party scripts, so the risk is low. A
  CSP needs care: the inline freshness and countdown scripts need hashes, and the race map loads
  OpenFreeMap tiles and a worker. Could be a `_headers` file in `public/`.
- **Favicon** (T147 review). There is none, so browsers request `/favicon.ico` and get the 404
  page. Pick one when the CV & Blog section sets the site-wide identity.
