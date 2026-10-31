# Contract: Fundraising CLI, Workflow, Alerts, Freshness Route

Extends Running's [pipeline contract](../../001-running-section/contracts/pipeline.md). The reasoning
is in [research.md](../research.md) R4, R6 and R10.

## CLI

JSON-lines logs on stderr, a one-line summary on stdout, as for the other commands.

| Command | Stage | Does | Exit codes |
|---|---|---|---|
| `fundraising-read [--archive r2\|local] [--repo-root P]` | read | For each campaign without `finished: true`: read the page, compare with the published file, update `state/fundraising.json` and `public/fundraising-freshness.json`. One campaign failing doesn't stop another. No campaigns: exits 0 with no calls | 0 ok; otherwise the first failure's class exit (1, 10, 11, 12, 13, 15), and 11 when a campaign is only backing off; 14 archive; 20 invalid owner file |
| `fundraising-publish [--archive r2\|local] [--repo-root P]` | publish | Apply the writing rules ([data-model.md](../data-model.md) §4) through `PublishedWriter`, validating against the schema first. All or nothing per run | 0; 14 archive; 20 invalid owner file or published document |
| `fundraising-alert [--archive r2\|local] [--repo-root P]` | alert | Keep each campaign's issue in step with `state/fundraising.json` | 0; 1 GitHub API; 14 archive; 20 invalid owner file |

`publish-check` gains `^fundraising/[a-z0-9-]+\.json$` in its `LAYOUT` and checks that `campaign_id`
matches the file name and `points` are sorted and unique.

Read summary, parsed by `decide` (counts only, no figures):

```json
{ "outcome": "ok", "campaigns": 1, "read": 1, "changed": 0, "failed": 0, "backing_off": 0, "code": null, "exit_code": 0 }
```

`changed` counts campaigns whose figures differ from the published file, or that have no file yet.
`outcome` is `ok` when every campaign was read, `partial` when some weren't, and `failed` when none could
be, as for `FetchResult`. A campaign backing off counts as not read.

**Guarantees**: a failed read changes no figure in R2 or git (FR-003). `fundraising-publish` never
deletes a file. No command writes anything from the response but the allow-listed fields.

## `refresh.yml` changes

No new job, trigger or schedule (FR-002). Owner pushes, the Worker's cron and manual dispatches all
reach these steps.

**`fetch` job**, after `uv sync`, before the intervals.icu step:

```yaml
- name: Read fundraising figures (JustGiving -> R2)
  id: fundraising
  if: ${{ github.ref == 'refs/heads/main' }}   # a branch run must not write campaign state
  continue-on-error: true                      # FR-003: never turns the run red or stops a fetch
  timeout-minutes: 2                           # the job's 30 minutes also hold the 25-minute fetch
  shell: bash
  env:
    JUSTGIVING_SUBSCRIPTION_KEY: ${{ secrets.JUSTGIVING_SUBSCRIPTION_KEY }}
    R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
    R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_BUCKET: ${{ secrets.R2_BUCKET }}
  run: uv run --no-sync awingest fundraising-read --archive r2 | tee "$RUNNER_TEMP/fundraising-summary.json"
```

**`fetch` job**, after the existing `Alert` step: `fundraising-alert`, with `if: ${{ always() &&
github.ref == 'refs/heads/main' }}`, `continue-on-error: true`, `timeout-minutes: 1`, and `GITHUB_TOKEN`
plus the `R2_*` secrets. It has no JustGiving key, so the key and the GitHub token never share a step.

**`decide` step**: one new reason, after `daily`:

```bash
elif jq -e '(.changed // 0) > 0' "$RUNNER_TEMP/fundraising-summary.json" >/dev/null 2>&1; then
  reason='fundraising figures changed'
```

If the summary is missing or empty, this branch doesn't fire: a broken read has no figures to publish, and
the rest of `decide` carries on unchanged, so it can't affect running.

**`publish` job**, after `Process`, before `Publish check`:

```yaml
- name: Publish fundraising figures (R2 -> data/running/published/fundraising/)
  working-directory: ingest
  continue-on-error: true
  timeout-minutes: 2
  env: { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET }   # as for Process
  run: uv run --no-sync awingest fundraising-publish --archive r2
```

`Check changed paths`, the `commit` job and `deploy` need no change: the new files sit under
`data/running/published/`, and a commit deploys.

**A static check** (Vitest, `tests/contract/refresh-workflow.test.ts`) parses `refresh.yml` and fails
if `JUSTGIVING_SUBSCRIPTION_KEY` appears anywhere but that one step, if any of the three fundraising steps loses
`continue-on-error`, or if the read step moves after the intervals.icu fetch. `tests.yml`'s Vitest path
filter gains `\.github/workflows` (the group's `/` follows it), so a workflow change runs it.

**Secrets**: one new repo secret, `JUSTGIVING_SUBSCRIPTION_KEY`, already set. `JUSTGIVING_REALM` isn't
a secret and isn't set in Actions.

## Alert contract (FR-006)

One issue per campaign, label `fundraising-failing-<campaign-id>`, title `<charity> fundraising
figures failing since <date>`. The open, comment-once-a-day and close logic is shared with
`ingest-failing`.

A campaign's issue opens when any of these holds:

| Condition | When |
|---|---|
| `code` is `page_not_found` | At once, even if the page used to work |
| `page_status` is set and isn't `Active` | At once |
| Never read successfully, and the last attempt failed | At once (as Running) |
| `now - last_success_at > 24 h` | The usual rule. This covers failing reads and figures that aren't reaching the site |
| No `last_success_at`, and `now - first_unpublished_at > 24 h` | A first read that never published |

- **Body**: as `ingest-failing`: failure class and code, last error (scrubbed), likely cause, action,
  last good time, consecutive failures, run link. The texts are in
  [provider-adapter.md](provider-adapter.md).
- **Closes** on recovery with "Recovered at <time>", when the campaign is marked `finished`, or when its
  campaign has left `campaigns.yaml`.
- Running's `ingest-failing` issue and this one are unrelated: either can be open without the other.
- `GitHubIssues` takes its label as a constructor argument. The label is created on first use.

The agent already reads open issues at session start, so the owner has nothing to check.

## Freshness route

`GET /running/api/fundraising-freshness` (Worker, in `src/worker/fundraising-freshness.ts`, dispatched
from `freshness.ts`; `run_worker_first: ["/running/api/*"]` already covers it) reads
`public/fundraising-freshness.json` from R2 through the existing binding.

- `200 application/json`, `Cache-Control: public, max-age=300`:
  `{"campaigns":{"brighton-2027":{"last_read_at":"2026-11-10T09:17:03Z"}},"generated_at":"..."}`.
- Re-shaped, like `/running/api/freshness`: only campaign IDs matching the slug pattern and
  second-precision UTC timestamps pass; anything else is dropped.
- Missing or malformed: `503`, `no-store`. `HEAD` is answered; other methods get 405.
- `/running/api/freshness` doesn't change.

**The page script** (under 1 KB, inlined, on pages showing an active campaign's figures): one fetch,
then for each `[data-fundraising-updated]` block, take the later of the live time and the block's
`data-read-ms`. If it's newer than the build's time, show "Figures updated 2 hours ago"; if the build's
time is still current, leave the text alone (AGENT_TIPS, *Astro*). Show or hide the notice by age
against `data-stale-ms`. On 503 or offline, nothing changes. As in `LastUpdated`, the instant is
carried as epoch milliseconds.
