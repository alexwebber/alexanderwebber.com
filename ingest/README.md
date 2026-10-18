# awingest: Running data ingest

The Python half of the Running pipeline (constitution Principles III, IV and VI): intervals.icu →
private raw archive (R2) → sanitised JSON in `data/running/published/`. GitHub Actions runs it
every 2 hours (`.github/workflows/refresh.yml`). The site never calls a provider.

Contracts: [pipeline](../specs/001-running-section/contracts/pipeline.md) (CLI, workflows,
alerts, freshness), [provider adapter](../specs/001-running-section/contracts/provider-adapter.md),
[storage](../specs/001-running-section/contracts/storage.md) and
[data files](../specs/001-running-section/contracts/data-files.md); the data model is
[data-model.md](../specs/001-running-section/data-model.md).

## Design

Two stages that meet only in the archive:

1. **Fetch** (`fetch.py`, `backfill.py`) calls the provider and archives raw parts. It never
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

## Running it

```sh
uv sync
uv run awingest fetch --archive r2       # needs INTERVALS_API_KEY and R2_* in the environment
uv run awingest process --archive r2     # add --all to redo everything
uv run awingest publish-check            # validates data/running/published/, no archive needed
uv run pytest                            # contract and unit tests (no network)
uv run ruff check . && uv run ruff format --check .
```

Without `--archive r2` the archive is the local folder in `AWINGEST_ARCHIVE_DIR` (default
`.archive`, gitignored).

## Tests

- `tests/contract/`: the adapter (`test_intervals_adapter.py`), the archive suite run against
  both implementations (`test_raw_archive.py`, plus real R2 with `AWINGEST_TEST_R2_LIVE=1`), the
  writer, alerts against a fake GitHub API, and the shared schema fixtures.
- `tests/unit/`: the sanitiser (including a property test over random sentinel-laden payloads),
  run IDs, best efforts, plausibility, health, overrides, fetch, backfill, the CLI and the
  pipeline end to end over the fixture archive.
- `tests/fixtures/intervals/` is synthetic: `make_fixtures.py` writes it and every value is
  invented. The privacy tests look for its sentinels.
