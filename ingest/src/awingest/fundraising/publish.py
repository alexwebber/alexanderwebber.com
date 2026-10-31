"""The publish stage (data-model §4): the latest figures in ``state/fundraising.json`` ->
``data/running/published/fundraising/<id>.json``, through one ``PublishedWriter``, all or nothing.

The file holds one point per UK day, with no time of day (research.md R11). ``last_read_at`` moves
when the figures change, or when a publish runs anyway and the committed value is at least 6 hours
old, so idle reads make no commit and a bot build never bakes in a false stale notice (R6). It is
always set to the read's own time, never the clock, so a failed read can't claim fresh figures
(SC-005). A finished campaign is skipped, so its file never changes again, and a file is never
deleted, even if its campaign leaves ``campaigns.yaml`` (FR-008).

This stage reads R2 and doesn't write to it. It logs counts only, never a figure.
"""

from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from awingest.archive.base import ArchiveError, ArchiveUnavailable, RawArchive
from awingest.errors import IngestError
from awingest.fetch import london_date
from awingest.fundraising.campaigns import load_campaigns
from awingest.logging import Logger
from awingest.process.overrides import OwnerDataInvalid
from awingest.process.pipeline import PUBLISHED
from awingest.publish.manifest import SCHEMA_VERSION
from awingest.publish.writer import PublishedWriter, PublishInvalid
from awingest.schemas import SchemaSet
from awingest.state import FUNDRAISING_STATE, StateDoc, parse_utc

SCHEMA = "published/fundraising-campaign"
REFRESH_AFTER = timedelta(hours=6)


@dataclass
class PublishResult:
    """Counts only (printed on stdout)."""

    outcome: str = "ok"  # ok | failed
    campaigns: int = 0
    written: int = 0
    code: str | None = None
    exit_code: int = 0

    def fail(self, exc: IngestError) -> None:
        self.outcome, self.code, self.exit_code = "failed", exc.code, exc.exit_code

    def summary(self) -> dict[str, Any]:
        return asdict(self)


def _point(latest: dict[str, Any], read_at: datetime) -> dict[str, Any]:
    point = {
        "date": london_date(read_at).isoformat(),
        "raised_pence": latest.get("raised_pence"),
        "supporters": latest.get("supporters"),
    }
    if latest.get("target_pence") is not None:
        point["target_pence"] = latest["target_pence"]
    return point


def _figures(point: dict[str, Any]) -> tuple[Any, Any, Any]:
    return point["raised_pence"], point.get("target_pence"), point["supporters"]


def next_document(
    doc: dict[str, Any] | None, campaign_id: str, latest: dict[str, Any], now: datetime
) -> dict[str, Any] | None:
    """The campaign's file after this read, or ``None`` if it stays as it is."""
    read_at = parse_utc(latest.get("read_at"))
    if read_at is None:
        raise ArchiveUnavailable(f"{FUNDRAISING_STATE}: {campaign_id} has no read time")
    point = _point(latest, read_at)
    if doc is None:  # the first read (FR-022)
        return {
            "schema_version": SCHEMA_VERSION,
            "campaign_id": campaign_id,
            "last_read_at": latest["read_at"],
            "points": [point],
        }
    last_read_at = parse_utc(doc["last_read_at"])
    if read_at <= last_read_at:
        return None  # a failed read leaves latest as it was
    last = doc["points"][-1]
    if _figures(point) == _figures(last):
        if now - last_read_at < REFRESH_AFTER:
            return None
        return doc | {"last_read_at": latest["read_at"]}
    same_day = point["date"] == last["date"]
    points = doc["points"][:-1] + [point] if same_day else [*doc["points"], point]
    return doc | {"last_read_at": latest["read_at"], "points": points}


def _existing(writer: PublishedWriter, path: str) -> dict[str, Any] | None:
    """The committed file. One that doesn't validate stops the run: replacing it would lose the
    campaign's history."""
    if writer.read_bytes(path) is None:
        return None
    doc = writer.read_json(path)
    if doc is None or writer.schemas.issues(SCHEMA, doc):
        raise PublishInvalid(f"{path}: the published file is not a valid {SCHEMA}")
    return doc


def run_fundraising_publish(
    archive: RawArchive,
    *,
    repo_root: Path,
    log: Logger,
    now: datetime | None = None,
) -> PublishResult:
    now = now or datetime.now(UTC)
    result = PublishResult()
    try:
        schemas = SchemaSet(repo_root / "schemas")
        campaigns = load_campaigns(repo_root, schemas)
        state = StateDoc(archive, FUNDRAISING_STATE).value
        writer = PublishedWriter(repo_root / PUBLISHED, schemas)
        for campaign in campaigns:
            entry = state.get(campaign.id)
            latest = entry.get("latest") if isinstance(entry, dict) else None
            if campaign.finished or not isinstance(latest, dict):
                continue
            result.campaigns += 1
            path = f"fundraising/{campaign.id}.json"
            doc = next_document(_existing(writer, path), campaign.id, latest, now)
            if doc is not None:
                writer.write_json(path, doc, SCHEMA)
        result.written = len(writer.commit().paths())
    except (OwnerDataInvalid, ArchiveError, PublishInvalid) as exc:
        log.error("publish_failed", exc=exc)
        result.fail(exc)
    log.info("publish_finished", **result.summary())
    return result
