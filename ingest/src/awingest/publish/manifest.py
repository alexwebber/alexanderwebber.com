"""The manifest and refresh record (T064; data-model §3), and ``publish-check``.

``state/manifest.json`` maps each public run ID to its ``input_hash`` and path (or
``hidden: true``), and each health file (``<metric>/<yyyy>``) to its ``input_hash`` and path.
An ``input_hash`` is the sha256 of the raw inputs' ETags plus the owner overrides relevant to
the entry, so an unchanged hash means the file needs no work. ``processed_at`` changes only
when the rest of the manifest does, so a run that changes nothing changes no file.

``state/refresh.json`` is rewritten only when published data changes (FR-005 fallback).
"""

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from awingest.publish.writer import PublishedWriter
from awingest.schemas import SchemaSet

MANIFEST = "state/manifest.json"
REFRESH = "state/refresh.json"
SCHEMA_VERSION = 1

# Published file -> schema, by path (contracts/data-files.md layout).
LAYOUT: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^runs/\d{4}/\d{4}-\d{2}-\d{2}-[a-z2-7]{4}\.json$"), "published/run"),
    (re.compile(r"^race-tracks/\d{4}-\d{2}-\d{2}-[a-z2-7]{4}\.json$"), "published/race-track"),
    (re.compile(r"^health/[a-z0-9_]+/\d{4}\.json$"), "published/health-series"),
    (re.compile(r"^state/refresh\.json$"), "published/refresh"),
    (re.compile(r"^state/manifest\.json$"), "published/manifest"),
)


def input_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def run_path(run_id: str) -> str:
    return f"runs/{run_id[:4]}/{run_id}.json"


def health_path(key: str) -> str:
    return f"health/{key}.json"


@dataclass
class Manifest:
    runs: dict[str, dict[str, Any]] = field(default_factory=dict)
    health: dict[str, dict[str, Any]] = field(default_factory=dict)
    processed_at: str | None = None

    @classmethod
    def load(cls, writer: PublishedWriter) -> "Manifest":
        """The committed manifest; an absent or unusable one is empty (everything is redone)."""
        doc = writer.read_json(MANIFEST)
        if not isinstance(doc, dict) or writer.schemas.issues("published/manifest", doc):
            return cls()
        return cls(runs=doc["runs"], health=doc["health"], processed_at=doc["processed_at"])

    def body(self) -> dict[str, Any]:
        return {"runs": self.runs, "health": self.health, "schema_version": SCHEMA_VERSION}

    def doc(self, processed_at: str) -> dict[str, Any]:
        return self.body() | {"processed_at": processed_at}


def refresh_doc(*, changed_at: str, last_success_at: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "sources": {
            "intervals": {
                "last_data_change_at": changed_at,
                "last_success_at_build": last_success_at,
            }
        },
        "generated_at": changed_at,
    }


# --- publish-check ---


def check_published(root: Path, schemas: SchemaSet) -> list[str]:
    """Problems in the published tree: unknown files, schema failures, and a manifest that
    doesn't match the files. Values are never quoted."""
    problems: list[str] = []
    if not root.is_dir():
        return problems
    docs: dict[str, Any] = {}
    for file in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = file.relative_to(root).as_posix()
        schema = next((s for pattern, s in LAYOUT if pattern.match(rel)), None)
        if schema is None:
            problems.append(f"{rel}: not a published file the layout allows")
            continue
        try:
            doc = json.loads(file.read_bytes())
        except (UnicodeDecodeError, json.JSONDecodeError):
            problems.append(f"{rel}: not valid JSON")
            continue
        issues = schemas.issues(schema, doc)
        problems.extend(f"{rel}: {i.path or '(top level)'} fails {i.rule}" for i in issues[:10])
        if not issues:
            docs[rel] = doc

    runs = {rel: d for rel, d in docs.items() if rel.startswith("runs/")}
    for rel, run in runs.items():
        if rel != run_path(run["id"]) or not run["id"].startswith(run["date"] + "-"):
            problems.append(f"{rel}: path, id and date disagree")
    health = {rel: d for rel, d in docs.items() if rel.startswith("health/")}
    for rel, series in health.items():
        _, metric, year = rel.removesuffix(".json").split("/")
        if series["metric"] != metric or any(
            not p["date"].startswith(year + "-") for p in series["points"]
        ):
            problems.append(f"{rel}: metric or point dates don't match the path")

    manifest = docs.get(MANIFEST)
    if manifest is None:
        if runs or health:
            problems.append(f"{MANIFEST}: missing (or invalid) but data is published")
        return problems
    listed_runs = set()
    for run_id, entry in manifest["runs"].items():
        path = run_path(run_id)
        if entry.get("hidden"):
            if path in runs:
                problems.append(f"{path}: hidden in the manifest but published")
        elif entry.get("path") != path:
            problems.append(f"{MANIFEST}: runs.{run_id}.path should be {path}")
        elif path not in runs:
            problems.append(f"{MANIFEST}: runs.{run_id}: {path} does not exist")
        listed_runs.add(path)
    problems.extend(f"{rel}: not in the manifest" for rel in sorted(set(runs) - listed_runs))
    listed_health = set()
    for key, entry in manifest["health"].items():
        if entry["path"] != health_path(key) or entry["path"] not in health:
            problems.append(f"{MANIFEST}: health.{key}: {entry['path']} does not match a file")
        listed_health.add(entry["path"])
    problems.extend(f"{rel}: not in the manifest" for rel in sorted(set(health) - listed_health))
    for rel in docs:
        if rel.startswith("race-tracks/"):
            run = runs.get(run_path(rel.removeprefix("race-tracks/").removesuffix(".json")))
            if not run or run.get("track_ref") != rel.removesuffix(".json"):
                problems.append(f"{rel}: no published race run points at it")
    return problems
