"""The fetch stage's state handling (T054): cursors, status, freshness, partial failure."""

import io
import json
from datetime import UTC, date, datetime, timedelta

import pytest

from awingest.archive.base import ArchiveUnavailable
from awingest.archive.local import LocalArchive
from awingest.fetch import run_fetch
from awingest.logging import Logger
from awingest.state import CURSOR, FETCH_STATUS, FRESHNESS

NOW = datetime(2026, 10, 17, 11, 0, tzinfo=UTC)


def log() -> Logger:
    return Logger("fetch", stream=io.StringIO())


def read(archive, key):
    data = archive.get(key)
    return None if data is None else json.loads(data)


@pytest.fixture
def archive(tmp_path) -> LocalArchive:
    return LocalArchive(tmp_path / "archive")


def test_a_first_run_fetches_the_last_14_days_and_sets_everything(provider, archive):
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert (result.exit_code, result.outcome) == (0, "ok")
    assert (result.oldest, result.newest) == (date(2026, 10, 3), date(2026, 10, 17))
    assert result.activities.fetched == 1  # run-dynamics, 2026-10-11; the gym session isn't a run
    assert result.wellness.written == 5  # 10-03 .. 10-07 (10-08 has no approved values)
    assert read(archive, CURSOR) == {
        "activities": {"last_date": "2026-10-17"},
        "wellness": {"last_date": "2026-10-17"},
    }
    status = read(archive, FETCH_STATUS)["intervals"]
    assert status["last_success_at"] == "2026-10-17T11:00:00Z"
    assert status["outcome"] == "ok" and status["consecutive_failures"] == 0
    assert read(archive, FRESHNESS) == {
        "intervals": {"last_success_at": "2026-10-17T11:00:00Z"},
        "generated_at": "2026-10-17T11:00:00Z",
    }


def test_raw_parts_and_the_marker_are_archived(provider, archive):
    run_fetch(provider, archive, log=log(), now=NOW)
    keys = [o.key for o in archive.list("raw/intervals/activities/")]
    prefix = "raw/intervals/activities/i90000001/"
    assert keys == [
        prefix + name
        for name in (
            "activity.fit",
            "detail.json",
            "fetch.json",
            "original.fit",
            "streams.json",
            "summary.json",
            "time-at-hr.json",
        )
    ]
    marker = read(archive, prefix + "fetch.json")
    assert marker["parts"] == [
        "activity.fit",
        "detail.json",
        "original.fit",
        "streams.json",
        "summary.json",
        "time-at-hr.json",
    ]
    assert len(marker["row_hash"]) == 64
    assert marker["layout"] == 2


def _as_layout_1(archive, prefix):
    """Make an archived bundle look as the layout-1 adapter left it (no original FIT file)."""
    archive.delete(prefix + "original.fit")
    marker = read(archive, prefix + "fetch.json")
    del marker["layout"]
    marker["parts"].remove("original.fit")
    archive.put(prefix + "fetch.json", json.dumps(marker, sort_keys=True).encode())


def test_an_older_bundle_gets_only_its_new_parts(provider, api, archive):
    prefix = "raw/intervals/activities/i90000001/"
    run_fetch(provider, archive, log=log(), now=NOW)
    _as_layout_1(archive, prefix)
    detail = archive.get(prefix + "detail.json")
    api.requests.clear()
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert (result.activities.topped_up, result.activities.fetched) == (1, 0)
    assert [p for p in api.paths() if p.startswith("/activity/")] == ["/activity/i90000001/file"]
    assert archive.get(prefix + "original.fit") and archive.get(prefix + "detail.json") == detail
    marker = read(archive, prefix + "fetch.json")
    assert marker["layout"] == 2 and "original.fit" in marker["parts"]
    # Topped up once: the next run has nothing to do.
    api.requests.clear()
    again = run_fetch(provider, archive, log=log(), now=NOW)
    assert again.activities.unchanged == 1 and not again.activities.topped_up
    assert not [p for p in api.paths() if p.startswith("/activity/")]


def test_a_top_up_without_an_original_still_marks_the_bundle_current(provider, api, archive):
    prefix = "raw/intervals/activities/i90000001/"
    run_fetch(provider, archive, log=log(), now=NOW)
    _as_layout_1(archive, prefix)
    del api.originals["i90000001"]  # 404
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert result.activities.topped_up == 1 and not archive.exists(prefix + "original.fit")
    marker = read(archive, prefix + "fetch.json")
    assert marker["layout"] == 2 and "original.fit" not in marker["parts"]


