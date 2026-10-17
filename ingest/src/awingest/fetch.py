"""The fetch stage (T054; contracts/pipeline.md, contracts/provider-adapter.md Rules 4, 5, 7).

Provider -> raw archive, incrementally by date window:

- **Window**: from each cursor's ``last_date`` minus 14 days (FR-008: recent edits are picked up)
  to today (Europe/London). With no cursor yet, the window is the last 14 days; history comes
  from ``backfill``. ``--reimport-from``/``--reimport-to`` override the window, re-fetch every
  activity in it and leave the cursors alone.
- **Change detection**: an activity's parts are fetched only when it is new or its list row
  changed. Its ``fetch.json`` marker (row hash and part names) is written after all its parts,
  so a marker means a complete set.
- **Never destructive**: nothing is deleted, and an empty part never replaces stored data. One
  activity failing is recorded and the run carries on (exit 0, outcome ``partial``).
- **Cursors** advance only after the writes they cover succeed; a partial activity run keeps
  the activity cursor where it was, so the next run retries.
- **Status**: every run updates ``state/fetch-status.json``. A successful run whose window ends
  today also sets ``last_success_at`` and rewrites ``public/freshness.json``. A 429 records
  ``rate_limited_until``; until then runs exit 11 without calling the provider.
"""

import json
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from awingest.archive.base import ArchiveError, RawArchive
from awingest.errors import IngestError
from awingest.logging import Logger, scrub
from awingest.providers.base import (
    ActivityRef,
    AuthRejected,
    Provider,
    ProviderError,
    ProviderForbidden,
    RateLimited,
    RawBundle,
    Transient,
)
from awingest.state import (
    CURSOR,
    FETCH_STATUS,
    FRESHNESS,
    StateDoc,
    parse_date,
    rate_limited_until,
    source_status,
    utc_iso,
)

LONDON = ZoneInfo("Europe/London")
RELIST_DAYS = 14  # FR-008
DEFAULT_BACKOFF_S = 900  # a 429 without Retry-After
MAX_TRANSIENT_STREAK = 3  # consecutive network failures before the run gives up
MARKER = "fetch.json"
_EMPTY = {b"", b"[]", b"{}", b"null"}

# Failures that end the run: carrying on would only repeat them.
_FATAL = (AuthRejected, ProviderForbidden, RateLimited)


@dataclass
class ActivityCounts:
    listed: int = 0
    fetched: int = 0
    unchanged: int = 0
    failed: int = 0


@dataclass
class WellnessCounts:
    days: int = 0
    written: int = 0
    unchanged: int = 0


@dataclass
class FetchResult:
    """What a run did, in counts only (printed on stdout; no IDs or values)."""

    oldest: date | None = None
    newest: date | None = None
    activities: ActivityCounts = field(default_factory=ActivityCounts)
    wellness: WellnessCounts = field(default_factory=WellnessCounts)
    outcome: str = "ok"  # ok | partial | failed
    error_class: str | None = None
    code: str | None = None
    exit_code: int = 0

    def fail(self, exc: BaseException) -> None:
        self.outcome = "failed"
        self.error_class = type(exc).__name__
        self.code = exc.code if isinstance(exc, IngestError) else "unexpected"
        self.exit_code = exc.exit_code if isinstance(exc, IngestError) else 1

    def summary(self) -> dict[str, Any]:
        out = asdict(self)
        out["oldest"] = self.oldest.isoformat() if self.oldest else None
        out["newest"] = self.newest.isoformat() if self.newest else None
        return out


def london_date(now: datetime) -> date:
    return now.astimezone(LONDON).date()


def activity_prefix(provider: str, ref: ActivityRef) -> str:
    return f"raw/{provider}/activities/{ref.provider_id}/"


def _unchanged(archive: RawArchive, prefix: str, ref: ActivityRef) -> bool:
    marker = archive.get(prefix + MARKER)
    if marker is None:
        return False
    try:
        return json.loads(marker).get("row_hash") == ref.row_hash
    except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
        return False


def archive_bundle(archive: RawArchive, prefix: str, bundle: RawBundle, log: Logger) -> None:
    for name in sorted(bundle.parts):
        data = bundle.parts[name]
        key = prefix + name
        if data.strip() in _EMPTY:
            existing = archive.get(key)
            if existing is not None and existing.strip() not in _EMPTY:
                log.warning("empty_part_kept_existing", part=name)
                continue
        archive.put(key, data)
    marker = {
        "row_hash": bundle.ref.row_hash,
        "start_local": bundle.ref.start_local.isoformat(),
        "parts": sorted(bundle.parts),
    }
    archive.put(prefix + MARKER, json.dumps(marker, sort_keys=True).encode())


def fetch_activities(
    provider: Provider,
    archive: RawArchive,
    oldest: date,
    newest: date,
    *,
    force: bool,
    log: Logger,
    counts: ActivityCounts,
) -> None:
    refs: Iterable[ActivityRef] = list(provider.list_activities(oldest, newest))
    streak = 0
    for ref in refs:
        counts.listed += 1
        prefix = activity_prefix(provider.name, ref)
        if not force and _unchanged(archive, prefix, ref):
            counts.unchanged += 1
            continue
        try:
            bundle = provider.fetch_activity(ref)
        except _FATAL:
            raise
        except ProviderError as exc:
            counts.failed += 1
            log.error("activity_failed", exc=exc)
            streak = streak + 1 if isinstance(exc, Transient) else 0
            if streak >= MAX_TRANSIENT_STREAK:
                raise
            continue
        streak = 0
        archive_bundle(archive, prefix, bundle, log)
        counts.fetched += 1


