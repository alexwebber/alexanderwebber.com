# Contract: Provider Adapter

Principle IV: every external source sits behind an adapter that maps provider-specific data to the
site's normalised types. Nothing outside `ingest/src/awingest/providers/<name>/` may import or
depend on provider raw formats or client code. The first (and only) provider is **intervals.icu**
(`providers/intervals/`), an official Garmin sync partner (research.md R0). Garmin direct is
reconsidered only if intervals.icu cannot supply something required.

## Interfaces (Python protocols, `providers/base.py`)

```text
class ActivityProvider(Protocol):
    name: str
    def list_activities(self, oldest: date, newest: date) -> Iterable[ActivityRef]
        # running activities only (FR-009): Run, TrailRun, VirtualRun; refs carry id +
        # start_date_local + a hash of the list row (change detection) + the row itself
    def fetch_activity(self, ref: ActivityRef) -> RawBundle
        # opaque raw payload parts keyed by archive file name (summary.json, detail.json,
        # streams.json, time-at-hr.json, activity.fit); HR time and FIT are optional (404)
    def normalise_activity(self, bundle: RawBundle) -> NormalisedActivity   # PURE, no I/O

class HealthProvider(Protocol):
    name: str
    metrics: Sequence[str]                      # APPROVED list only
    def fetch_health(self, oldest: date, newest: date) -> Iterable[RawHealthDay]
        # one record per day, already reduced to approved keys (see Rule 2)
    def normalise_health(self, raw: RawHealthDay) -> list[NormalisedHealthReading]  # PURE

class Provider(ActivityProvider, HealthProvider):
    def session(self) -> ContextManager[Self]
        # opens the HTTP client (API key from env INTERVALS_API_KEY, User-Agent set); no tokens
```

## intervals.icu specifics (`providers/intervals/`)

- **Auth**: HTTP Basic, user `API_KEY`, password = `INTERVALS_API_KEY`; athlete `0` = the key's own
  athlete. The key never appears in logs, raw objects or errors.
- **User-Agent (MUST)**: every request sends a descriptive User-Agent, e.g.
  `alexanderwebber.com-ingest/<version> (+https://alexanderwebber.com)`. Cloudflare in front of
  intervals.icu returns 403 with an HTML challenge page for Python's default `Python-urllib/x.y`.
- **Endpoints** (OpenAPI 3: `https://intervals.icu/api/v1/docs`):
  - `GET /athlete/0/activities?oldest=&newest=` — list (filtered to running types).
  - `GET /activity/{id}?intervals=true` — detail (HR zone times `icu_hr_zone_times`, running
    dynamics `average_stance_time`/`_balance`, `average_vertical_oscillation`/`_ratio`,
    `average_stride`, `device_watts`, `icu_training_load`, `race`, `type`, `trainer`).
  - `GET /activity/{id}/streams.json` — `time`, `distance`, `velocity_smooth`, `heartrate`,
    `cadence`, `altitude`, `watts`, dynamics streams (incl. `stance_time_balance`), `latlng`.
    Ground-contact balance comes from the summary field when present, else is derived from the
    `stance_time_balance` stream.
  - `GET /activity/{id}/time-at-hr` — HR zone breakdown.
  - `GET /activity/{id}/fit-file` — FIT file, archived verbatim (not parsed).
  - `GET /athlete/0/wellness?oldest=&newest=` — per-day `weight`, `bodyFat`, `restingHR`, `hrv`
    (rMSSD), `vo2max`, `ctl`, `atl`.
- **Type mapping**: `Run` -> `road`, `TrailRun` -> `trail`, `VirtualRun` -> `indoor` with
  `treadmill: true`; `trainer: true` on a non-`VirtualRun` run -> `indoor` without `treadmill`;
  every other type is rejected (FR-009).
- **Not supplied** (so not in the adapter): Garmin training status and race predictions (owner
  entries, `owner/manual-metrics.yaml`), Garmin training effect, HRV baseline, stress, Body Battery.

## Rules

1. **Raw is archived verbatim** before normalisation (exception: Rule 2); `normalise_*` is pure and
   re-runnable, so an adapter fix is applied by reprocessing R2 (no provider calls). Activity
   streams and FIT files archived privately may contain in-activity respiration/SpO2 readings;
   they are never normalised into published fields, and the privacy scan covers published data
   (FR-015).
2. **Approved metrics only**: `HealthProvider.metrics` is the allow-list from FR-060–FR-062
   (`weight_kg`, `body_fat_pct`, `resting_hr`, `hrv`, `vo2max`, `fitness_ctl`, `fatigue_atl`).
   intervals.icu returns whole-day wellness records, so the adapter keeps only the approved keys
   **in memory before archiving**; the wellness keys `sleepSecs`, `steps`, `spO2`, sleep scores and
   every other key are never archived or processed (FR-015).
3. **Errors** are mapped to the taxonomy `AuthRejected | ProviderForbidden | RateLimited(retry_after?) |
   ProviderChanged | Transient`. HTTP 401, or 403 with a JSON body -> `AuthRejected`; **403 with an
   HTML body -> `ProviderForbidden`** (Cloudflare bot block, not an auth failure); 429 ->
   `RateLimited`; parse/shape errors -> `ProviderChanged`; network/5xx -> `Transient`.
   Library/HTTP exceptions never escape. Each carries a stable `code` and `likely_cause`/`action`
   text used by alerts (table in [pipeline.md](pipeline.md)).
4. **Incremental by date window**: the fetch stage calls `list_activities(oldest=cursor - 14 days,
   newest=today)` (FR-008 re-list) and fetches parts only for new activities or ones whose list-row
   hash changed; wellness is re-fetched over the same window. `--reimport-from/--reimport-to`
   override the window.
5. **Pacing**: >= 1 s with jitter between provider calls; on 429 honour `Retry-After` and record
   `rate_limited_until` in `state/fetch-status.json`. Backfill is chunked and resumable via
   `state/backfill.json`.
6. **Provider quirks are adapter-private**: the User-Agent, Basic-auth details and the HTML-vs-JSON
   403 distinction live only in `providers/intervals/client.py`.
7. **Partial failure**: a failure on one activity records it and continues; nothing already in the
   archive is deleted or overwritten with empty data (FR-007).

## Identity: provider IDs stay private

Adapters expose the provider's own identifier (intervals.icu activity ID; Garmin's `external_id`
is never surfaced) only as `provider_id` on `ActivityRef` / `NormalisedActivity`. Assigning the
**opaque public run ID** (`YYYY-MM-DD-xxxx`) is the processor's job (`process/run_ids.py`, map in
R2 `state/run-ids.json`), not the adapter's, so no provider ID can reach a published file.
Contract tests assert the adapter never emits a public ID and the processor never emits a provider
ID.

## Normalised output contract (tested)

`NormalisedActivity` / `NormalisedHealthReading` fields per [data-model.md](../data-model.md) §2.
Contract tests (per provider, against synthetic fixtures shaped from the Spike 0 payloads) assert:
required fields present; units normalised (metres, seconds, kg, bpm); `type` mapped to
`road|track|trail|indoor` and `VirtualRun` -> `treadmill: true`; non-run activities rejected;
missing optional metrics are `None` (never 0); per-km splits computed from streams; timestamps
converted to Europe/London; non-approved wellness keys absent from archived and normalised output;
403-HTML vs 401/403-JSON error mapping; the User-Agent header always set; and the same fixture
always yields identical output (determinism).

## Adding a provider

Implement the protocols, add fixtures + run the contract suite, register in
`providers/__init__.py`. No change to processor, schemas or site.
