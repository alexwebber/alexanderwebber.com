"""The process stage end to end (T064, T080, T082): the fixture archive -> a published tree the
gate accepts, incrementally, with nothing private in it and nothing written on failure."""

import io
import json
from datetime import UTC, datetime

import pytest

from awingest.logging import Logger
from awingest.process import pipeline
from awingest.process.pipeline import run_process
from awingest.process.run_ids import RUN_IDS
from awingest.publish.manifest import MANIFEST, REFRESH, check_published
from awingest.schemas import SchemaSet
from awingest.state import FETCH_STATUS

NOW = datetime(2026, 10, 17, 12, 0, tzinfo=UTC)
LATER = datetime(2026, 10, 17, 14, 0, tzinfo=UTC)
SENTINELS = ("SENTINEL", "i9000000", "garmin_sentinel_", "51.12", "-0.76", "T07:15", "T18:00")


@pytest.fixture
def published(repo):
    return repo / "data/running/published"


@pytest.fixture
def run(provider, filled_archive, repo):
    """Runs the process stage, returning its result; the log is kept on ``run.log``."""

    def go(now=NOW, **kwargs):
        stream = io.StringIO()
        result = run_process(
            provider,
            filled_archive,
            repo_root=repo,
            log=Logger("process", stream=stream),
            now=now,
            **kwargs,
        )
        go.log = stream.getvalue()
        return result

    return go


