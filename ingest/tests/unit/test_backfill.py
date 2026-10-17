"""The resumable whole-history backfill (T055)."""

import io
import json
from datetime import UTC, date, datetime, timedelta

import pytest

from awingest.archive.local import LocalArchive
from awingest.backfill import run_backfill
from awingest.fetch import run_fetch
from awingest.logging import Logger
from awingest.state import BACKFILL, CURSOR, FETCH_STATUS, FRESHNESS

NOW = datetime(2026, 10, 17, 11, 0, tzinfo=UTC)
START = date(2026, 1, 1)


def log() -> Logger:
    return Logger("backfill", stream=io.StringIO())


def read(archive, key):
    data = archive.get(key)
    return None if data is None else json.loads(data)


@pytest.fixture
def archive(tmp_path) -> LocalArchive:
    return LocalArchive(tmp_path / "archive")


def test_a_backfill_walks_every_window(provider, api, archive):
    result = run_backfill(provider, archive, log=log(), start=START, now=NOW, window_days=30)
    assert (result.exit_code, result.outcome, result.complete) == (0, "ok", True)
    assert result.windows == 10  # 2026-01-01 .. 2026-10-17 in 30-day windows
    assert result.activities.fetched == 6
    assert result.wellness.written == 7
    progress = read(archive, BACKFILL)
    assert progress["completed_at"] == "2026-10-17T11:00:00Z"
    assert progress["next"] == "2026-10-18" and progress["windows_done"] == 10
    lists = [u for u in (r.full_url for r in api.requests) if "/athlete/0/activities" in u]
    assert "oldest=2026-01-01&newest=2026-01-30" in lists[0]
    assert "newest=2026-10-17" in lists[-1]


def test_it_sets_cursors_only_when_none_exist(provider, archive):
    run_backfill(provider, archive, log=log(), start=START, now=NOW)
    assert read(archive, CURSOR) == {
        "activities": {"last_date": "2026-10-17"},
        "wellness": {"last_date": "2026-10-17"},
    }
    archive.put(
        CURSOR, b'{"activities":{"last_date":"2026-10-20"},"wellness":{"last_date":"2026-10-20"}}'
    )
    run_backfill(provider, archive, log=log(), start=START, now=NOW)
    assert read(archive, CURSOR)["activities"]["last_date"] == "2026-10-20"


def test_it_leaves_freshness_to_the_regular_refresh(provider, archive):
    run_backfill(provider, archive, log=log(), start=START, now=NOW)
    assert not archive.exists(FRESHNESS)
    assert not archive.exists(FETCH_STATUS)


def test_a_rate_limit_saves_progress_and_resume_carries_on(provider, api, archive):
    # The 4th list call (window 2026-04-01 ..) is rate-limited.
    calls = {"n": 0}
    real = api.__call__

    def transport(request):
        if "/athlete/0/activities" in request.full_url:
            calls["n"] += 1
            if calls["n"] == 4:
                return 429, {"retry-after": "600"}, b""
        return real(request)

    provider._client_factory = lambda: provider_client(provider, transport)
    first = run_backfill(provider, archive, log=log(), start=START, now=NOW, window_days=30)
    assert first.exit_code == 11 and not first.complete
    progress = read(archive, BACKFILL)
    assert progress["next"] == "2026-04-01" and progress["completed_at"] is None
    status = read(archive, FETCH_STATUS)["intervals"]
    assert status["rate_limited_until"] == "2026-10-17T11:10:00Z"

    # Too soon: still backing off, nothing is called.
    api.requests.clear()
    early = run_backfill(provider, archive, log=log(), resume=True, now=NOW + timedelta(minutes=5))
    assert early.exit_code == 11 and not api.requests

    later = NOW + timedelta(minutes=11)
    resumed = run_backfill(provider, archive, log=log(), resume=True, now=later, window_days=30)
    assert resumed.exit_code == 0 and resumed.complete
    assert read(archive, BACKFILL)["from"] == "2026-01-01"
    lists = [u for u in (r.full_url for r in api.requests) if "/athlete/0/activities" in u]
    assert "oldest=2026-04-01" in lists[0]
    # Everything ends up archived exactly once across both runs.
    markers = [o for o in archive.list("raw/intervals/activities/") if o.key.endswith("fetch.json")]
    assert len(markers) == 6


def provider_client(provider, transport):
    from conftest import TEST_KEY

    from awingest.providers.intervals.client import IntervalsClient

    return IntervalsClient(TEST_KEY, transport=transport, sleep=lambda s: None)


def test_failed_windows_are_listed_for_a_rerun(provider, api, archive):
    api.fail("/activity/i90000002/streams.json", "503", times=3)
    result = run_backfill(provider, archive, log=log(), start=START, now=NOW, window_days=30)
    assert (result.exit_code, result.outcome, result.failed_windows) == (0, "partial", 1)
    assert read(archive, BACKFILL)["failed_windows"] == [["2026-01-01", "2026-01-30"]]


def test_a_rerun_skips_what_is_already_archived(provider, api, archive):
    run_backfill(provider, archive, log=log(), start=START, now=NOW)
    api.requests.clear()
    again = run_backfill(provider, archive, log=log(), start=START, now=NOW)
    assert again.activities.unchanged == 6 and again.activities.fetched == 0
    assert not [p for p in api.paths() if p.startswith("/activity/")]


def test_without_resume_a_new_backfill_starts_over(provider, archive):
    archive.put(BACKFILL, b'{"from":"2026-01-01","to":"2026-10-17","next":"2026-05-01"}')
    run_backfill(provider, archive, log=log(), start=date(2026, 9, 1), now=NOW)
    assert read(archive, BACKFILL)["from"] == "2026-09-01"


def test_the_regular_fetch_after_a_backfill_finds_nothing_new(provider, api, archive):
    run_backfill(provider, archive, log=log(), start=START, now=NOW)
    result = run_fetch(provider, archive, log=log(), now=NOW + timedelta(hours=2))
    assert result.activities.fetched == 0 and result.activities.unchanged == 1
