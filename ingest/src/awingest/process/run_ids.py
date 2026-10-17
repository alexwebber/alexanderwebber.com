"""Opaque public run IDs (T056; data-model §3).

A public run ID is the run's local date plus four random base32 characters, e.g.
``2026-10-17-k3f7``. The map from provider activity ID to public run ID lives only in the private
archive (``state/run-ids.json``); it is the one place the two meet. It is **append-only**: an ID,
once assigned, is never reassigned or removed, so run page URLs and the owner's references to
them stay valid. The map is written with ``if_match``, so a concurrent writer is a conflict, not
a lost update.

If the map can't be read (an archive failure, bad JSON, or a malformed entry) the processor
aborts rather than starting a fresh map, which would give every published run a new ID.
"""

import json
import re
import secrets
from collections.abc import Callable
from datetime import date

from awingest.archive.base import ABSENT, ArchiveUnavailable, RawArchive, etag_of

RUN_IDS = "state/run-ids.json"
ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"
SUFFIX_LENGTH = 4
RUN_ID = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z2-7]{4}$")
_MAX_DRAWS = 10_000


def random_suffix() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(SUFFIX_LENGTH))


class RunIdMap:
    """The provider-ID -> public-run-ID map, read once and saved once per process run."""

    def __init__(self, archive: RawArchive, *, draw: Callable[[], str] = random_suffix) -> None:
        self._archive = archive
        self._draw = draw
        data = archive.get(RUN_IDS)  # an ArchiveUnavailable here aborts the run
        self.absent = data is None
        self._etag = ABSENT if data is None else etag_of(data)
        self._ids: dict[str, str] = {} if data is None else self._parse(data)
        self._used = set(self._ids.values())
        self._added: dict[str, str] = {}

    @staticmethod
    def _parse(data: bytes) -> dict[str, str]:
        unreadable = ArchiveUnavailable(
            f"{RUN_IDS} is unreadable; refusing to regenerate public run IDs"
        )
        try:
            value = json.loads(data)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise unreadable from None
        if not isinstance(value, dict):
            raise unreadable
        if not all(
            isinstance(k, str) and k and isinstance(v, str) and RUN_ID.match(v)
            for k, v in value.items()
        ):
            raise unreadable
        if len(set(value.values())) != len(value):
            raise unreadable  # two activities sharing a public ID: the map is corrupt
        return value

    def __len__(self) -> int:
        return len(self._ids)

    @property
    def added(self) -> int:
        return len(self._added)

    def get(self, provider_id: str) -> str | None:
        return self._ids.get(provider_id)

    def provider_id(self, run_id: str) -> str | None:
        """The provider ID behind a public run ID (``reprocess --run``)."""
        return next((p for p, r in self._ids.items() if r == run_id), None)

    def assign(self, provider_id: str, day: date) -> str:
        """The activity's public ID, drawing a new one (unique for its date) if it has none."""
        existing = self._ids.get(provider_id)
        if existing is not None:
            return existing
        for _ in range(_MAX_DRAWS):
            candidate = f"{day.isoformat()}-{self._draw()}"
            if RUN_ID.match(candidate) and candidate not in self._used:
                break
        else:
            raise RuntimeError(f"no free run ID for {day.isoformat()}")
        self._ids[provider_id] = candidate
        self._added[provider_id] = candidate
        self._used.add(candidate)
        return candidate

    def save(self) -> None:
        """Write the new entries (a no-op if none were added)."""
        if not self._added:
            return
        data = (json.dumps(self._ids, sort_keys=True, indent=1) + "\n").encode()
        self._etag = self._archive.put(RUN_IDS, data, if_match=self._etag)
        self._added = {}
