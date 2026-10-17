"""Whole-history backfill (T055; contracts/pipeline.md).

Walks date windows of ``WINDOW_DAYS`` from ``--from`` (default ``DEFAULT_FROM``) to today,
fetching activities and wellness exactly as the fetch stage does (unchanged activities are
skipped, so a re-run is cheap). Progress is saved to ``state/backfill.json`` after every window,
so ``--resume`` carries on after an interruption, a 429 or an outage. Windows with failed
activities are listed in ``failed_windows`` for a later ``backfill --from``.

The backfill never moves the fetch cursors backwards: when it completes it sets them to its end
date only if no scheduled fetch has set them yet. It doesn't touch ``last_success_at`` or
``public/freshness.json``, which describe the regular refresh.
"""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

from awingest.archive.base import ArchiveError, RawArchive
from awingest.errors import IngestError
from awingest.fetch import (
    ActivityCounts,
    WellnessCounts,
    fetch_activities,
    fetch_wellness,
    london_date,
    record_failure,
)
from awingest.logging import Logger
from awingest.providers.base import Provider, RateLimited
from awingest.state import (
    BACKFILL,
    CURSOR,
    FETCH_STATUS,
    StateDoc,
    parse_date,
    rate_limited_until,
    utc_iso,
)

DEFAULT_FROM = date(2000, 1, 1)
WINDOW_DAYS = 90


@dataclass
class BackfillResult:
    start: date | None = None
    end: date | None = None
    windows: int = 0
    activities: ActivityCounts = field(default_factory=ActivityCounts)
    wellness: WellnessCounts = field(default_factory=WellnessCounts)
    failed_windows: int = 0
    complete: bool = False
    outcome: str = "ok"
    error_class: str | None = None
    code: str | None = None
    exit_code: int = 0

    def fail(self, exc: BaseException) -> None:
        self.outcome = "failed"
        self.error_class = type(exc).__name__
        self.code = exc.code if isinstance(exc, IngestError) else "unexpected"
        self.exit_code = exc.exit_code if isinstance(exc, IngestError) else 1

    def summary(self) -> dict[str, Any]:
        return {
            "start": self.start.isoformat() if self.start else None,
            "end": self.end.isoformat() if self.end else None,
            "windows": self.windows,
            "activities": vars(self.activities),
            "wellness": vars(self.wellness),
            "failed_windows": self.failed_windows,
            "complete": self.complete,
            "outcome": self.outcome,
            "error_class": self.error_class,
            "code": self.code,
            "exit_code": self.exit_code,
        }


def _add(total: dict[str, int], counts: object) -> None:
    for key, value in vars(counts).items():
        total[key] = total.get(key, 0) + value


def run_backfill(
    provider: Provider,
    archive: RawArchive,
    *,
    log: Logger,
    start: date | None = None,
    resume: bool = False,
    now: datetime | None = None,
    window_days: int = WINDOW_DAYS,
) -> BackfillResult:
    now = now or datetime.now(UTC)
    today = london_date(now)
    result = BackfillResult()
    source = provider.name
    try:
        status = StateDoc(archive, FETCH_STATUS)
        progress = StateDoc(archive, BACKFILL)
    except ArchiveError as exc:
        log.error("state_unreadable", exc=exc)
        result.fail(exc)
        return result

    until = rate_limited_until(status, source, now)
    if until is not None:
        log.warning("rate_limit_backoff", until=utc_iso(until))
        result.fail(RateLimited("still backing off after a 429"))
        return result

    state = progress.value
    if resume and state.get("next") and not state.get("completed_at"):
        log.info("backfill_resumed", next=state["next"], end=state.get("to"))
    else:
        first = start or DEFAULT_FROM
        state.clear()
        state.update(
            {
                "from": first.isoformat(),
                "to": today.isoformat(),
                "next": first.isoformat(),
                "started_at": utc_iso(now),
                "completed_at": None,
                "windows_done": 0,
                "activities": {},
                "wellness": {},
                "failed_windows": [],
            }
        )
    end = parse_date(state.get("to")) or today
    cursor_day = parse_date(state.get("next")) or DEFAULT_FROM
    result.start, result.end = parse_date(state.get("from")), end
    log.info("backfill_started", start=cursor_day.isoformat(), end=end.isoformat())

    error: BaseException | None = None
    try:
        with provider.session() as session:
            while cursor_day <= end:
                window_end = min(cursor_day + timedelta(days=window_days - 1), end)
                acts, well = ActivityCounts(), WellnessCounts()
                try:
                    fetch_activities(
                        session, archive, cursor_day, window_end, force=False, log=log, counts=acts
                    )
                    fetch_wellness(session, archive, cursor_day, window_end, counts=well)
                finally:
                    for target, counts in ((result.activities, acts), (result.wellness, well)):
                        for key, value in vars(counts).items():
                            setattr(target, key, getattr(target, key) + value)
                _add(state.setdefault("activities", {}), acts)
                _add(state.setdefault("wellness", {}), well)
                if acts.failed:
                    state.setdefault("failed_windows", []).append(
                        [cursor_day.isoformat(), window_end.isoformat()]
                    )
                cursor_day = window_end + timedelta(days=1)
                state["next"] = cursor_day.isoformat()
                state["windows_done"] = state.get("windows_done", 0) + 1
                state["updated_at"] = utc_iso(datetime.now(UTC))
                progress.save()
                result.windows += 1
                log.info("backfill_window_done", end=window_end.isoformat(), **vars(acts))
    except Exception as exc:  # noqa: BLE001 - recorded below; progress so far is kept
        error = exc

    try:
        if error is None:
            state["completed_at"] = utc_iso(now)
            progress.save()
            cursor = StateDoc(archive, CURSOR)
            changed = False
            for stream in ("activities", "wellness"):
                entry = cursor.value.setdefault(stream, {})
                if not entry.get("last_date"):
                    entry["last_date"] = end.isoformat()
                    changed = True
            if changed:
                cursor.save()
        else:
            record_failure(status, source, error, now)
            status.save()
    except ArchiveError as exc:
        log.error("state_write_failed", exc=exc)
        error = error or exc

    result.failed_windows = len(state.get("failed_windows", []))
    result.complete = error is None
    if error is not None:
        result.fail(error)
        log.error("backfill_failed", exc=error)
    elif result.failed_windows:
        result.outcome = "partial"
    log.info("backfill_finished", **result.summary())
    return result
