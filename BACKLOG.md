# Backlog

Deferred or future work, tracked here so it doesn't get lost or buried in the decisions log.
Each item: what it is, and why it's deferred. When something is picked up, move its entry to
the Decisions log in `PROJECT_MEMORY.md` and remove it from here.

- **Public-readiness sweep, then make the repo public** (owner, 2026-10-25: the repo will go
  public). **In progress.** The read-only sweep is done and the owner has picked the fixes
  (`PROJECT_MEMORY.md`, decisions log, 2026-10-25): keep the history, use neutral wording,
  rotate credentials. Credentials are rotated (decisions log, 2026-10-25). What's left:
  - **Email privacy:** the owner turns on *Keep my email addresses private* and *Block command
    line pushes that expose my email* (new commits already use the noreply address).
  - **Public-repo setup:**
    - add `SECURITY.md`, and turn off Projects (the wiki is already off; Issues stay, for the
      alerts);
    - after the switch: fork-PR workflow approval for all outside contributors (GitHub only
      offers it on public repos), `sha_pinning_required`, a ruleset for `main` with a bypass
      for the refresh bot (prove a bot push still lands), secret scanning with push
      protection, Dependabot alerts and code scanning;
    - the licence is decided (MIT for code, content all rights reserved; `LICENSE` added in
      the README PR, 2026-10-25).
  - **The switch itself is the owner's**, or the agent's only on their explicit go-ahead, once
    the items above are done. Then the agent checks the public view logged out.
  - **Side benefit:** Actions minutes on standard runners are free for public repos, which
    ends the 2,000-minute watch.
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
