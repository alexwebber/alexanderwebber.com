"""The JSON Schemas in ``schemas/`` (the single source of truth shared with the site), loaded for
validation from Python.

Validation failures are reported by location and rule only (``published/run`` at
``splits/3/pace_s_per_km``: ``exclusiveMinimum``), never with jsonschema's message, because
that message quotes the offending value and the publish stage runs on unpublished data whose
log is public. Owner-file errors may quote the owner's own text: owner files are committed.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from referencing import Registry, Resource

PACKAGE_REPO = Path(__file__).resolve().parents[3]


def find_repo_root(start: Path | None = None) -> Path:
    """The nearest directory holding ``schemas/published``, from ``start`` (default: the working
    directory) upwards, else the repository this package was installed from."""
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "schemas" / "published").is_dir():
            return candidate
    return PACKAGE_REPO


@dataclass(frozen=True)
class SchemaIssue:
    """One validation failure: where it is and which rule it broke, plus the schema's own
    owner-facing ``x-error`` text if the failing node has one."""

    path: str
    rule: str
    hint: str | None = None

    def __str__(self) -> str:
        where = self.path or "(top level)"
        return f"{where}: {self.hint or 'fails ' + self.rule}"


def _path(error: ValidationError) -> str:
    return "/".join(str(p) for p in error.absolute_path)


def _leaves(error: ValidationError) -> list[ValidationError]:
    """The errors to report for one failure. A ``oneOf`` with a ``discriminator`` (goals, by
    ``type``) reports the errors of the branch the instance's discriminator selects, as ajv does
    on the site; jsonschema itself ignores ``discriminator`` and reports only the ``oneOf``."""
    schema = error.schema if isinstance(error.schema, dict) else {}
    prop = schema.get("discriminator", {}).get("propertyName")
    if not prop or not error.context:
        return [error]
    branches: dict[object, list[ValidationError]] = {}
    for sub in error.context:
        branches.setdefault(sub.relative_schema_path[0], []).append(sub)
    chosen = [
        errors
        for errors in branches.values()
        if not any(list(e.relative_path) == [prop] for e in errors)
    ]
    if len(chosen) != 1:
        return [error]  # no branch (or several) matches the discriminator: report the oneOf
    return [leaf for sub in chosen[0] for leaf in _leaves(sub)]


class SchemaSet:
    """Validators for every ``schemas/<group>/<name>.schema.json``, named ``group/name``."""

    def __init__(self, schemas_dir: Path) -> None:
        self.dir = schemas_dir
        resources = []
        self._schemas: dict[str, dict[str, Any]] = {}
        for path in sorted(schemas_dir.rglob("*.schema.json")):
            schema = json.loads(path.read_text(encoding="utf-8"))
            resources.append((schema["$id"], Resource.from_contents(schema)))
            if path.parent != schemas_dir:
                name = f"{path.parent.name}/{path.name.removesuffix('.schema.json')}"
                self._schemas[name] = schema
        self._registry = Registry().with_resources(resources)
        self._validators: dict[str, Draft202012Validator] = {}

    def validator(self, name: str) -> Draft202012Validator:
        if name not in self._validators:
            if name not in self._schemas:
                raise KeyError(f"no schema named {name!r} in {self.dir}")
            self._validators[name] = Draft202012Validator(
                self._schemas[name],
                registry=self._registry,
                format_checker=Draft202012Validator.FORMAT_CHECKER,
            )
        return self._validators[name]

    def issues(self, name: str, value: Any) -> list[SchemaIssue]:
        """Every failure, once each, sorted by path."""
        out = []
        for failure in self.validator(name).iter_errors(value):
            for error in _leaves(failure):
                hint = error.schema.get("x-error") if isinstance(error.schema, dict) else None
                out.append(SchemaIssue(path=_path(error), rule=str(error.validator), hint=hint))
        return sorted(set(out), key=lambda i: (i.path, i.rule))
