"""The read stage (specs/002-fundraising/contracts/pipeline.md; research.md R6, R7).

For each campaign without ``finished: true``, in file order: read the page, compare the figures
with the campaign's published file, and record the result in ``state/fundraising.json``. Then
``public/fundraising-freshness.json`` is rewritten from that state.

- **A failed read changes no figure** (FR-003): ``latest``, ``last_success_at`` and the published
  file stay as they are, and one campaign failing doesn't stop another.
- **``last_success_at`` means JustGiving's figures were last seen to equal the site's.** A read
  that finds different figures holds it back, and takes the published file's ``last_read_at`` if
  that is later, so the live time doesn't move until the site shows those figures (SC-005).
- **All zeros over non-zero published figures is a failed read** (``suspect_figures``).
- **A 429 or the daily quota** sets ``rate_limited_until``, and no call is made until it passes.

The summary on stdout and the logs hold counts and codes only, never a figure.
"""

import json
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from awingest.archive.base import ArchiveError, RawArchive
from awingest.errors import IngestError
from awingest.fetch import record_failure
from awingest.fundraising.campaigns import Campaign, load_campaigns
from awingest.logging import Logger
from awingest.process.overrides import OwnerDataInvalid
from awingest.process.pipeline import PUBLISHED
from awingest.providers.base import (
    FundraisingProvider,
    FundraisingSnapshot,
    ProviderError,
    RateLimited,
)
from awingest.providers.justgiving.errors import SuspectFigures
from awingest.schemas import SchemaSet
from awingest.state import (
    FUNDRAISING_FRESHNESS,
    FUNDRAISING_STATE,
    StateDoc,
    parse_utc,
    rate_limited_until,
    source_status,
    utc_iso,
)

MIN_INTERVAL_S = 1.0  # across campaigns


@dataclass
class ReadResult:
    """What a run did, in counts only (printed on stdout, read by the ``decide`` step)."""

    outcome: str = "ok"  # ok | partial | failed
    campaigns: int = 0
    read: int = 0
    changed: int = 0
    failed: int = 0
    backing_off: int = 0
    code: str | None = None
    exit_code: int = 0

    def note(self, exc: BaseException) -> None:
        """Keeps the first failure's code and exit."""
        if self.exit_code == 0:
            self.code = exc.code if isinstance(exc, IngestError) else "unexpected"
            self.exit_code = exc.exit_code if isinstance(exc, IngestError) else 1

    def fail(self, exc: BaseException) -> None:
        """A failure of the whole stage, which outranks any one campaign's."""
        self.outcome = "failed"
        self.code = exc.code if isinstance(exc, IngestError) else "unexpected"
        self.exit_code = exc.exit_code if isinstance(exc, IngestError) else 1

    def finish(self) -> None:
        if self.read < self.campaigns:
            self.outcome = "partial" if self.read else "failed"

    def summary(self) -> dict[str, Any]:
        return asdict(self)


def published_path(repo_root: Path, campaign_id: str) -> Path:
    return repo_root / PUBLISHED / "fundraising" / f"{campaign_id}.json"


def _published(repo_root: Path, campaign_id: str) -> dict[str, Any] | None:
    """The campaign's published file as the checkout holds it. The gate has validated it."""
    path = published_path(repo_root, campaign_id)
    return json.loads(path.read_bytes()) if path.is_file() else None


def _figures(snapshot: FundraisingSnapshot) -> tuple[int, int | None, int]:
    return snapshot.raised_pence, snapshot.target_pence, snapshot.supporters


def _point_figures(point: dict[str, Any]) -> tuple[int, int | None, int]:
    return point["raised_pence"], point.get("target_pence"), point["supporters"]


def _later(a: Any, b: Any) -> str | None:
    """The later of two timestamps, as stored."""
    known = [value for value in (a, b) if parse_utc(value) is not None]
    return max(known, key=parse_utc, default=None)


