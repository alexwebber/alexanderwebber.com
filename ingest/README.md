# awingest: Running data ingest

The Python half of the Running pipeline (constitution Principles III, IV and VI): intervals.icu →
private raw archive (R2) → sanitised JSON in `data/running/published/`. GitHub Actions runs it
every 2 hours (`.github/workflows/refresh.yml`, dispatched by the site Worker's Cloudflare cron,
with a guarded 6-hourly `schedule` as backup). The site never calls a provider. Fundraising
figures from JustGiving ride the same run; see [Fundraising](#fundraising).

Contracts: [pipeline](../specs/001-running-section/contracts/pipeline.md) (CLI, workflows,
alerts, freshness), [provider adapter](../specs/001-running-section/contracts/provider-adapter.md),
[storage](../specs/001-running-section/contracts/storage.md) and
[data files](../specs/001-running-section/contracts/data-files.md); the data model is
[data-model.md](../specs/001-running-section/data-model.md).

## Design

Two stages that meet only in the archive:

1. **Fetch** (`fetch.py`) calls the provider and archives raw parts. It never
   writes published data. Wellness is reduced to the approved keys *before* it is archived, so
   sleep, steps and SpO2 never reach R2.
2. **Process** (`process/pipeline.py`) never calls the provider. It reads the archive, normalises
   with the adapter's pure functions, sanitises and writes through `PublishedWriter`. Because it
   only needs the archive, an adapter or processor fix is applied by reprocessing.

The pieces, and what each one guarantees:

- **Provider adapter** (`providers/`): `base.py` holds the protocols, the normalised types and the
  failure taxonomy. `providers/intervals/` is the only code that knows intervals.icu's format.
  `client.py` sends a descriptive User-Agent (Cloudflare blocks Python's default one), paces
  calls, waits out a short 429 once and maps HTTP failures to the taxonomy (a 403 with an HTML
  body is a bot block, not a rejected key). `normalise.py` is pure: no I/O, and the same parts
  always give the same result.
- **Raw archive** (`archive/`): `RawArchive` with `LocalArchive` (tests, local runs) and
  `R2Archive`. Writes are atomic and conditional (`if_match`), so concurrent writers conflict
  rather than lose updates.
- **Opaque run IDs** (`process/run_ids.py`): `YYYY-MM-DD-xxxx`, from an append-only map in
  `state/run-ids.json`. That map is the only place a provider ID and a public ID meet, and it
  stays in R2. An unreadable map aborts the run rather than renumbering every published run.
- **Sanitiser** (`process/sanitise.py`): builds each published run field by field from an
  allow-list. It never reads coordinates, provider free text or provider IDs. Titles are neutral
  (`titles.py`), the date is the date only, and series use distance and elapsed time, never clock
  time. Out-of-range values are left out rather than failing the publish.
- **Writer** (`publish/writer.py`): the only code that writes the published zone. It validates
  every document against `schemas/` first, refuses paths outside the zone, writes canonical JSON,
  and swaps the whole tree in at `commit`. A failed run leaves the tracked tree untouched.
- **Incremental work**: each run's and health file's input hash covers its archived parts, the
  owner inputs that affect it and `PROCESSOR_VERSION`. Bump `PROCESSOR_VERSION` in
  `process/pipeline.py` whenever the same inputs would now publish something different; the next
  scheduled refresh then reprocesses everything with no manual step.
- **Errors and logs**: every failure is an `IngestError` subclass with a stable `code`, an exit
  code, and the `likely_cause` and `action` text the alert issue quotes (`errors.py`, `alerts.py`).
  Logs are JSON lines on stderr (`logging.py`), scrubbed of secrets, emails and provider IDs;
  stdout carries a summary of counts only.

**Failure is staleness, never an outage (Principle IV):** a fetch failure still lets the publish
stage run on what is already archived. A process failure stops before the published tree is
touched, so nothing is committed or deployed. The `ingest-failing` issue opens after 24 hours
without a successful fetch and closes on recovery.

## Fundraising

Three commands with the same split between provider, stage and storage, sharing no state or exit
paths with Running's, so a failed read on either side can't reach the other. Contracts:
[provider adapter](../specs/002-fundraising/contracts/provider-adapter.md) and
[pipeline](../specs/002-fundraising/contracts/pipeline.md).

- **Read** (`fundraising/read.py`, `fundraising-read`) calls JustGiving's official API once per
  active campaign, through `providers/justgiving/`, the only code that knows how JustGiving provides
  its figures. It writes `state/fundraising.json` and `public/fundraising-freshness.json` in R2. The
  JustGiving key is in this workflow step's `env` and nowhere else.
- **Publish** (`fundraising/publish.py`, `fundraising-publish`) applies the writing rules in
  [data-model.md](../specs/002-fundraising/data-model.md) §4 to
  `data/running/published/fundraising/<id>.json`, one point per UK day, through `PublishedWriter`.
  An unchanged read in an idle run commits nothing.
- **Alert** (`fundraising/alerts.py`, `fundraising-alert`) keeps one issue per campaign, labelled
  `fundraising-failing-<id>`, on the logic it shares with `ingest-failing`.

**No raw response is stored, anywhere, unlike Running.** Reprocessing brings nothing here, because
each read is three whole figures that can always be read again, and a stored response would hold the
owner's account identifiers and whatever JustGiving adds later (FR-011). The adapter builds a
`FundraisingSnapshot` field by field from an allow-list in memory and drops the rest. A parse failure
logs only the response's sorted key names and the field that failed.

**A failed read changes no figure.** All three steps are `continue-on-error`, because `decide` skips
an idle publish only after a green run: a red run would publish every time and look like a running
failure.

## Running it

```sh
uv sync
uv run awingest fetch --archive r2       # needs INTERVALS_API_KEY and R2_* in the environment
uv run awingest process --archive r2     # add --all to redo everything
uv run awingest publish-check            # validates data/running/published/, no archive needed
uv run awingest fundraising-read --archive local  # needs JUSTGIVING_SUBSCRIPTION_KEY
uv run awingest fundraising-publish --archive local
uv run awingest fundraising-alert --archive local  # needs GITHUB_TOKEN and GITHUB_REPOSITORY
uv run pytest                            # contract and unit tests (no network)
uv run ruff check . && uv run ruff format --check .
```

Without `--archive r2` the archive is the local folder in `AWINGEST_ARCHIVE_DIR` (default
`.archive`, gitignored).

## Tests

- `tests/contract/`: the adapters (`test_intervals_adapter.py`, `test_justgiving_adapter.py`), the
  archive suite run against both implementations (`test_raw_archive.py`, plus real R2 with
  `AWINGEST_TEST_R2_LIVE=1`), the writer, alerts against a fake GitHub API, and the shared schema
  fixtures.
- `tests/unit/`: the sanitiser (including a property test over random sentinel-laden payloads),
  run IDs, best efforts, plausibility, health, overrides, fetch, fundraising's read and publish
  rules (`test_fundraising.py`), the CLI and the pipeline end to end over the fixture archive.
- `tests/fixtures/intervals/` and `tests/fixtures/justgiving/` are synthetic: each folder's
  `make_fixtures.py` writes it and every value is invented. The privacy tests look for their
  sentinels.