def test_a_failed_top_up_is_partial_and_retried(provider, api, archive):
    prefix = "raw/intervals/activities/i90000001/"
    run_fetch(provider, archive, log=log(), now=NOW)
    _as_layout_1(archive, prefix)
    api.fail("/file", "503", times=3)
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert (result.outcome, result.activities.failed) == ("partial", 1)
    assert "layout" not in read(archive, prefix + "fetch.json")
    assert run_fetch(provider, archive, log=log(), now=NOW).activities.topped_up == 1


def test_one_failing_activity_is_partial_and_holds_the_activity_cursor(provider, api, archive):
    archive.put(
        CURSOR, b'{"activities":{"last_date":"2026-01-20"},"wellness":{"last_date":"2026-10-01"}}'
    )
    api.fail("/activity/i90000003/streams.json", "503", times=3)
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert (result.exit_code, result.outcome) == (0, "partial")
    assert result.activities.failed == 1 and result.activities.fetched == 5
    cursor = read(archive, CURSOR)
    assert cursor["activities"]["last_date"] == "2026-01-20"  # retried next run
    assert cursor["wellness"]["last_date"] == "2026-10-17"
    assert not archive.exists("raw/intervals/activities/i90000003/fetch.json")
    status = read(archive, FETCH_STATUS)["intervals"]
    assert status["outcome"] == "partial" and status["failed_activities"] == 1
    assert status["last_success_at"] == "2026-10-17T11:00:00Z"


def test_the_failed_activity_is_retried_on_the_next_run(provider, api, archive):
    api.fail("/activity/i90000001/streams.json", "503", times=3)
    assert run_fetch(provider, archive, log=log(), now=NOW).activities.failed == 1
    again = run_fetch(provider, archive, log=log(), now=NOW + timedelta(hours=2))
    assert (again.activities.fetched, again.activities.failed) == (1, 0)
    assert read(archive, CURSOR)["activities"]["last_date"] == "2026-10-17"


def test_a_network_outage_ends_the_run(provider, api, archive):
    api.fail("/activity/", "503", times=100)
    result = run_fetch(provider, archive, log=log(), now=NOW, reimport_from=date(2026, 1, 1))
    assert result.exit_code == 1 and result.code == "transient"
    assert result.activities.failed == 3  # gave up after three in a row


def test_auth_failure_stops_at_once_and_leaves_cursors(provider, api, archive):
    cursor = b'{"activities":{"last_date":"2026-10-01"},"wellness":{"last_date":"2026-10-01"}}'
    archive.put(CURSOR, cursor)
    api.fail("/activity/", "401")
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert result.exit_code == 10 and result.code == "auth_rejected"
    assert archive.get(CURSOR) == cursor
    status = read(archive, FETCH_STATUS)["intervals"]
    assert status["outcome"] == "failed" and status["consecutive_failures"] == 1
    assert "last_success_at" not in status
    assert not archive.exists(FRESHNESS)


def test_forbidden_and_changed_exit_codes(provider, api, archive):
    api.fail("/athlete/0/activities", "403-html")
    assert run_fetch(provider, archive, log=log(), now=NOW).exit_code == 12
    api.fail("/athlete/0/wellness", (200, {}, b"{}"))
    assert run_fetch(provider, archive, log=log(), now=NOW).exit_code == 13
    assert read(archive, FETCH_STATUS)["intervals"]["consecutive_failures"] == 2


def test_a_rate_limit_backs_off_without_calling_the_provider(provider, api, archive):
    api.fail("/athlete/0/activities", "429")
    assert run_fetch(provider, archive, log=log(), now=NOW).exit_code == 11
    api.requests.clear()
    during = run_fetch(provider, archive, log=log(), now=NOW + timedelta(seconds=60))
    assert during.exit_code == 11 and not api.requests
    after = run_fetch(provider, archive, log=log(), now=NOW + timedelta(seconds=121))
    assert after.exit_code == 0
    assert read(archive, FETCH_STATUS)["intervals"]["rate_limited_until"] is None


def test_a_429_without_retry_after_backs_off_15_minutes(provider, api, archive):
    api.fail("/athlete/0/activities", (429, {}, b""))
    run_fetch(provider, archive, log=log(), now=NOW)
    status = read(archive, FETCH_STATUS)["intervals"]
    assert status["rate_limited_until"] == "2026-10-17T11:15:00Z"


