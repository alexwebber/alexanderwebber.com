"""``PublishedWriter`` contract (T063, T082; contracts/storage.md): validation before writing, the
path guard, canonical formatting and an all-or-nothing commit."""

import json
import os

import pytest
from conftest import link_dir

from awingest.publish import writer as writer_module
from awingest.publish.writer import PublishedWriter, PublishInvalid, canonical_json
from awingest.schemas import SchemaSet

POINTS = [{"date": "2026-10-01", "value": 51.0}]


def series(value=51.0):
    return {
        "schema_version": 1,
        "metric": "vo2max",
        "unit": "ml/kg/min",
        "points": [{"date": "2026-10-01", "value": value}],
    }


@pytest.fixture
def root(repo):
    return repo / "data/running/published"


@pytest.fixture
def writer(repo, root):
    return PublishedWriter(root, SchemaSet(repo / "schemas"))


def tree(root):
    return {
        p.relative_to(root).as_posix(): p.read_bytes()
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


def test_documents_are_validated_before_they_are_accepted(writer, root):
    bad = series() | {"lat": 51.12}
    with pytest.raises(PublishInvalid) as caught:
        writer.write_json("health/vo2max/2026.json", bad, "published/health-series")
    assert "51.12" not in str(caught.value)  # the value is never quoted
    assert "additionalProperties" in str(caught.value)
    assert not writer.commit_plan()
    assert not root.exists()


@pytest.mark.parametrize(
    "path",
    [
        "../owner/goals.yaml",
        "/etc/passwd",
        "runs/../../x.json",
        "runs\\x.json",
        "",
        ".hidden/x.json",
    ],
)
def test_paths_outside_the_published_zone_are_refused(writer, path):
    with pytest.raises(PublishInvalid, match="refusing"):
        writer.write_json(path, series(), "published/health-series")
    with pytest.raises(PublishInvalid, match="refusing"):
        writer.remove(path)


def test_a_symlink_out_of_the_zone_is_refused(writer, root, tmp_path):
    root.mkdir(parents=True)
    (tmp_path / "outside").mkdir()
    link_dir(root / "health", tmp_path / "outside")
    with pytest.raises(PublishInvalid, match="outside the published zone"):
        writer.write_json("health/vo2max/2026.json", series(), "published/health-series")


def test_output_is_canonical_compact_json(writer, root):
    writer.write_json("health/vo2max/2026.json", series(), "published/health-series")
    writer.commit()
    data = (root / "health/vo2max/2026.json").read_bytes()
    assert data == (
        b'{"metric":"vo2max","points":[{"date":"2026-10-01","value":51.0}],'
        b'"schema_version":1,"unit":"ml/kg/min"}\n'
    )
    assert canonical_json({"b": 1, "a": "·"}) == '{"a":"·","b":1}\n'.encode()
    with pytest.raises(ValueError):
        canonical_json({"x": float("nan")})


def test_commit_reports_and_applies_added_changed_and_removed(writer, root, repo):
    writer.write_json("health/vo2max/2026.json", series(), "published/health-series")
    writer.write_json("health/vo2max/2025.json", series(), "published/health-series")
    assert writer.commit().counts() == {"added": 2, "changed": 0, "removed": 0}

    again = PublishedWriter(root, SchemaSet(repo / "schemas"))
    again.write_json("health/vo2max/2026.json", series(), "published/health-series")  # same bytes
    again.write_json("health/vo2max/2025.json", series(52.0), "published/health-series")
    again.remove("health/vo2max/2024.json")  # not there: not a change
    plan = again.commit_plan()
    assert (plan.added, plan.changed, plan.removed) == ([], ["health/vo2max/2025.json"], [])
    again.remove("health/vo2max/2026.json")
    diff = again.commit()
    assert diff.removed == ["health/vo2max/2026.json"]
    assert set(tree(root)) == {"health/vo2max/2025.json"}
    assert json.loads(tree(root)["health/vo2max/2025.json"])["points"][0]["value"] == 52.0


def test_removing_the_last_file_in_a_folder_removes_the_folder(writer, root, repo):
    writer.write_json("health/vo2max/2026.json", series(), "published/health-series")
    writer.write_json(
        "health/hrv/2026.json",
        series() | {"metric": "hrv", "unit": "ms"},
        "published/health-series",
    )
    writer.commit()
    again = PublishedWriter(root, SchemaSet(repo / "schemas"))
    again.remove("health/hrv/2026.json")
    again.commit()
    assert not (root / "health/hrv").exists() and (root / "health/vo2max").is_dir()


def test_a_failure_while_staging_leaves_the_tree_untouched(writer, root, repo, monkeypatch):
    writer.write_json("health/vo2max/2026.json", series(), "published/health-series")
    writer.commit()
    before = tree(root)
    again = PublishedWriter(root, SchemaSet(repo / "schemas"))
    again.write_json("health/vo2max/2026.json", series(60.0), "published/health-series")
    again.write_json("health/vo2max/2027.json", series(), "published/health-series")

    real_replace = os.replace
    calls = []

    def failing_replace(src, dst):
        calls.append(dst)
        if len(calls) == 2:
            raise OSError("disk full")
        return real_replace(src, dst)

    monkeypatch.setattr(writer_module.os, "replace", failing_replace)
    with pytest.raises(OSError):
        again.commit()
    assert tree(root) == before
    assert not root.with_name("published.staging").exists()


def test_unchanged_files_share_storage_with_the_staged_tree(writer, root, repo):
    writer.write_json("health/vo2max/2026.json", series(), "published/health-series")
    writer.commit()
    inode = (root / "health/vo2max/2026.json").stat().st_ino
    again = PublishedWriter(root, SchemaSet(repo / "schemas"))
    again.write_json("health/vo2max/2025.json", series(), "published/health-series")
    again.commit()
    assert (root / "health/vo2max/2026.json").stat().st_ino == inode  # hard-linked, not copied


def test_a_crash_between_the_renames_is_repaired(root, repo):
    old = root.with_name("published.old")
    (old / "state").mkdir(parents=True)
    (old / "state/refresh.json").write_text("{}")
    root.with_name("published.staging").mkdir()
    PublishedWriter(root, SchemaSet(repo / "schemas"))
    assert (root / "state/refresh.json").read_text() == "{}"
    assert not old.exists() and not root.with_name("published.staging").exists()


def test_pending_changes_are_visible_to_reads(writer):
    writer.write_json("health/vo2max/2026.json", series(), "published/health-series")
    assert writer.exists("health/vo2max/2026.json")
    assert writer.read_json("health/vo2max/2026.json")["points"] == POINTS
    assert writer.files("health/") == ["health/vo2max/2026.json"]
    writer.remove("health/vo2max/2026.json")
    assert not writer.exists("health/vo2max/2026.json") and writer.files() == []
