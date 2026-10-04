# Contract: Pipeline CLI, Workflows, Alerts, Freshness Endpoint

## CLI (`uv run awingest <command>`; structured JSON-lines logs on stderr, result summary on stdout)

| Command | Stage | Does | Exit codes |
|---|---|---|---|
| `fetch [--reimport-from D --reimport-to D] [--health-only] [--archive r2\|local]` | fetch | Load tokens from archive, list new/changed activities (+ last 14 days), archive raw, fetch health metrics since cursors, update cursors + `state/fetch-status.json` + `public/freshness.json` on success | 0 ok/partial-ok, 10 auth, 11 blocked/429 (sets `login_blocked_until`), 12 forbidden, 13 provider-changed, 14 archive, 1 other |
| `backfill [--from D] [--resume]` | fetch | Whole-history, rate-limited, resumable; intended to run on the owner's PC | same |
| `process [--all]` | publish | Normalise + sanitise raw -> published JSON, assigning opaque run IDs from the R2 ID map (incremental by manifest hash; `--all` = reprocess everything, e.g. after an adapter fix) | 0, 20 validation error |
| `publish-check` | publish | Schema-validate published tree + manifest consistency | 0, 20 |
| `alert` | alert | Evaluate `fetch-status`; open/update/close the `ingest-failing` GitHub issue | 0 |
| `login` | fetch | One interactive/credential login (password via `getpass`; honours back-off); encrypts tokens with `GARMIN_TOKEN_KEY` and stores them in R2; used for first setup and re-authorisation | 0, 10, 11 |
| `keygen` | fetch | Prints a new Fernet key to store as the `GARMIN_TOKEN_KEY` secret (never written to disk or R2) | 0 |
| `reprocess --run RUN_ID` | publish | Re-run one activity (e.g. after designating a race) | 0, 20 |

Guarantees: `fetch` decrypts the token file into a run-scoped temp dir and re-encrypts/re-uploads it only if it changed (`put` with `if_match`, so a stale writer cannot clobber a newer rotation); `fetch` never deletes archive objects; a failed/partial run leaves cursors at the last
fully successful point; `process` writes nothing if any validation fails.

## Workflows

- **`refresh.yml`** — triggers: `schedule: 17 */2 * * *`, `workflow_dispatch` (inputs
  `reimport_from`, `reimport_to`), `push` to `main` touching `data/running/owner/**`.
  `concurrency: refresh` with `cancel-in-progress: false` (runs never overlap, so two runs cannot
  race on a rotated refresh token or on bot commits; later runs queue).
  Jobs: `fetch` (if `vars.FETCH_MODE == 'actions'`) -> `publish` (`process`, run **gate**; if the
  published tree changed, commit as `github-actions[bot]` to `main`) -> `deploy`
  (`wrangler deploy`, only if gate passed and something changed or owner files changed) ->
  `alert` (always, even on failure). In `FETCH_MODE=pc` the `fetch` job is skipped and the PC task
  triggers this workflow with `gh workflow run refresh.yml` after its own `fetch`.
- **Gate** (reusable job, also `gate.yml` for pushes/PRs, no deploy on PR) = **site build + data-schema
  validation** per the constitution: install; `validate-data` (schemas + referential, incl.
  duplicate-race and ID checks); `scan-images`; **section-boundary check**
  (`check-boundaries`: `src/shared/` must not import sections, sections must not import each other);
  `astro check` + `astro build`; `scan-privacy` on `data/` and `dist/`. Any failure blocks
  commit/deploy; live site unchanged (FR-007/070). **pytest/Vitest/Playwright are not in the
  gate**: they run locally and at graduation. *Proposal for the owner (not adopted):* path-filtered
  test jobs on PRs as the BACKLOG "Broader CI" revisit.
- **`rebuild-daily.yml`** — crons `5 23 * * *` and `5 0 * * *` (UTC): gate -> deploy, so countdown +
  OG image reflect the UK date.
- **`quality.yml`** — non-blocking Lighthouse 13.5.0 CLI (mobile, via `scripts/lighthouse-budget.mjs`)
  + axe on key pages, PRs + nightly.

