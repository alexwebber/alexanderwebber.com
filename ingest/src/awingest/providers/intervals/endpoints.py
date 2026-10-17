"""intervals.icu endpoints (T052; contracts/provider-adapter.md).

Activity parts are returned as received, keyed by archive file name (data-model §1). Wellness is
the exception (Rule 2): each day is reduced **in memory** to the approved keys before it is
returned, so ``sleepSecs``, ``steps``, ``spO2``, sleep scores and every other key are never
archived. There is no code path for Garmin training status or race predictions (owner data).
"""

import hashlib
import json
import re
from collections.abc import Iterator
from datetime import date
from typing import Any

from awingest.providers.base import ActivityRef, ProviderChanged, RawBundle, RawHealthDay
from awingest.providers.intervals.client import ATHLETE, IntervalsClient, ResourceMissing
from awingest.providers.intervals.normalise import RUN_TYPES, start_local

# The wellness keys that map to an approved metric (FR-060–FR-062), plus the record's date.
APPROVED_WELLNESS_KEYS: tuple[str, ...] = (
    "weight",
    "bodyFat",
    "restingHR",
    "hrv",
    "vo2max",
    "ctl",
    "atl",
)


_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")


def canonical(obj: Any) -> bytes:
    """Stable bytes for a JSON value, so equal content always hashes and archives the same."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _window(oldest: date, newest: date) -> dict[str, str]:
    if oldest > newest:
        raise ValueError(f"window starts after it ends: {oldest} > {newest}")
    return {"oldest": oldest.isoformat(), "newest": newest.isoformat()}


def list_activities(client: IntervalsClient, oldest: date, newest: date) -> Iterator[ActivityRef]:
    """Running activities only (``Run``, ``TrailRun``, ``VirtualRun``; FR-009)."""
    rows, _ = client.get_json(f"/athlete/{ATHLETE}/activities", _window(oldest, newest))
    if not isinstance(rows, list):
        raise ProviderChanged("GET /athlete/{id}/activities did not return a list")
    for row in rows:
        if not isinstance(row, dict):
            raise ProviderChanged(
                "GET /athlete/{id}/activities returned a row that is not an object"
            )
        if row.get("type") not in RUN_TYPES:
            continue
        provider_id = row.get("id")
        # The ID becomes an archive key segment, so it must be a plain token.
        if not isinstance(provider_id, str) or not _ID.fullmatch(provider_id):
            raise ProviderChanged("an activity row has no id, or an id of an unexpected form")
        data = canonical(row)
        yield ActivityRef(
            provider_id=provider_id,
            start_local=start_local(row),
            row_hash=hashlib.sha256(data).hexdigest(),
            row=data,
        )


def fetch_activity(client: IntervalsClient, ref: ActivityRef) -> RawBundle:
    """Summary (the list row), detail, streams, HR time and the FIT file.

    HR time and the FIT file are optional: an activity without them (no HR strap, a manual
    entry) answers 404, and the bundle simply lacks that part.
    """
    aid = ref.provider_id
    detail, detail_bytes = client.get_json("/activity/{id}", {"intervals": "true"}, id=aid)
    if not isinstance(detail, dict):
        raise ProviderChanged("GET /activity/{id} did not return an object")
    streams, streams_bytes = client.get_json("/activity/{id}/streams.json", id=aid)
    if not isinstance(streams, list):
        raise ProviderChanged("GET /activity/{id}/streams.json did not return a list")
    parts = {"detail.json": detail_bytes, "streams.json": streams_bytes}
    try:
        _, parts["time-at-hr.json"] = client.get_json("/activity/{id}/time-at-hr", id=aid)
    except ResourceMissing:
        pass
    try:
        parts["activity.fit"] = client.get_bytes("/activity/{id}/fit-file", id=aid)
    except ResourceMissing:
        pass
    if ref.row:
        parts["summary.json"] = ref.row
    return RawBundle(ref=ref, parts=parts)


def reduce_wellness(record: dict[str, Any]) -> dict[str, Any]:
    """The approved keys that hold a value, plus the date (``id``). Everything else is dropped."""
    reduced: dict[str, Any] = {"id": record["id"]}
    for key in APPROVED_WELLNESS_KEYS:
        value = record.get(key)
        if value is not None:
            reduced[key] = value
    return reduced


def fetch_health(client: IntervalsClient, oldest: date, newest: date) -> Iterator[RawHealthDay]:
    """One record per day that has at least one approved value, reduced before it is returned."""
    records, _ = client.get_json(f"/athlete/{ATHLETE}/wellness", _window(oldest, newest))
    if not isinstance(records, list):
        raise ProviderChanged("GET /athlete/{id}/wellness did not return a list")
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("id"), str):
            raise ProviderChanged("a wellness record has no date id")
        try:
            day = date.fromisoformat(record["id"])
        except ValueError:
            raise ProviderChanged("a wellness record's id is not a date") from None
        reduced = reduce_wellness(record)
        if len(reduced) > 1:
            yield RawHealthDay(day=day, payload=canonical(reduced))
