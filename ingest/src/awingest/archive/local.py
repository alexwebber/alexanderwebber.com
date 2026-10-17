"""``LocalArchive``: the raw archive as a directory, for tests and offline development (T048).

Writes go to a temporary file in the target directory and are renamed into place, so a reader
never sees a partial object. Temporary files start with ``.``, which no key segment may, so they
never show up as objects.
"""

import os
import tempfile
import threading
from collections.abc import Iterator
from pathlib import Path

from awingest.archive.base import (
    ABSENT,
    ArchiveConflict,
    ArchiveUnavailable,
    ObjectInfo,
    etag_of,
    validate_key,
    validate_prefix,
)


class LocalArchive:
    def __init__(self, root: str | os.PathLike[str]) -> None:
        self.root = Path(root)
        self._lock = threading.Lock()

    def _path(self, key: str) -> Path:
        return self.root.joinpath(*validate_key(key).split("/"))

    def get(self, key: str) -> bytes | None:
        path = self._path(key)
        try:
            return path.read_bytes()
        except FileNotFoundError:
            return None
        except OSError as exc:
            raise ArchiveUnavailable(f"cannot read {key}: {exc.strerror}") from exc

    def put(self, key: str, data: bytes, *, if_match: str | None = None) -> str:
        path = self._path(key)
        new_etag = etag_of(data)
        with self._lock:
            current = self.get(key)
            if current is not None and etag_of(current) == new_etag:
                return new_etag
            if if_match is not None:
                current_etag = None if current is None else etag_of(current)
                expected = None if if_match == ABSENT else if_match
                if current_etag != expected:
                    raise ArchiveConflict(f"{key} changed since it was read")
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                fd, tmp = tempfile.mkstemp(prefix=".", suffix=".tmp", dir=path.parent)
                try:
                    with os.fdopen(fd, "wb") as handle:
                        handle.write(data)
                        handle.flush()
                        os.fsync(handle.fileno())
                    os.replace(tmp, path)
                except BaseException:
                    Path(tmp).unlink(missing_ok=True)
                    raise
            except OSError as exc:
                raise ArchiveUnavailable(f"cannot write {key}: {exc.strerror}") from exc
        return new_etag

    def list(self, prefix: str = "") -> Iterator[ObjectInfo]:
        validate_prefix(prefix)
        if not self.root.exists():
            return
        found = []
        for dirpath, dirnames, filenames in os.walk(self.root):
            dirnames[:] = [d for d in dirnames if not d.startswith(".")]
            for name in filenames:
                if name.startswith("."):
                    continue
                path = Path(dirpath, name)
                key = path.relative_to(self.root).as_posix()
                if key.startswith(prefix):
                    found.append((key, path))
        for key, path in sorted(found):
            data = path.read_bytes()
            yield ObjectInfo(key=key, etag=etag_of(data), size=len(data))

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)