Bot commits to `main` (publish job, after the gate) are a narrow exception to the PR norm and
**need the owner's confirmation**; humans/agents editing code or owner files still use PRs.

Secrets/vars: `GARMIN_EMAIL`, `GARMIN_PASSWORD` (fallback login only), `GARMIN_TOKEN_KEY` (Fernet
key for the encrypted token file), `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CLOUDFLARE_API_TOKEN`
(Workers deploy), `CLOUDFLARE_ACCOUNT_ID`; var `FETCH_MODE`. None committed (Principle VI).

## Alert contract (FR-010, SC-012)

- Condition: `now - last_success_at(garmin) > 24h`.
- Action: if no open issue labelled `ingest-failing`, create one titled
  `Garmin refresh failing since <date>` with: failure class + code, last error (sanitised, no
  secrets), likely cause, recommended action (table below), link to the failing run, last good
  timestamp. If open, append a comment at most once per 24 h. On the next success: comment
  "recovered at <time>" and close.
- Failure class -> owner action (the issue body quotes the matching row; "agent" = the coding
  agent acts, the owner only supplies what an agent cannot):

| Failure class (exit) | Detected by | Issue text / action |
|---|---|---|
| `AuthRejected` (10) | tokens rejected and the single password re-login failed or is cooling down | Re-authorise: agent asks the owner to run `uv run awingest login` on their PC (password prompt); tokens land encrypted in R2. No retry loop |
| `TokenStoreUnreadable` (10) | token file fails to decrypt (wrong/rotated `GARMIN_TOKEN_KEY`, corrupt object) | Check the `GARMIN_TOKEN_KEY` secret matches the key used at `login`; if lost, run `awingest keygen` then `login` again |
| `ProviderForbidden` (12) | HTTP 403 / Cloudflare block with valid tokens | Garmin is fingerprint/IP-blocking this runner: agent checks upstream issue #444, bumps `garminconnect` + `curl_cffi`, tries the adapter's `curl_cffi` data-session flag; if blocked from Actions IPs, switch to `FETCH_MODE=pc` (Task Scheduler) |
| `RateLimited` / `LoginBlocked` (11) | HTTP 429, or `login_blocked_until` set | Wait: back-off is automatic (>= 6 h); do **not** retry logins manually; raise with the owner only if it persists > 3 days |
| `ProviderChanged` (13) | adapter parse/schema-drift errors | Garmin response shape changed: agent fixes the adapter and runs `process --all` (no Garmin calls needed for already-archived data) |
| `ArchiveUnavailable` (14) | R2 errors (credentials, quota, outage) | Check R2 credentials/bucket/quota; data is not lost (cursors only advance after writes) |
| `PublishInvalid` / `BuildFailed` (20) | gate failure on ingest output | Nothing was committed or deployed (site unchanged); agent inspects the run log and fixes the processor/schema; owner action none |
| `OwnerDataInvalid` (20) | `validate-data` failure on an owner-file push | Message names `file / entry / field`; agent corrects the YAML via PR; live site unchanged |
| `Transient` (1) | network/5xx | None; retried on the next 2-hourly run; alert only if it persists > 24 h |
- Permissions: `issues: write` on `GITHUB_TOKEN`. The agent watches the issue list at session start
  (orchestrator norm), so the owner is not asked to remember to check.

## Freshness endpoint

`GET /running/api/freshness` (Worker, R2 binding to `public/freshness.json`) ->
`200 application/json` `{"garmin":{"last_success_at":"2026-10-04T09:19:00Z"},"generated_at":"..."}`
with `Cache-Control: public, max-age=300`. Contains nothing else. Failure/absent -> `503`; the
client script then leaves the build-time "as of last site update" text and shows no stale claim
beyond what it can compute. The page script (<1 KB) renders "Last updated <relative>"
and un-hides the stale notice when `now - last_success_at` exceeds the stale threshold (`stale_after_hours` in `section.yaml`, default 12 h, baked into the page at build; FR-005/006).
