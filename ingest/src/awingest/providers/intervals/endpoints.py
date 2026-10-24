"""intervals.icu endpoints (T052; contracts/provider-adapter.md).

Activity parts are returned as received, keyed by archive file name (data-model §1). Wellness is
the exception (Rule 2): each day is reduced **in memory** to the approved keys before it is
returned, so ``sleepSecs``, ``steps``, ``spO2``, sleep scores and every other key are never
archived. There is no code path for Garmin training status or race predictions (owner data).

Two FIT files are archived. ``activity.fit`` (``/fit-file``) is one intervals.icu generates; it
drops Garmin's ``time_in_zone`` message. ``original.fit`` (``/file``, bundle layout 2) is the file
the watch recorded, which keeps it: the source of Garmin's own heart-rate zones (T159). The
original comes back as uploaded, so a gzipped or zipped FIT is unwrapped before archiving, and an
original that isn't a FIT file at all (a TCX or GPX upload) is left out like a 404.
"""

import gzip
import hashlib
import io
import json
import re
import zipfile
from collections.abc import Iterator
from datetime import date
from typing import Any

from awingest.providers.base import ActivityRef, ProviderChanged, RawBundle, RawHealthDay
from awingest.providers.intervals.client import ATHLETE, IntervalsClient, ResourceMissing
from awingest.providers.intervals.normalise import ORIGINAL, RUN_TYPES, start_local

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

# 1: summary, detail, streams, HR time and intervals.icu's FIT file. 2: adds ``original.fit``.
BUNDLE_LAYOUT = 2
GZIP_MAGIC = b"\x1f\x8b"
ZIP_MAGIC = b"PK\x03\x04"
MAX_ORIGINAL_BYTES = 64 * 1024 * 1024  # an unwrapped original larger than this isn't a run


def is_fit(data: bytes) -> bool:
    """A FIT file starts with a 12- or 14-byte header holding ``.FIT`` at offset 8."""
    return len(data) >= 12 and data[0] in (12, 14) and data[8:12] == b".FIT"


def unwrap_fit(data: bytes) -> bytes | None:
    """The FIT file in an original as uploaded (plain, gzipped or a one-file zip), else None."""
    try:
        if data[:2] == GZIP_MAGIC:
            with gzip.GzipFile(fileobj=io.BytesIO(data)) as unzipped:
                data = unzipped.read(MAX_ORIGINAL_BYTES + 1)
        elif data[:4] == ZIP_MAGIC:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                members = [m for m in archive.infolist() if not m.is_dir()]
                if len(members) != 1 or members[0].file_size > MAX_ORIGINAL_BYTES:
                    return None
                data = archive.read(members[0])
    except (OSError, EOFError, zipfile.BadZipFile):
        return None
    return data if len(data) <= MAX_ORIGINAL_BYTES and is_fit(data) else None


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


def fetch_original(client: IntervalsClient, aid: str) -> bytes | None:
    """The watch's own FIT file, unwrapped; None for a 404 or an original that isn't FIT."""
    try:
        return unwrap_fit(client.get_bytes("/activity/{id}/file", id=aid))
    except ResourceMissing:
        return None


def fetch_activity(client: IntervalsClient, ref: ActivityRef) -> RawBundle:
    """Summary (the list row), detail, streams, HR time and both FIT files.

    HR time and the FIT files are optional: an activity without them (no HR strap, a manual
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
    original = fetch_original(client, aid)
    if original is not None:
        parts[ORIGINAL] = original
    if ref.row:
        parts["summary.json"] = ref.row
    return RawBundle(ref=ref, parts=parts)


def fetch_new_parts(client: IntervalsClient, ref: ActivityRef, layout: int) -> RawBundle:
    """The parts added since bundle ``layout``: for layout 1, the original FIT file."""
    parts: dict[str, bytes] = {}
    if layout < 2:
        original = fetch_original(client, ref.provider_id)
        if original is not None:
            parts[ORIGINAL] = original
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