def _record_read(
    entry: dict[str, Any],
    snapshot: FundraisingSnapshot,
    published: dict[str, Any] | None,
    now: datetime,
) -> bool:
    """Writes a successful read into ``entry``. True if the figures differ from the site's."""
    stamp = utc_iso(now)
    entry.update(
        last_attempt_at=stamp,
        outcome="ok",
        error_class=None,
        code=None,
        message=None,
        consecutive_failures=0,
        rate_limited_until=None,
        page_status=snapshot.page_status,
        latest={
            "read_at": stamp,
            "raised_pence": snapshot.raised_pence,
            "target_pence": snapshot.target_pence,
            "supporters": snapshot.supporters,
        },
    )
    if published is not None and _point_figures(published["points"][-1]) == _figures(snapshot):
        entry["last_success_at"] = stamp
        entry.pop("first_unpublished_at", None)
        return False
    entry["outcome"] = "unpublished"
    entry.setdefault("first_unpublished_at", stamp)
    last_read = None if published is None else published["last_read_at"]
    held = _later(entry.get("last_success_at"), last_read)
    if held is not None:
        entry["last_success_at"] = held
    return True


def _suspect(snapshot: FundraisingSnapshot, published: dict[str, Any] | None) -> bool:
    if published is None or snapshot.raised_pence or snapshot.supporters:
        return False
    raised, _, supporters = _point_figures(published["points"][-1])
    return bool(raised or supporters)


def _read_one(
    provider: FundraisingProvider,
    campaign: Campaign,
    doc: StateDoc,
    result: ReadResult,
    *,
    repo_root: Path,
    log: Logger,
    now: datetime,
) -> None:
    try:
        snapshot = provider.read_page(campaign.page_url)
        published = _published(repo_root, campaign.id)
        if _suspect(snapshot, published):
            raise SuspectFigures("the total and supporters are both zero over non-zero figures")
    except Exception as exc:  # noqa: BLE001 - one campaign's failure never stops another
        # Only a classified failure's text is kept: anything else could quote what it was reading.
        failure = (
            exc if isinstance(exc, ProviderError) else ProviderError(type(exc).__name__ + " raised")
        )
        record_failure(doc, campaign.id, failure, now)
        result.failed += 1
        result.note(failure)
        log.error("read_failed", exc=failure, campaign=campaign.id)
        return
    result.read += 1
    if _record_read(source_status(doc, campaign.id), snapshot, published, now):
        result.changed += 1


def _freshness(doc: StateDoc, campaigns: list[Campaign], now: datetime) -> bytes:
    """Only active campaigns with a ``last_success_at``, and only the contract's fields."""
    entries = (doc.value.get(campaign.id) for campaign in campaigns)
    last_reads = (
        (campaign.id, entry.get("last_success_at") if isinstance(entry, dict) else None)
        for campaign, entry in zip(campaigns, entries, strict=True)
    )
    body = {
        "campaigns": {cid: {"last_read_at": when} for cid, when in last_reads if when},
        "generated_at": utc_iso(now),
    }
    return (json.dumps(body, sort_keys=True) + "\n").encode()


def run_fundraising_read(
    provider: FundraisingProvider,
    archive: RawArchive,
    *,
    repo_root: Path,
    log: Logger,
    now: datetime | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> ReadResult:
    now = now or datetime.now(UTC)
    result = ReadResult()
    try:
        schemas = SchemaSet(repo_root / "schemas")
        active = [c for c in load_campaigns(repo_root, schemas) if not c.finished]
        doc = StateDoc(archive, FUNDRAISING_STATE)
    except (OwnerDataInvalid, ArchiveError) as exc:
        log.error("read_not_started", exc=exc)
        result.fail(exc)
        return result
    if not active and not doc.value:
        log.info("read_finished", **result.summary())
        return result

    called = False
    for campaign in active:
        result.campaigns += 1
        until = rate_limited_until(doc, campaign.id, now)
        if until is not None:
            result.backing_off += 1
            result.note(RateLimited("still backing off"))
            log.warning("rate_limit_backoff", campaign=campaign.id, until=utc_iso(until))
            continue
        if called:
            sleep(MIN_INTERVAL_S)
        called = True
        _read_one(provider, campaign, doc, result, repo_root=repo_root, log=log, now=now)

    result.finish()
    try:
        doc.save()
        archive.put(FUNDRAISING_FRESHNESS, _freshness(doc, active, now))
    except ArchiveError as exc:
        log.error("state_write_failed", exc=exc)
        result.fail(exc)
    log.info("read_finished", **result.summary())
    return result
