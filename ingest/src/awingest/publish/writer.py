"""``PublishedWriter`` (T063; contracts/storage.md): the only code that writes
``data/running/published/``.

- **Validation first**: ``write_json`` validates against the named schema before accepting a
  document (the privacy second line of defence). A failure raises ``PublishInvalid`` naming the
  path, field and rule, never the value.
- **Path guard**: every path must be relative and inside the published zone.
- **Canonical JSON**: sorted keys, compact separators, no indentation, a trailing newline. The
  same data always gives the same bytes, so diffs show only real changes, and 5,000 runs stay
  around 109 MB (Spike 1b: indenting makes them ~263 MB).
- **Nothing half-written**: writes and removals are held until ``commit``, which builds the new
  tree in a staging directory beside the published one (hard links to unchanged files, so it's
  cheap) and swaps it in with two renames. A run that fails before ``commit`` leaves the tracked
  tree untouched. A crash between the two renames is repaired the next time a writer opens.
"""

import json
import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any

from awingest.errors import IngestError
from awingest.schemas import SchemaSet

STAGING_SUFFIX = ".staging"
OLD_SUFFIX = ".old"


class PublishInvalid(IngestError):
    code = "publish_invalid"
    exit_code = 20
    likely_cause = "The processor produced a published file that fails its schema."
    action = (
        "Nothing was committed or deployed (the site is unchanged). The agent inspects the run "
        "log and fixes the processor or schema; no owner action."
    )


@dataclass
class Diff:
    added: list[str] = field(default_factory=list)
    changed: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)

    def __bool__(self) -> bool:
        return bool(self.added or self.changed or self.removed)

    def paths(self) -> list[str]:
        return sorted(self.added + self.changed + self.removed)

    def counts(self) -> dict[str, int]:
        return {
            "added": len(self.added),
            "changed": len(self.changed),
            "removed": len(self.removed),
        }


def canonical_json(value: Any) -> bytes:
    text = json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )
    return (text + "\n").encode("utf-8")


def check_path(path: str) -> str:
    """A relative ``/``-separated path with no empty, ``.`` or ``..`` segments."""
    if not isinstance(path, str) or not path or "\\" in path or path.startswith("/"):
        raise PublishInvalid(f"refusing to write {path!r}: not a relative path")
    parts = PurePosixPath(path).parts
    if any(p in ("", ".", "..") or p.startswith(".") for p in parts) or "//" in path:
        raise PublishInvalid(f"refusing to write {path!r}: outside the published zone")
    return path


class PublishedWriter:
    def __init__(self, root: Path, schemas: SchemaSet) -> None:
        self.root = root
        self.schemas = schemas
        self._staging = root.with_name(root.name + STAGING_SUFFIX)
        self._old = root.with_name(root.name + OLD_SUFFIX)
        self._pending: dict[str, bytes | None] = {}
        self._recover()

    def _recover(self) -> None:
        if not self.root.exists() and self._old.exists():
            self._old.rename(self.root)  # a crash between the two renames of a commit
        for leftover in (self._staging, self._old):
            if leftover.exists():
                shutil.rmtree(leftover)

    def _target(self, path: str) -> Path:
        check_path(path)
        target = (self.root / path).resolve()
        if not target.is_relative_to(self.root.resolve()):
            raise PublishInvalid(f"refusing to write {path!r}: outside the published zone")
        return self.root / path

    def read_bytes(self, path: str) -> bytes | None:
        """The file as it would be after ``commit`` (pending changes included)."""
        if path in self._pending:
            return self._pending[path]
        target = self._target(path)
        return target.read_bytes() if target.is_file() else None

    def read_json(self, path: str) -> Any:
        data = self.read_bytes(path)
        if data is None:
            return None
        try:
            return json.loads(data)
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def exists(self, path: str) -> bool:
        return self.read_bytes(path) is not None

    def write_json(self, path: str, obj: Any, schema_name: str) -> None:
        self._target(path)
        issues = self.schemas.issues(schema_name, obj)
        if issues:
            where = "; ".join(f"{i.path or '(top level)'} fails {i.rule}" for i in issues[:10])
            raise PublishInvalid(f"{path} is not a valid {schema_name}: {where}")
        try:
            data = canonical_json(obj)
        except ValueError:
            raise PublishInvalid(f"{path}: not serialisable as JSON (NaN or infinity)") from None
        self._pending[path] = data

    def remove(self, path: str) -> None:
        self._target(path)
        self._pending[path] = None

    def files(self, prefix: str = "") -> list[str]:
        """Paths under ``prefix`` as they would be after ``commit``."""
        base = self.root / prefix if prefix else self.root
        found = set()
        if base.is_dir():
            found = {p.relative_to(self.root).as_posix() for p in base.rglob("*") if p.is_file()}
        for path, data in self._pending.items():
            if path.startswith(prefix):
                (found.add if data is not None else found.discard)(path)
        return sorted(found)

    def commit_plan(self) -> Diff:
        """What ``commit`` would change. Writes of identical bytes are not changes."""
        diff = Diff()
        for path in sorted(self._pending):
            data = self._pending[path]
            target = self.root / path
            current = target.read_bytes() if target.is_file() else None
            if data is None:
                if current is not None:
                    diff.removed.append(path)
            elif current is None:
                diff.added.append(path)
            elif current != data:
                diff.changed.append(path)
        return diff

    def discard(self) -> None:
        self._pending = {}

    def commit(self) -> Diff:
        diff = self.commit_plan()
        if not diff:
            self._pending = {}
            return diff
        try:
            self._build_staging(diff)
            if self.root.exists():
                self.root.rename(self._old)
            self._staging.rename(self.root)
        except BaseException:
            if not self.root.exists() and self._old.exists():
                self._old.rename(self.root)
            if self._staging.exists():
                shutil.rmtree(self._staging, ignore_errors=True)
            raise
        shutil.rmtree(self._old, ignore_errors=True)
        self._pending = {}
        return diff

    def _build_staging(self, diff: Diff) -> None:
        if self._staging.exists():
            shutil.rmtree(self._staging)
        if self.root.exists():
            try:
                shutil.copytree(self.root, self._staging, copy_function=os.link)
            except OSError:
                shutil.rmtree(self._staging, ignore_errors=True)
                shutil.copytree(self.root, self._staging)
        else:
            self._staging.mkdir(parents=True)
        for path in diff.added + diff.changed:
            target = self._staging / path
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(target.name + ".tmp")
            tmp.write_bytes(self._pending[path])
            os.replace(tmp, target)  # replaces the hard link, not the file it points to
        for path in diff.removed:
            target = self._staging / path
            target.unlink()
            parent = target.parent
            while parent != self._staging and not any(parent.iterdir()):
                parent.rmdir()
                parent = parent.parent
