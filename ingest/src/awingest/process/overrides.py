"""The owner files the processor needs (T061): run overrides, health exclusions, the run-linked
race entries and the goal distances.

Each file is read with YAML 1.2 rules (``awingest.yaml12``, as the site reads it) and validated
against its schema; any problem raises ``OwnerDataInvalid`` naming the file, entry and field,
before anything is written. A missing file means no entries. Cross-file checks (an override
naming a run that doesn't exist, a duplicate race) are the gate's ``validate-data``; only the
ones that would make processing ambiguous are repeated here.

``run_hash`` is the per-run override hash in each manifest entry's ``input_hash``: it changes
exactly when an owner change affects that run's published file.
"""

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from awingest import yaml12
from awingest.distances import parse_distance
from awingest.errors import IngestError
from awingest.schemas import SchemaSet

OWNER_FILES = {
    "run-overrides.yaml": "owner/run-overrides",
    "health-exclusions.yaml": "owner/health-exclusions",
    "goals.yaml": "owner/goals",
}


class OwnerDataInvalid(IngestError):
    code = "owner_data_invalid"
    exit_code = 20
    likely_cause = "An owner file in data/running/owner/ fails validation."
    action = (
        "The message names file / entry / field: the agent corrects the YAML via PR. The live "
        "site is unchanged."
    )

    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class RunOverride:
    title: str | None = None
    note: str | None = None
    hide: bool = False
    exclude_from_records: bool = False
    include_in_records: bool = False
    is_race: bool | None = None
    device: str | None = None


@dataclass(frozen=True)
class RaceLink:
    """A ``races/<slug>/race.yaml`` entry with a ``run_id``: details for a recorded race."""

    slug: str
    name: str | None = None
    designate: str | None = None  # "race" | "not_race"
    hide_map: bool = False
    trim_ends_m: float = 0


@dataclass(frozen=True)
class OwnerInputs:
    runs: dict[str, RunOverride] = field(default_factory=dict)
    races: dict[str, RaceLink] = field(default_factory=dict)
    exclusions: frozenset[tuple[str, date]] = frozenset()
    goal_distances: tuple[float, ...] = ()

    def override(self, run_id: str) -> RunOverride:
        return self.runs.get(run_id, RunOverride())

    def run_hash(self, run_id: str) -> str:
        override = self.runs.get(run_id)
        race = self.races.get(run_id)
        doc = {
            "override": None if override is None else asdict(override),
            "race": None if race is None else asdict(race),
            "goal_distances": list(self.goal_distances),
        }
        return _sha256(doc)

    def exclusion_hash(self, metric: str, start: date, end: date) -> str:
        days = sorted(
            d.isoformat() for m, d in self.exclusions if m == metric and start <= d <= end
        )
        return _sha256(days)


def _sha256(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def _entry(value: Any, path: str) -> tuple[str, str]:
    """``(entry, field)`` for a schema path within a list file: the entry by its id if it has
    one, else by position."""
    head, _, rest = path.partition("/")
    if head.isdigit() and isinstance(value, list):
        item = value[int(head)]
        name = item.get("id") if isinstance(item, dict) else None
        return (f'"{name}"' if isinstance(name, str) else f"entry {int(head) + 1}"), rest
    return "", path


def read_owner_file(
    path: Path, schema: str, schemas: SchemaSet, problems: list[str], rel: str
) -> Any:
    """The validated contents of an owner file, or ``None`` if it is missing or has problems,
    which are added to ``problems`` as file / entry / field messages."""
    if not path.is_file():
        return None
    try:
        value = yaml12.load(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
        problems.append(f"{rel}: is not valid YAML ({type(exc).__name__})")
        return None
    issues = schemas.issues(schema, value)
    for issue in issues:
        entry, where = _entry(value, issue.path)
        location = " ".join(p for p in (rel, entry, f"field {where}" if where else "") if p)
        problems.append(f"{location}: {issue.hint or 'fails ' + issue.rule}")
    return None if issues else value


def load_owner(
    owner_dir: Path, schemas: SchemaSet, rel_root: str = "data/running/owner"
) -> OwnerInputs:
    problems: list[str] = []
    files = {
        name: read_owner_file(owner_dir / name, schema, schemas, problems, f"{rel_root}/{name}")
        for name, schema in OWNER_FILES.items()
    }

    runs: dict[str, RunOverride] = {}
    for item in files["run-overrides.yaml"] or []:
        if item["id"] in runs:
            problems.append(f'{rel_root}/run-overrides.yaml "{item["id"]}": already has an entry')
            continue
        runs[item["id"]] = RunOverride(**{k: v for k, v in item.items() if k != "id"})

    exclusions = frozenset(
        (item["metric"], date.fromisoformat(item["date"]))
        for item in files["health-exclusions.yaml"] or []
    )

    distances = set()
    for goal in files["goals.yaml"] or []:
        if goal.get("type") == "race_time":
            target = goal["target"]
            metres = parse_distance(target.get("distance", target.get("distance_m")))
            if metres is not None:
                distances.add(metres)

    races: dict[str, RaceLink] = {}
    for path in sorted(owner_dir.glob("races/*/race.yaml")):
        rel = f"{rel_root}/{path.relative_to(owner_dir).as_posix()}"
        race = read_owner_file(path, "owner/race", schemas, problems, rel)
        if race is None or "run_id" not in race:
            continue  # hand-entered races don't touch published runs
        run_id = race["run_id"]
        if run_id in races:
            problems.append(f"{rel}: run_id {run_id} is already used by race {races[run_id].slug}")
            continue
        races[run_id] = RaceLink(
            slug=race["slug"],
            name=race.get("name"),
            designate=race.get("designate"),
            hide_map=race.get("hide_map", False),
            trim_ends_m=race.get("trim_ends_m", 0),
        )

    if problems:
        raise OwnerDataInvalid(problems)
    return OwnerInputs(
        runs=runs,
        races=races,
        exclusions=exclusions,
        goal_distances=tuple(sorted(distances)),
    )