def tree(root):
    return {
        p.relative_to(root).as_posix(): p.read_bytes()
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


def runs(published):
    return {
        doc["id"]: doc
        for doc in (json.loads(p.read_bytes()) for p in sorted(published.glob("runs/*/*.json")))
    }


def run_id_for(archive, provider_id):
    return json.loads(archive.get(RUN_IDS))[provider_id]


def write_owner(repo, name, text):
    path = repo / "data/running/owner" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_a_first_run_publishes_every_run_and_series(run, published, repo, filled_archive):
    result = run()
    assert (result.exit_code, result.outcome) == (0, "ok")
    assert result.runs.written == 6 and result.runs.new_ids == 6  # the gym session isn't archived
    assert result.health.written == 7
    files = tree(published)
    assert len([f for f in files if f.startswith("runs/")]) == 6
    assert {f.split("/")[1] for f in files if f.startswith("health/")} == {
        "vo2max", "fitness_ctl", "fatigue_atl", "resting_hr", "hrv", "weight_avg7", "body_fat_pct"
    }  # fmt: skip
    assert check_published(published, SchemaSet(repo / "schemas")) == []
    refresh = json.loads(files[REFRESH])
    assert refresh["sources"]["intervals"] == {
        "last_data_change_at": "2026-10-17T12:00:00Z",
        "last_success_at_build": "2026-10-17T11:00:00Z",  # from the fetch that filled the archive
    }
    ids = json.loads(filled_archive.get(RUN_IDS))
    assert sorted(ids) == [f"i9000000{n}" for n in range(1, 7)]
    assert set(runs(published)) == set(ids.values())
    devices = [doc.get("device") for doc in runs(published).values()]
    assert sorted(devices, key=str) == [None, None, "Venu 2 Plus", "Venu X1", "Venu X1", "Venu X1"]


def test_nothing_private_reaches_the_published_tree_or_the_log(run, published):
    run()
    for name, data in tree(published).items():
        text = data.decode()
        for sentinel in SENTINELS:
            assert sentinel not in text, (name, sentinel)
    for sentinel in ("SENTINEL", "i9000000", "51.12"):
        assert sentinel not in run.log


def test_training_runs_get_neutral_titles_and_the_flagged_race_is_a_race(
    run, published, filled_archive
):
    run()
    by_id = runs(published)
    titles = sorted(r["title"] for r in by_id.values())
    assert titles == sorted(
        ["Run · 10.2 km", "Run · 6.4 km", "Treadmill run · 5.0 km", "Race · 21.1 km",
         "Trail run · 12.3 km", "Indoor run · 4.0 km"]
    )  # fmt: skip
    race = by_id[run_id_for(filled_archive, "i90000004")]
    assert race["is_race"] is True and "track_ref" not in race
    treadmill = by_id[run_id_for(filled_archive, "i90000003")]
    assert treadmill["treadmill"] is True and "elev" not in treadmill["series"]


def test_a_second_run_with_no_changes_changes_nothing(run, published):
    run()
    before = tree(published)
    result = run(now=LATER)
    assert result.runs.unchanged == 6 and result.health.unchanged == 7
    assert result.files == {"added": 0, "changed": 0, "removed": 0}
    assert tree(published) == before  # processed_at and refresh.json included


def test_all_reprocesses_but_identical_output_is_not_a_change(run, published):
    run()
    before = tree(published)
    result = run(now=LATER, all_runs=True)
    assert result.runs.written == 6 and result.health.written == 7
    assert tree(published) == before


def test_a_processor_version_bump_reprocesses_everything_on_the_next_run(
    run, published, monkeypatch
):
    run()
    before = tree(published)
    monkeypatch.setattr(pipeline, "PROCESSOR_VERSION", pipeline.PROCESSOR_VERSION + 1)
    result = run(now=LATER)
    assert result.runs.written == 6 and result.health.written == 7
    assert set(tree(published)) == set(before)  # same files; only the manifest hashes differ
    assert run(now=LATER).runs.unchanged == 6  # and then it settles again


def test_an_owner_change_rewrites_only_the_runs_it_touches(run, published, repo, filled_archive):
    run()
    before = tree(published)
    target = run_id_for(filled_archive, "i90000002")
    write_owner(
        repo,
        "run-overrides.yaml",
        f'- {{ id: {target}, title: Long run with Sam, note: "Felt strong" }}\n',
    )
    result = run(now=LATER)
    assert result.runs.written == 1 and result.runs.unchanged == 5
    changed = {f for f, data in tree(published).items() if before.get(f) != data}
    assert changed == {f"runs/2026/{target}.json", MANIFEST, REFRESH}
    doc = runs(published)[target]
    assert (doc["title"], doc["note"]) == ("Long run with Sam", "Felt strong")
    assert json.loads(tree(published)[REFRESH])["sources"]["intervals"]["last_data_change_at"] == (
        "2026-10-17T14:00:00Z"
    )


def test_a_hidden_run_is_removed_and_recorded_without_content(run, published, repo, filled_archive):
    run()
    target = run_id_for(filled_archive, "i90000005")
    write_owner(repo, "run-overrides.yaml", f"- {{ id: {target}, hide: true }}\n")
    result = run(now=LATER)
    assert result.runs.hidden == 1
    assert target not in runs(published)
    manifest = json.loads(tree(published)[MANIFEST])
    assert manifest["runs"][target] == {
        "input_hash": manifest["runs"][target]["input_hash"],
        "hidden": True,
    }
    assert check_published(published, SchemaSet(repo / "schemas")) == []
    # Unhiding brings it back with the same ID.
    write_owner(repo, "run-overrides.yaml", "[]\n")
    run(now=LATER)
    assert target in runs(published)


def test_a_linked_race_entry_designates_and_names_the_run(run, published, repo, filled_archive):
    run()
    target = run_id_for(filled_archive, "i90000001")
    write_owner(
        repo,
        "races/autumn-10k/race.yaml",
        f"slug: autumn-10k\nrun_id: {target}\nname: Autumn 10k\ndate: 2026-10-11\n"
        "distance: 10k\ndesignate: race\n",
    )
    run(now=LATER)
    doc = runs(published)[target]
    assert (doc["is_race"], doc["title"]) == (True, "Autumn 10k")


def test_goal_distances_add_best_efforts_to_every_run(run, published, repo):
    run()
    write_owner(
        repo,
        "goals.yaml",
        "- { id: eight, type: race_time, title: 8 km, priority: 1, featured: true,"
        ' target: { distance_m: 8000, time: "36:00" } }\n',
    )
    result = run(now=LATER)
    assert result.runs.written == 6
    with_8k = [
        r for r in runs(published).values() if any(e["label"] == "8 km" for e in r["best_efforts"])
    ]
    assert len(with_8k) == 3  # the runs of at least 8 km (10.2, 12.3 and 21.1)


def test_a_health_exclusion_changes_only_the_weight_average(run, published, repo):
    run()
    before = tree(published)
    write_owner(repo, "health-exclusions.yaml", "- { metric: weight_kg, date: 2026-10-01 }\n")
    run(now=LATER)
    changed = {f for f, data in tree(published).items() if before.get(f) != data}
    assert changed == {"health/weight_avg7/2026.json", MANIFEST, REFRESH}
    points = json.loads(tree(published)["health/weight_avg7/2026.json"])["points"]
    assert points[0]["date"] != "2026-10-01"


def test_a_changed_wellness_day_reprocesses_its_year(run, published, filled_archive):
    run()
    key = "raw/intervals/wellness/2026-10-02.json"
    day = json.loads(filled_archive.get(key))
    day["vo2max"] = 53.0
    filled_archive.put(key, json.dumps(day).encode())
    result = run(now=LATER)
    assert result.health.written == 7 and result.files["changed"] >= 2
    points = json.loads(tree(published)["health/vo2max/2026.json"])["points"]
    assert {"date": "2026-10-02", "value": 53.0} in points


def test_reprocess_redoes_one_run(run, published, filled_archive):
    run()
    target = run_id_for(filled_archive, "i90000003")
    result = run(now=LATER, only_run=target)
    assert result.runs.activities == 1 and result.runs.written == 1
    assert result.health.written == 0 and result.health.unchanged == 0


def test_reprocess_of_an_unknown_run_exits_2(run):
    run()
    result = run(now=LATER, only_run="2026-01-01-aaaa")
    assert (result.exit_code, result.code) == (2, "unknown_run")


def test_an_invalid_published_document_writes_nothing(run, published, monkeypatch, filled_archive):
    run()
    before = tree(published)
    ids_before = filled_archive.get(RUN_IDS)
    real = pipeline.sanitise_run

    def leaky(*args, **kwargs):
        return real(*args, **kwargs) | {"start_time": "2026-10-11T07:15:00"}

    monkeypatch.setattr(pipeline, "sanitise_run", leaky)
    result = run(now=LATER, all_runs=True)
    assert (result.exit_code, result.code) == (20, "publish_invalid")
    assert tree(published) == before
    assert filled_archive.get(RUN_IDS) == ids_before
    assert "07:15" not in run.log


def test_invalid_owner_data_writes_nothing(run, published, repo):
    run()
    before = tree(published)
    write_owner(repo, "run-overrides.yaml", "- { id: not-a-run-id, hide: true }\n")
    result = run(now=LATER)
    assert (result.exit_code, result.code) == (20, "owner_data_invalid")
    assert tree(published) == before


def test_an_unreadable_id_map_aborts(run, published, filled_archive):
    filled_archive.put(RUN_IDS, b"{oops")
    result = run()
    assert (result.exit_code, result.code) == (14, "archive_unavailable")
    assert not published.exists()


def test_a_missing_id_map_with_published_runs_aborts(run, published, filled_archive):
    run()
    before = tree(published)
    filled_archive.delete(RUN_IDS)
    result = run(now=LATER)
    assert (result.exit_code, result.code) == (14, "run_ids_missing")
    assert tree(published) == before


def test_one_activity_that_fails_to_normalise_is_skipped_and_kept(run, published, filled_archive):
    run()
    target = run_id_for(filled_archive, "i90000002")
    before = tree(published)[f"runs/2026/{target}.json"]
    filled_archive.put("raw/intervals/activities/i90000002/detail.json", b"not json")
    result = run(now=LATER)
    assert (result.exit_code, result.outcome) == (0, "partial")
    assert result.runs.failed == 1
    assert tree(published)[f"runs/2026/{target}.json"] == before
    assert "i90000002" not in run.log


def test_an_activity_without_its_marker_is_left_for_later(run, published, filled_archive):
    filled_archive.delete("raw/intervals/activities/i90000006/fetch.json")
    result = run()
    assert result.runs.incomplete == 1 and result.runs.written == 5


def test_an_empty_archive_publishes_nothing(provider, repo, tmp_path, published):
    from awingest.archive.local import LocalArchive

    result = run_process(
        provider,
        LocalArchive(tmp_path / "empty"),
        repo_root=repo,
        log=Logger("p", stream=io.StringIO()),
        now=NOW,
    )
    assert result.exit_code == 0 and not published.exists()


def test_refresh_falls_back_to_now_without_a_fetch_status(run, published, filled_archive):
    filled_archive.delete(FETCH_STATUS)
    run()
    refresh = json.loads(tree(published)[REFRESH])
    assert refresh["sources"]["intervals"]["last_success_at_build"] == "2026-10-17T12:00:00Z"


# --- publish-check ---


def test_publish_check_finds_layout_and_manifest_problems(run, published, repo, filled_archive):
    run()
    schemas = SchemaSet(repo / "schemas")
    target = run_id_for(filled_archive, "i90000002")
    manifest = json.loads((published / MANIFEST).read_text())
    manifest["runs"][target] = {"input_hash": "0" * 64, "hidden": True}
    (published / MANIFEST).write_text(json.dumps(manifest))
    (published / "notes.txt").write_text("x")
    (published / "runs/2026/2026-01-01-aaaa.json").write_bytes(
        (published / f"runs/2026/{target}.json").read_bytes()
    )
    problems = check_published(published, schemas)
    assert any("notes.txt" in p and "layout" in p for p in problems)
    assert any(f"runs/2026/{target}.json: hidden in the manifest" in p for p in problems)
    assert any("2026-01-01-aaaa.json: path, id and date disagree" in p for p in problems)
    assert any("2026-01-01-aaaa.json: not in the manifest" in p for p in problems)


def test_a_start_date_edited_later_keeps_the_run_on_its_first_date(run, published, filled_archive):
    run()
    target = run_id_for(filled_archive, "i90000002")
    key = "raw/intervals/activities/i90000002/detail.json"
    detail = json.loads(filled_archive.get(key))
    detail["start_date_local"] = "2026-01-16T00:30:00"
    filled_archive.put(key, json.dumps(detail).encode())
    result = run(now=LATER)
    assert result.exit_code == 0
    assert runs(published)[target]["date"] == target[:10]
    assert '"event": "run_date_changed"' in run.log


def test_an_original_fit_topped_up_later_adds_garmin_zones(run, published, filled_archive):
    prefix = "raw/intervals/activities/i90000001/"
    original = filled_archive.get(prefix + "original.fit")
    filled_archive.delete(prefix + "original.fit")
    run()
    run_id = run_id_for(filled_archive, "i90000001")
    assert "hr_zones" not in runs(published)[run_id]  # no original, no zones (no fallback)
    filled_archive.put(prefix + "original.fit", original)
    marker = json.loads(filled_archive.get(prefix + "fetch.json")) | {"layout": 2}
    filled_archive.put(prefix + "fetch.json", json.dumps(marker).encode())
    again = run(now=LATER)
    assert again.runs.written == 1 and again.runs.unchanged == 5
    zones = runs(published)[run_id]["hr_zones"]
    assert [(z["zone"], z["low_bpm"], z["high_bpm"]) for z in zones][2] == (3, 123, 140)
    # No "name" key: scan-privacy reserves it for provider titles, so the site names zones itself.
    assert all("name" not in z for z in zones)
    assert [z["seconds"] for z in zones] == [2, 44, 1393, 1532, 0]
