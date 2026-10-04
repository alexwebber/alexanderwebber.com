# Contract: Provider Adapter

Principle IV: every external source sits behind an adapter that maps provider-specific data to the
site's normalised types. Nothing outside `ingest/src/awingest/providers/<name>/` may import or
depend on provider raw formats or client libraries.

## Interfaces (Python protocols, `providers/base.py`)

```text
class ActivityProvider(Protocol):
    name: str
    def list_activities(self, since: Cursor | None, limit: int | None) -> Iterable[ActivityRef]
        # running activities only (FR-009); refs carry id + start_utc + provider-etag if any
    def fetch_activity(self, ref: ActivityRef) -> RawBundle
        # returns opaque raw payload parts keyed by name (summary, details, splits, hr-zones)
    def normalise_activity(self, bundle: RawBundle) -> NormalisedActivity   # PURE, no I/O

class HealthProvider(Protocol):
    name: str
    metrics: Sequence[str]                      # APPROVED list only
    def fetch_health(self, metric: str, start: date, end: date) -> Iterable[RawHealthDay]
    def normalise_health(self, metric: str, raw: RawHealthDay) -> list[NormalisedHealthReading]  # PURE

class Provider(ActivityProvider, HealthProvider):
    def session(self, archive: RawArchive) -> ContextManager[Self]
        # loads + Fernet-decrypts tokens from archive into a temp dir, refreshes, and on exit
        # re-encrypts + re-uploads them if changed (put with if_match)
```

## Rules

1. **Raw is archived verbatim** before normalisation; `normalise_*` is pure and re-runnable, so an
   adapter fix is applied by reprocessing R2 (no Garmin calls).
2. **Approved metrics only**: `HealthProvider.metrics` is the allow-list from FR-060; the Garmin
   adapter has no code path for sleep, stress or Body Battery.
3. **Errors** are mapped to the taxonomy `AuthRejected | LoginBlocked(until) | ProviderForbidden |
   RateLimited(retry_after?) | ProviderChanged | Transient`. Provider/library exceptions never
   escape. Each carries a stable `code` and `likely_cause`/`action` text used by alerts (table in
   [pipeline.md](pipeline.md)).
4. **Incremental**: `list_activities(since=cursor)` returns only new/changed items; the fetch stage
   additionally re-lists the last 14 days (FR-008) and honours `--reimport-from/--reimport-to`.
5. **Pacing**: >= 1 s with jitter between provider calls; one login attempt per run; honour
   `login_blocked_until`. Backfill is chunked and resumable via `state/backfill.json`.
6. **Library workarounds are adapter-private**: e.g. forcing the data session onto `curl_cffi`
   impersonation (upstream issue #444) lives only in `providers/garmin/client.py`, behind a flag
   settled by Spike 0.
7. **Partial failure**: a failure on one activity records it and continues; nothing already in the
   archive is deleted or overwritten with empty data (FR-007).

## Identity: provider IDs stay private

Adapters expose the provider's own identifier only as `provider_id` on `ActivityRef` /
`NormalisedActivity`. Assigning the **opaque public run ID** (`YYYY-MM-DD-xxxx`) is the
processor's job (`process/run_ids.py`, map in R2 `state/run-ids.json`), not the adapter's, so no
provider ID can reach a published file. Contract tests assert the adapter never emits a public ID
and the processor never emits a provider ID.

## Normalised output contract (tested)

`NormalisedActivity` / `NormalisedHealthReading` fields per [data-model.md](../data-model.md) §2.
Contract tests (per provider, against synthetic recorded fixtures) assert: required fields present;
units normalised (metres, seconds, kg, bpm); `type` mapped to `road|track|trail|indoor`; non-run
activities rejected; missing optional metrics are `None` (never 0); timestamps converted to
Europe/London; and the same fixture always yields identical output (determinism).

## Adding a provider

Implement the protocols, add fixtures + run the contract suite, register in
`providers/__init__.py`. No change to processor, schemas or site.