def fetch_wellness(
    provider: Provider,
    archive: RawArchive,
    oldest: date,
    newest: date,
    *,
    counts: WellnessCounts,
) -> None:
    for day in provider.fetch_health(oldest, newest):
        counts.days += 1
        key = f"raw/{provider.name}/wellness/{day.day.isoformat()}.json"
        if archive.get(key) == day.payload:
            counts.unchanged += 1
            continue
        archive.put(key, day.payload)
        counts.written += 1


def record_failure(status: StateDoc, source: str, exc: BaseException, now: datetime) -> None:
    entry = source_status(status, source)
    entry["last_attempt_at"] = utc_iso(now)
    entry["outcome"] = "failed"
    entry["error_class"] = type(exc).__name__
    entry["code"] = exc.code if isinstance(exc, IngestError) else "unexpected"
    entry["message"] = scrub(str(exc))
    entry["consecutive_failures"] += 1
    if isinstance(exc, RateLimited):
        wait = exc.retry_after if exc.retry_after is not None else DEFAULT_BACKOFF_S
        entry["rate_limited_until"] = utc_iso(now + timedelta(seconds=wait))


def record_success(
    status: StateDoc, source: str, now: datetime, *, outcome: str, failed: int, fresh: bool
) -> None:
    entry = source_status(status, source)
    entry["last_attempt_at"] = utc_iso(now)
    entry["outcome"] = outcome
    entry["failed_activities"] = failed
    entry["consecutive_failures"] = 0
    for key in ("error_class", "code", "message", "rate_limited_until"):
        entry[key] = None
    if fresh:
        entry["last_success_at"] = utc_iso(now)


def write_freshness(archive: RawArchive, source: str, now: datetime) -> None:
    """``public/freshness.json``: only ``last_success_at`` per source and ``generated_at``."""
    doc = StateDoc(archive, FRESHNESS)
    sources = {
        name: {"last_success_at": entry["last_success_at"]}
        for name, entry in doc.value.items()
        if isinstance(entry, dict) and isinstance(entry.get("last_success_at"), str)
    }
    sources[source] = {"last_success_at": utc_iso(now)}
    doc.value = sources | {"generated_at": utc_iso(now)}
    doc.save()


def run_fetch(
    provider: Provider,
    archive: RawArchive,
    *,
    log: Logger,
    now: datetime | None = None,
    reimport_from: date | None = None,
    reimport_to: date | None = None,
    health_only: bool = False,
) -> FetchResult:
    now = now or datetime.now(UTC)
    today = london_date(now)
    result = FetchResult()
    source = provider.name
    try:
        status = StateDoc(archive, FETCH_STATUS)
        cursor = StateDoc(archive, CURSOR)
    except ArchiveError as exc:
        log.error("state_unreadable", exc=exc)
        result.fail(exc)
        return result

    until = rate_limited_until(status, source, now)
    if until is not None:
        log.warning("rate_limit_backoff", until=utc_iso(until))
        result.fail(RateLimited("still backing off after a 429"))
        return result

    reimport = reimport_from is not None
    if reimport:
        newest = reimport_to or today
        act_oldest = well_oldest = reimport_from
    else:
        newest = today

        def window_start(stream: str) -> date:
            last = parse_date(cursor.value.get(stream, {}).get("last_date")) or today
            return min(last, today) - timedelta(days=RELIST_DAYS)

        act_oldest, well_oldest = window_start("activities"), window_start("wellness")
    result.oldest = well_oldest if health_only else min(act_oldest, well_oldest)
    result.newest = newest
    log.info(
        "fetch_started",
        oldest=result.oldest.isoformat(),
        newest=newest.isoformat(),
        reimport=reimport,
        health_only=health_only,
    )

    before = json.dumps(cursor.value, sort_keys=True)
    error: BaseException | None = None
    try:
        with provider.session() as session:
            if not health_only:
                fetch_activities(
                    session,
                    archive,
                    act_oldest,
                    newest,
                    force=reimport,
                    log=log,
                    counts=result.activities,
                )
                if not reimport and result.activities.failed == 0:
                    cursor.value.setdefault("activities", {})["last_date"] = newest.isoformat()
            fetch_wellness(session, archive, well_oldest, newest, counts=result.wellness)
            if not reimport:
                cursor.value.setdefault("wellness", {})["last_date"] = newest.isoformat()
    except Exception as exc:  # noqa: BLE001 - classified and recorded below
        error = exc

    try:
        if json.dumps(cursor.value, sort_keys=True) != before:
            cursor.save()
    except ArchiveError as exc:
        error = error or exc

    if error is not None:
        result.fail(error)
        log.error("fetch_failed", exc=error)
        record_failure(status, source, error, now)
    else:
        result.outcome = "partial" if result.activities.failed else "ok"
    fresh = error is None and newest >= today
    if error is None:
        record_success(
            status,
            source,
            now,
            outcome=result.outcome,
            failed=result.activities.failed,
            fresh=fresh,
        )
    try:
        status.save()
        if fresh:
            write_freshness(archive, source, now)
    except ArchiveError as exc:
        log.error("status_write_failed", exc=exc)
        if error is None:
            result.fail(exc)
    log.info("fetch_finished", **result.summary())
    return result