def test_reimport_refetches_everything_and_leaves_cursors(provider, api, archive):
    run_fetch(provider, archive, log=log(), now=NOW, reimport_from=date(2026, 1, 1))
    assert not archive.exists(CURSOR)
    api.requests.clear()
    again = run_fetch(
        provider,
        archive,
        log=log(),
        now=NOW,
        reimport_from=date(2026, 1, 1),
        reimport_to=date(2026, 3, 31),
    )
    assert again.activities.fetched == 3  # run-basic, trainer-run, treadmill
    # A window that ends before today doesn't count as a fresh refresh.
    assert read(archive, FETCH_STATUS)["intervals"]["last_success_at"] == "2026-10-17T11:00:00Z"


def test_missing_only_tops_up_a_window_without_refetching_it(provider, api, archive):
    run_fetch(provider, archive, log=log(), now=NOW, reimport_from=date(2026, 1, 1))
    for aid in ("i90000001", "i90000003"):
        _as_layout_1(archive, f"raw/intervals/activities/{aid}/")
    api.requests.clear()
    result = run_fetch(
        provider, archive, log=log(), now=NOW, reimport_from=date(2026, 1, 1), missing_only=True
    )
    assert result.activities.fetched == 0 and result.activities.topped_up == 2
    fetched = sorted(p for p in api.paths() if p.startswith("/activity/"))
    assert fetched == ["/activity/i90000001/file", "/activity/i90000003/file"]
    assert not archive.exists(CURSOR)


def test_health_only_skips_activities(provider, api, archive):
    result = run_fetch(provider, archive, log=log(), now=NOW, health_only=True)
    assert result.exit_code == 0 and result.activities.listed == 0
    assert not [p for p in api.paths() if "activit" in p]
    assert read(archive, CURSOR) == {"wellness": {"last_date": "2026-10-17"}}
    assert archive.exists(FRESHNESS)


def test_an_empty_part_never_replaces_stored_data(provider, api, archive):
    run_fetch(provider, archive, log=log(), now=NOW)
    key = "raw/intervals/activities/i90000001/streams.json"
    stored = archive.get(key)
    next(r for r in api.rows if r["id"] == "i90000001")["name"] = "changed"
    api.fail("/activity/i90000001/streams.json", (200, {"content-type": "application/json"}, b"[]"))
    assert run_fetch(provider, archive, log=log(), now=NOW).activities.fetched == 1
    assert archive.get(key) == stored


def test_wellness_days_are_rewritten_only_when_they_change(provider, api, archive):
    run_fetch(provider, archive, log=log(), now=NOW)
    api.wellness[4]["weight"] = 94.0  # a late correction on 2026-10-05
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert (result.wellness.written, result.wellness.unchanged) == (1, 4)
    assert read(archive, "raw/intervals/wellness/2026-10-05.json")["weight"] == 94.0


def test_freshness_keeps_other_sources(provider, archive):
    archive.put(
        FRESHNESS, b'{"justgiving":{"last_success_at":"2026-10-16T09:00:00Z"},"generated_at":"x"}'
    )
    run_fetch(provider, archive, log=log(), now=NOW)
    assert read(archive, FRESHNESS) == {
        "justgiving": {"last_success_at": "2026-10-16T09:00:00Z"},
        "intervals": {"last_success_at": "2026-10-17T11:00:00Z"},
        "generated_at": "2026-10-17T11:00:00Z",
    }


def test_an_archive_failure_exits_14(provider, archive, monkeypatch):
    real_put = archive.put

    def put(key, data, **kwargs):
        if key.endswith("detail.json"):
            raise ArchiveUnavailable("R2 put failed: InternalError")
        return real_put(key, data, **kwargs)

    monkeypatch.setattr(archive, "put", put)
    result = run_fetch(provider, archive, log=log(), now=NOW)
    assert result.exit_code == 14 and result.code == "archive_unavailable"
    assert read(archive, FETCH_STATUS)["intervals"]["code"] == "archive_unavailable"


def test_the_summary_holds_counts_only(provider, archive):
    summary = json.dumps(run_fetch(provider, archive, log=log(), now=NOW).summary())
    assert "i9000000" not in summary and "SENTINEL" not in summary and "51.12" not in summary


def test_logs_carry_no_ids_or_free_text(provider, api, archive):
    stream = io.StringIO()
    api.fail("/activity/i90000001/streams.json", "503", times=3)
    run_fetch(provider, archive, log=Logger("fetch", stream=stream), now=NOW)
    output = stream.getvalue()
    assert "activity_failed" in output
    assert "i9000000" not in output and "SENTINEL" not in output
