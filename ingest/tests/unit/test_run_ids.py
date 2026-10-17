"""Opaque public run IDs (T056, T080): stable, append-only, collision-free, and never
regenerated from an unreadable map."""

import json
from datetime import date
from itertools import cycle

import pytest

from awingest.archive.base import ArchiveConflict, ArchiveUnavailable
from awingest.archive.local import LocalArchive
from awingest.process.run_ids import RUN_ID, RUN_IDS, RunIdMap

DAY = date(2026, 10, 11)


@pytest.fixture
def archive(tmp_path) -> LocalArchive:
    return LocalArchive(tmp_path / "archive")


def test_an_id_is_the_date_plus_four_base32_characters(archive):
    ids = RunIdMap(archive)
    run_id = ids.assign("i90000001", DAY)
    assert RUN_ID.match(run_id) and run_id.startswith("2026-10-11-")
    assert "i90000001" not in run_id


def test_ids_are_stable_across_runs(archive):
    first = RunIdMap(archive)
    run_id = first.assign("i90000001", DAY)
    first.save()
    again = RunIdMap(archive)
    assert again.get("i90000001") == run_id
    assert again.assign("i90000001", date(2027, 1, 1)) == run_id  # never reassigned
    assert again.added == 0
    assert again.provider_id(run_id) == "i90000001"


def test_collisions_on_the_same_date_draw_again(archive):
    draws = cycle(["aaaa", "aaaa", "bbbb"])
    ids = RunIdMap(archive, draw=lambda: next(draws))
    assert ids.assign("i1", DAY) == "2026-10-11-aaaa"
    assert ids.assign("i2", DAY) == "2026-10-11-bbbb"
    # The same suffix on another date is a different ID, so it's fine.
    assert ids.assign("i3", date(2026, 10, 12)) == "2026-10-12-aaaa"


def test_many_runs_on_one_day_get_distinct_ids(archive):
    ids = RunIdMap(archive)
    assigned = {ids.assign(f"i{n}", DAY) for n in range(500)}
    assert len(assigned) == 500


def test_the_map_is_append_only(archive):
    ids = RunIdMap(archive)
    first = ids.assign("i1", DAY)
    ids.save()
    ids = RunIdMap(archive)
    ids.assign("i2", DAY)
    ids.save()
    stored = json.loads(archive.get(RUN_IDS))
    assert stored["i1"] == first and len(stored) == 2


def test_saving_nothing_new_writes_nothing(archive):
    RunIdMap(archive).save()
    assert archive.get(RUN_IDS) is None


def test_a_concurrent_writer_is_a_conflict(archive):
    one, two = RunIdMap(archive), RunIdMap(archive)
    one.assign("i1", DAY)
    one.save()
    two.assign("i2", DAY)
    with pytest.raises(ArchiveConflict):
        two.save()


@pytest.mark.parametrize(
    "content",
    [
        b"not json",
        b"[]",
        b'{"i1": "not-a-run-id"}',
        b'{"i1": 7}',
        b'{"i1": "2026-10-11-aaaa", "i2": "2026-10-11-aaaa"}',
    ],
    ids=["bad-json", "not-an-object", "bad-id", "not-a-string", "duplicate-id"],
)
def test_an_unreadable_map_aborts_rather_than_regenerating(archive, content):
    archive.put(RUN_IDS, content)
    with pytest.raises(ArchiveUnavailable, match="refusing to regenerate"):
        RunIdMap(archive)
    assert archive.get(RUN_IDS) == content


def test_an_absent_map_is_reported(archive):
    assert RunIdMap(archive).absent
    archive.put(RUN_IDS, b"{}")
    assert not RunIdMap(archive).absent
