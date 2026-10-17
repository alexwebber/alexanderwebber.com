"""The ``RawArchive`` protocol (T048; contracts/storage.md) and what its implementations share.

ETags are the MD5 hex of an object's bytes (what S3 and R2 return for a single-part put, which
is all the archive does), so ``etag_of(data)`` after a ``get`` is the value to pass as
``if_match``. ``if_match=ABSENT`` means "only if the object doesn't exist yet". A ``put`` of
bytes identical to the stored object always succeeds, so retrying a put whose response was lost
is safe. No credentials or tokens are ever stored in the archive.
"""

import hashlib
import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

from awingest.errors import IngestError

ABSENT = "*absent*"
MAX_KEY_BYTES = 1024
_SEGMENT = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9._-]*$")


class ArchiveError(IngestError):
    exit_code = 14


class ArchiveUnavailable(ArchiveError):
    code = "archive_unavailable"
    likely_cause = "The raw archive (R2) failed: credentials, quota or an outage."
    action = (
        "Check the R2 credentials, bucket and quota. No data is lost: cursors only advance "
        "after writes."
    )


class ArchiveConflict(ArchiveError):
    code = "archive_conflict"
    likely_cause = "Another writer changed a state object (cursor or run-ID map) concurrently."
    action = (
        "Runs are serialised by the refresh concurrency group, so the agent checks for a run "
        "outside it (e.g. a local backfill) and re-runs."
    )


@dataclass(frozen=True)
class ObjectInfo:
    key: str
    etag: str
    size: int


def etag_of(data: bytes) -> str:
    return hashlib.md5(data, usedforsecurity=False).hexdigest()


def validate_key(key: str) -> str:
    """A ``/``-separated relative key: no empty, ``.``-leading or ``..`` segments."""
    if not isinstance(key, str) or not key:
        raise ValueError("archive key must be a non-empty string")
    if len(key.encode()) > MAX_KEY_BYTES:
        raise ValueError(f"archive key is longer than {MAX_KEY_BYTES} bytes")
    for segment in key.split("/"):
        if not _SEGMENT.match(segment):
            raise ValueError(
                f"archive key {key!r}: each '/'-separated segment must be non-empty, must not "
                "start with '.', and may use only letters, digits, '.', '_' and '-'"
            )
    return key


def validate_prefix(prefix: str) -> str:
    """A key prefix for ``list``: empty, or a valid key optionally ending in ``/``."""
    if prefix:
        validate_key(prefix.removesuffix("/"))
    return prefix


class RawArchive(Protocol):
    def get(self, key: str) -> bytes | None:
        """The object's bytes, or None if it doesn't exist."""
        ...

    def put(self, key: str, data: bytes, *, if_match: str | None = None) -> str:
        """Write atomically and return the new ETag.

        ``if_match`` is an ETag the current object must have, or ``ABSENT``; otherwise
        ``ArchiveConflict``. Identical bytes always succeed (idempotent re-put).
        """
        ...

    def list(self, prefix: str = "") -> Iterable[ObjectInfo]:
        """Objects whose key starts with ``prefix``, in key order."""
        ...

    def exists(self, key: str) -> bool: ...

    def delete(self, key: str) -> None:
        """Remove an object (tests and maintenance only; ingest never deletes)."""
        ...
