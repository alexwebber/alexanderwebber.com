# Contract: Pipeline CLI, Workflows, Alerts, Freshness Endpoint

## CLI (`uv run awingest <command>`; structured JSON-lines logs on stderr, result summary on stdout)

| Command | Stage | Does | Exit codes |
|---|---|---|---|
| `fetch [--reimport-from D --reimport-to D] [--health-only] [--archive r2\|local]` | fetch | Call intervals.icu (`INTERVALS_API_KEY`, descriptive User-Agent): list activities in the date window (cursor - 14 days .. today), archive raw parts of new/changed ones, fetch wellness for the same window (approved keys only), update cursors + `state/fetch-status.json` + `public/freshness.json` on success | 0 ok/partial-ok, 10 auth, 11 rate-limited/429 (sets `rate_limited_until`), 12 forbidden (403 HTML bot block), 13 provider-changed, 14 archive, 1 other |
| `backfill [--from D] [--resume]` | fetch | Whole-history, paced, resumable; run once after the owner's Garmin export is imported into intervals.icu (agent runs it locally or from a dispatched workflow) | same |
| `process [--all]` | publish | Normalise + sanitise raw -> published JSON, assigning opaque run IDs from the R2 ID map (incremental by manifest hash; `--all` = reprocess everything, e.g. after an adapter fix) | 0, 20 validation error |
| `publish-check` | publish | Schema-validate published tree + manifest consistency | 0, 20 |
| `alert` | alert | Evaluate `fetch-status`; open/update/close the `ingest-failing` GitHub issue | 0 |
| `reprocess --run RUN_ID` | publish | Re-run one activity (e.g. after designating a race) | 0, 20 |

There is no `login` or `keygen` command: intervals.icu uses a personal API key, so there are no
tokens to create, rotate or encrypt.

Guarantees: `fetch` never deletes archive objects; a failed/partial run leaves cursors at the last
fully successful point; `process` writes nothing if any validation fails.

## Workflows

- **`refresh.yml`** — triggers: `schedule: 17 */2 * * *`, `workflow_dispatch` (inputs
  `reimport_from`, `reimport_to`), `push` to `main` touching `data/running/owner/**`.
  `concurrency: refresh` with `cancel-in-progress: false` (runs never overlap, so two runs cannot
  race on cursors, the run-ID map or bot commits; later runs queue).
  Jobs: `fetch` (always on Actions; Spike 0 confirmed GitHub-hosted runners reach intervals.icu)
  -> `publish` (`process`, run **gate**; if the published tree changed, commit as
  `github-actions[bot]` to `main`) -> `deploy` (`wrangler deploy`, only if gate passed and
  something changed or owner files changed) -> `alert` (always, even on failure). There is no
  `FETCH_MODE` and no PC fallback.
- **Gate** (reusable job, also `gate.yml` for pushes/PRs, no deploy on PR) = **site build + data-schema
  validation** per the constitution: install; `validate-data` (schemas + referential, incl.
  duplicate-race and ID checks); `scan-images`; **section-boundary check**
  (`check-boundaries`: `src/shared/` must not import sections, sections must not import each other);
  `astro check` + `astro build`; `scan-privacy` on `data/` and `dist/`. Any failure blocks
  commit/deploy; live site unchanged (FR-007/070). **pytest/Vitest/Playwright are not in the
  gate**: they run locally, at graduation, and as path-filtered PR jobs in `tests.yml` (adopted by
  the owner on 2026-10-04).
- **`rebuild-daily.yml`** — crons `5 23 * * *` and `5 0 * * *` (UTC): gate -> deploy, so countdown +
  OG image reflect the UK date.
- **`quality.yml`** — non-blocking Lighthouse 13.5.0 CLI (mobile, via `scripts/lighthouse-budget.mjs`)
  + axe on key pages, PRs + nightly.

Bot commits to `main` (publish job, after the gate) are a narrow exception to the PR norm,
confirmed by the owner on 2026-10-04; humans/agents editing code or owner files still use PRs.

Secrets: `INTERVALS_API_KEY` (intervals.icu personal API key), `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (`alexanderwebber-private`),
`CLOUDFLARE_API_TOKEN` (Workers deploy), `CLOUDFLARE_ACCOUNT_ID`. No repo variables. None
committed (Principle VI).

## Alert contract (FR-010, SC-012)

- Condition: `now - last_success_at(intervals) > 24h`.
- Action: if no open issue labelled `ingest-failing`, create one titled
  `intervals.icu refresh failing since <date>` with: failure class + code, last error (sanitised, no
  secrets), likely cause, recommended action (table below), link to the failing run, last good
  timestamp. If open, append a comment at most once per 24 h. On the next success: comment
  "recovered at <time>" and close.
- Failure class -> owner action (the issue body quotes the matching row; "agent" = the coding
  agent acts, the owner only supplies what an agent cannot):

| Failure class (exit) | Detected by | Issue text / action |
|---|---|---|
| `AuthRejected` (10) | HTTP 401, or 403 with a JSON body (key revoked/regenerated) | Replace the key: agent asks the owner to generate a new API key in intervals.icu (*Settings → Developer Settings*) and supplies the `gh secret set INTERVALS_API_KEY` command. No retry loop |
| `ProviderForbidden` (12) | HTTP 403 with an HTML body (Cloudflare challenge) | Bot block, not an auth failure: agent checks the client still sends its descriptive User-Agent and whether Cloudflare rules changed (compare a local call); owner action none |
| `RateLimited` (11) | HTTP 429 (`rate_limited_until` set from `Retry-After`) | Wait: back-off is automatic; raise with the owner only if it persists > 3 days |
| `ProviderChanged` (13) | adapter parse/schema-drift errors | intervals.icu response shape changed: agent checks the OpenAPI spec, fixes the adapter and runs `process --all` (no provider calls needed for already-archived data) |
| `ArchiveUnavailable` (14) | R2 errors (credentials, quota, outage) | Check R2 credentials/bucket/quota; data is not lost (cursors only advance after writes) |
| `PublishInvalid` / `BuildFailed` (20) | gate failure on ingest output | Nothing was committed or deployed (site unchanged); agent inspects the run log and fixes the processor/schema; owner action none |
| `OwnerDataInvalid` (20) | `validate-data` failure on an owner-file push | Message names `file / entry / field`; agent corrects the YAML via PR; live site unchanged |
| `Transient` (1) | network/5xx | None; retried on the next 2-hourly run; alert only if it persists > 24 h |
- Permissions: `issues: write` on `GITHUB_TOKEN`. The agent watches the issue list at session start
  (orchestrator norm), so the owner is not asked to remember to check.

## Freshness endpoint

`GET /running/api/freshness` (Worker, R2 binding to `public/freshness.json`) ->
`200 application/json` `{"intervals":{"last_success_at":"2026-10-04T09:19:00Z"},"generated_at":"..."}`
with `Cache-Control: public, max-age=300`. Contains nothing else. Failure/absent -> `503`; the
client script then leaves the build-time "as of last site update" text and shows no stale claim
beyond what it can compute. The page script (<1 KB) renders "Last updated <relative>"
and un-hides the stale notice when `now - last_success_at` exceeds the stale threshold (`stale_after_hours` in `section.yaml`, default 12 h, baked into the page at build; FR-005/006).
