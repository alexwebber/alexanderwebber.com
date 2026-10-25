"""Pipeline state in the raw archive (data-model §1): cursors, fetch status and the public
freshness record.

Everything here except ``public/freshness.json`` is private. State objects are small JSON
documents written with ``if_match`` set to the ETag they were read with, so a concurrent writer
(a local fetch during a scheduled run) shows up as an ``ArchiveConflict`` instead of a lost
update.
"""

import json
from datetime import UTC, date, datetime
from typing import Any

from awingest.archive.base import ABSENT, ArchiveUnavailable, RawArchive, etag_of

CURSOR = "state/cursor.json"
FETCH_STATUS = "state/fetch-status.json"
FRESHNESS = "public/freshness.json"


def utc_iso(when: datetime) -> str:
    return when.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_utc(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def parse_date(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


class StateDoc:
    """One JSON state object and the ETag it was read with."""

    def __init__(self, archive: RawArchive, key: str) -> None:
        self.archive = archive
        self.key = key
        data = archive.get(key)
        self.etag = ABSENT if data is None else etag_of(data)
        try:
            value = {} if data is None else json.loads(data)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ArchiveUnavailable(f"{key} is not valid JSON") from None
        self.value: dict[str, Any] = value if isinstance(value, dict) else {}

    def save(self) -> None:
        data = (json.dumps(self.value, sort_keys=True, indent=2) + "\n").encode()
        self.etag = self.archive.put(self.key, data, if_match=self.etag)


def source_status(doc: StateDoc, source: str) -> dict[str, Any]:
    """The fetch-status entry for one source, created on first use."""
    entry = doc.value.setdefault(source, {})
    entry.setdefault("consecutive_failures", 0)
    return entry


def rate_limited_until(doc: StateDoc, source: str, now: datetime) -> datetime | None:
    """The end of a back-off still in force, if any."""
    until = parse_utc(doc.value.get(source, {}).get("rate_limited_until"))
    return until if until is not None and until > now else None
