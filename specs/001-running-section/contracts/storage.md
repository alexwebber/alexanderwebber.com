# Contract: Storage Abstractions

Principle IV: persistence sits behind abstractions so JSON-in-git / R2 can be replaced without
changing sections or adapters. Three small interfaces, one per zone (see data-model.md).

## `RawArchive` (Python) — private raw zone

```text
get(key) -> bytes | None
put(key, data, *, if_match=None) -> etag        # atomic: readers never see partial objects
list(prefix) -> Iterable[ObjectInfo]            # key, etag, size
exists(key) -> bool
delete(key)                                     # used only by tests/maintenance, never by ingest
```

Implementations: `R2Archive` (boto3, S3 API, endpoint from env), `LocalArchive` (directory; tests
and offline dev). Rules: keys are `/`-separated and validated (no `..`); `put` is idempotent for
identical bytes; `if_match` enables optimistic concurrency for cursor/ID-map objects
(`state/cursor.json`, `state/run-ids.json`); no credentials or tokens are ever stored in the
archive; errors map to `ArchiveUnavailable` / `ArchiveConflict`. Bucket:
`alexanderwebber-private` (`R2_*` secrets).

## `PublishedWriter` (Python) — publish stage writes the committed zone

```text
write_json(path, obj, schema_name)    # validates against schema BEFORE writing; atomic (tmp+rename);
                                      # sorted keys + compact separators, no indentation (Spike 1b:
                                      # indenting 600-point series ~2.4x the size) => canonical output
remove(path)
commit_plan() -> Diff                 # added/changed/removed files for logging
commit() -> Diff                      # stage (hard links + new files) beside the tree, swap in
read_json(path) / exists(path) / files(prefix)   # the tree as it will be after commit
```

Rules: refuses to write any path outside `data/running/published/`; refuses objects failing the
schema (privacy second line of defence); never leaves a half-written tree if a run aborts
(writes into a staging dir and swaps, or aborts before touching tracked files).

## `RunningStore` (TypeScript, `src/sections/running/data/store`) — site reads

```text
listRuns(): Run[]                         # sorted newest first
getRun(runId): Run | undefined             # runId = opaque public run ID
getRaceTrack(runId): RaceTrack | undefined
getHealthSeries(metric, range?): Point[]
getRefreshRecord(): RefreshRecord
getOwner(): { section, goals, upcomingRaces, races, overrides, exclusions, lab, manualMetrics }   # validated
```

Implementation: `JsonFileStore` (build-time, reads `data/running/`, validates every file with
ajv; a failure throws `DataValidationError{file, entry, field, message}` which fails the build with
that message, FR-070). Section code depends only on the interface, so a future DB-backed store is a
drop-in.

The store is Running's own (Principle VII): its interface, file map (`files.ts`), schema list
(`RUNNING_SCHEMAS`) and generated types live in the section. `src/shared/storage` holds only the
generic machinery any section's store is built from: `SchemaSet` (validates against the schema
names it is given), `DataIssue`/`DataValidationError`, and JSON/YAML 1.2 file reading. Each section
also owns its referential checks (Running: `src/sections/running/validate.ts`), which
`scripts/validate-data.ts` runs one section at a time.

## Contract test suite

A single parameterised suite per interface runs against every implementation: round-trip
equality, atomicity under injected failure, idempotent re-put, schema rejection (writer),
validation-error shape (store), ordering guarantees, large listing (5,000 runs) performance
sanity.
