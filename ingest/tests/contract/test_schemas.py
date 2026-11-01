"""The shared schema fixtures (T033), validated from Python as the site validates them in TS."""

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from awingest import yaml12
from awingest.distances import DISTANCES_M
from awingest.schemas import SchemaSet

REPO = Path(__file__).resolve().parents[3]
SCHEMAS = REPO / "schemas"
FIXTURES = SCHEMAS / "fixtures"
SCHEMA_NAMES = sorted(
    str(p.relative_to(SCHEMAS)).removesuffix(".schema.json")
    for p in SCHEMAS.glob("*/*.schema.json")
)


def _registry() -> Registry:
    resources = []
    for path in SCHEMAS.rglob("*.schema.json"):
        schema = json.loads(path.read_text())
        resources.append((schema["$id"], Resource.from_contents(schema)))
    return Registry().with_resources(resources)


REGISTRY = _registry()


def validator(name: str) -> Draft202012Validator:
    schema = json.loads((SCHEMAS / f"{name}.schema.json").read_text())
    return Draft202012Validator(
        schema, registry=REGISTRY, format_checker=Draft202012Validator.FORMAT_CHECKER
    )


def load(path: Path):
    text = path.read_text()
    return json.loads(text) if path.suffix == ".json" else yaml12.load(text)


def fixtures(kind: str):
    return [
        pytest.param(name, path, id=str(path.relative_to(FIXTURES)))
        for name in SCHEMA_NAMES
        for path in sorted((FIXTURES / name / kind).glob("*"))
    ]


def test_every_schema_has_fixtures():
    for name in SCHEMA_NAMES:
        assert list((FIXTURES / name / "valid").glob("*")), name
        assert list((FIXTURES / name / "invalid").glob("*")), name


@pytest.mark.parametrize(("name", "path"), fixtures("valid"))
def test_valid_fixture(name, path):
    errors = [e.message for e in validator(name).iter_errors(load(path))]
    assert errors == []


@pytest.mark.parametrize(("name", "path"), fixtures("invalid"))
def test_invalid_fixture(name, path):
    assert not validator(name).is_valid(load(path))


def test_story_approval_is_required_and_its_message_reaches_python():
    """No Python code reads a story: the gate's validate-data does (data-files.md). Python's own
    reader reports a missing field by rule, so the x-error shows only for a value that's there."""
    schemas = SchemaSet(SCHEMAS)
    name = "owner/campaign-story"
    missing = load(FIXTURES / name / "invalid" / "no-approved.yaml")
    assert [(i.path, i.rule, i.hint) for i in schemas.issues(name, missing)] == [
        ("", "required", None)
    ]
    wrong = load(FIXTURES / name / "invalid" / "approved-true.yaml")
    hint = "needs the owner's approval before it can be published"
    assert [(i.path, i.hint) for i in schemas.issues(name, wrong)] == [("approved", hint)]


def _objects(value):
    if isinstance(value, dict):
        yield value
        for v in value.values():
            yield from _objects(v)
    elif isinstance(value, list):
        for v in value:
            yield from _objects(v)


def _variants(doc, key):
    count = sum(1 for _ in _objects(doc))
    for target in range(count):
        variant = copy.deepcopy(doc)
        list(_objects(variant))[target][key] = 50.8
        yield variant


@pytest.mark.parametrize(
    "name", [n for n in SCHEMA_NAMES if n.startswith("published/") and n != "published/race-track"]
)
def test_no_coordinate_or_start_time_key_validates(name):
    v = validator(name)
    for path in (FIXTURES / name / "valid").glob("*"):
        for key in ("lat", "lon", "latlng", "latitude", "longitude", "start_time", "startTime"):
            for variant in _variants(load(path), key):
                assert not v.is_valid(variant), (path.name, key)


def test_no_name_or_description_key_validates_in_a_run():
    v = validator("published/run")
    for path in (FIXTURES / "published/run/valid").glob("*"):
        for key in ("name", "description"):
            for variant in _variants(load(path), key):
                assert not v.is_valid(variant), (path.name, key)


def test_distances_come_from_the_table_the_schemas_name():
    defs = json.loads((SCHEMAS / "defs.schema.json").read_text())
    table = json.loads((SCHEMAS / "distances.json").read_text())
    assert list(DISTANCES_M) == defs["$defs"]["distanceName"]["enum"] == list(table)
    assert DISTANCES_M["half"] == 21097.5
