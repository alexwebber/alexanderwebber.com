"""The intervals.icu adapter contract (T079; contracts/provider-adapter.md), against the synthetic
fixtures in ``tests/fixtures/intervals/`` served by ``FakeIntervalsApi``."""

import base64
import dataclasses
import io
import json
import math
import re
from datetime import UTC, date, datetime, timedelta

import pytest
from conftest import TEST_KEY

from awingest.archive.local import LocalArchive
from awingest.fetch import run_fetch
from awingest.logging import Logger
from awingest.providers.base import (
    AuthRejected,
    NormalisedActivity,
    ProviderChanged,
    ProviderForbidden,
    RateLimited,
    RawBundle,
    RawHealthDay,
    Transient,
    UnsupportedActivity,
)
from awingest.providers.intervals.client import USER_AGENT, IntervalsClient
from awingest.state import CURSOR, FETCH_STATUS

ALL = (date(2025, 1, 1), date(2026, 12, 31))
NOW = datetime(2026, 10, 17, 11, 0, tzinfo=UTC)
PUBLIC_RUN_ID = re.compile(r"\d{4}-\d{2}-\d{2}-[a-z2-7]{4}")


def bundles(provider, api) -> dict[str, RawBundle]:
    """Every listed run's raw bundle, keyed by its fixture folder name."""
    with provider.session() as session:
        refs = session.list_activities(*ALL)
        return {api.names[r.provider_id]: session.fetch_activity(r) for r in refs}


@pytest.fixture
def runs(provider, api) -> dict[str, NormalisedActivity]:
    return {name: provider.normalise_activity(b) for name, b in bundles(provider, api).items()}


# --- Listing and requests ---


def test_only_running_activities_are_listed(provider, api):
    with provider.session() as session:
        refs = session.list_activities(*ALL)
    names = sorted(api.names[r.provider_id] for r in refs)
    assert names == ["race", "run-basic", "run-dynamics", "trail", "trainer-run", "treadmill"]


def test_refs_carry_a_stable_row_hash_and_hide_the_id(provider):
    with provider.session() as session:
        first = session.list_activities(*ALL)
        second = session.list_activities(*ALL)
    assert [r.row_hash for r in first] == [r.row_hash for r in second]
    assert all(re.fullmatch(r"[0-9a-f]{64}", r.row_hash) for r in first)
    assert all("i9000000" not in repr(r) for r in first)


def test_every_request_has_the_user_agent_and_basic_auth(provider, api):
    bundles(provider, api)
    expected = "Basic " + base64.b64encode(f"API_KEY:{TEST_KEY}".encode()).decode()
    assert api.requests
    for request in api.requests:
        assert request.get_header("User-agent") == USER_AGENT
        assert USER_AGENT.startswith("alexanderwebber.com-ingest/")
        assert "+https://alexanderwebber.com" in USER_AGENT
        assert request.get_header("Authorization") == expected
        assert TEST_KEY not in request.full_url
        assert request.full_url.startswith("https://intervals.icu/api/v1/")


def test_list_and_wellness_use_the_date_window(provider, api):
    with provider.session() as session:
        session.list_activities(date(2026, 3, 1), date(2026, 3, 31))
        session.fetch_health(date(2026, 10, 2), date(2026, 10, 3))
    assert "oldest=2026-03-01&newest=2026-03-31" in api.requests[0].full_url
    assert "/athlete/0/wellness?oldest=2026-10-02&newest=2026-10-03" in api.requests[1].full_url


def test_calls_are_paced_at_least_a_second_apart(provider, api, clock):
    bundles(provider, api)
    assert clock.sleeps and all(s >= 1.0 for s in clock.sleeps)


def test_fetch_activity_returns_every_part_and_skips_missing_optional_ones(provider, api):
    parts = {name: sorted(b.parts) for name, b in bundles(provider, api).items()}
    full = ["activity.fit", "detail.json", "streams.json", "summary.json", "time-at-hr.json"]
    assert parts["run-dynamics"] == full
    # run-basic has no HR time or FIT file (404s), so the bundle simply lacks them.
    assert parts["run-basic"] == ["detail.json", "streams.json", "summary.json"]


# --- Normalised output ---


def test_required_fields_and_units(runs):
    run = runs["run-dynamics"]
    assert run.source == "intervals"
    assert run.distance_m == 10200.0
    assert run.moving_s == 3060.0 and run.elapsed_s == 3102.0
    assert run.avg_hr == 148.0 and run.max_hr == 171.0
    assert run.avg_cadence == 87.2 and run.avg_stride_m == 1.18
    assert run.elevation_gain_m == 41.0 and run.elevation_loss_m == 39.5
    assert run.training_load == 64.0
    assert run.training_effect is None
    assert [(z.zone, z.seconds) for z in run.hr_zones][:3] == [(1, 300.0), (2, 900.0), (3, 1200.0)]


@pytest.mark.parametrize(
    ("name", "kind", "treadmill"),
    [
        ("run-dynamics", "road", False),
        ("run-basic", "road", False),
        ("race", "road", False),
        ("trail", "trail", False),
        ("treadmill", "indoor", True),
        ("trainer-run", "indoor", False),
    ],
)
def test_type_mapping(runs, name, kind, treadmill):
    assert (runs[name].type, runs[name].treadmill) == (kind, treadmill)


def test_the_race_flag_is_carried(runs):
    assert runs["race"].is_race_flag is True
    assert runs["run-dynamics"].is_race_flag is False


def test_non_run_activities_are_rejected():
    from conftest import INTERVALS_FIXTURES

    from awingest.providers.intervals.normalise import normalise_activity

    detail = (INTERVALS_FIXTURES / "activities/weights/detail.json").read_bytes()
    ref = dataclasses.replace(_ref(), provider_id="i90000007")
    with pytest.raises(UnsupportedActivity):
        normalise_activity(RawBundle(ref=ref, parts={"detail.json": detail}))


def _ref():
    from awingest.providers.base import ActivityRef

    return ActivityRef(
        provider_id="i90000001", start_local=datetime(2026, 1, 1, tzinfo=UTC), row_hash="0" * 64
    )


def test_missing_optional_metrics_are_none_never_zero(runs):
    basic = runs["run-basic"]
    assert basic.max_hr is None  # arrived as 0
    assert basic.avg_stride_m is None  # arrived as null
    assert basic.avg_power_w is None  # no device power
    assert basic.dynamics is None
    assert basic.hr_zones  # present values are still kept
    treadmill = runs["treadmill"]
    assert treadmill.elevation_gain_m is None and treadmill.elevation_loss_m is None
    assert all(s.elev_m is None for s in treadmill.samples)


def test_dynamics_and_power(runs):
    run = runs["run-dynamics"]
    assert run.dynamics.gct_ms == 241.5
    assert run.dynamics.vert_osc_mm == 86.4
    assert run.dynamics.vert_ratio_pct == 7.3
    # No summary balance, so it is derived from the stance_time_balance stream.
    assert run.dynamics.gct_balance_pct == pytest.approx(49.8, abs=0.01)
    # icu_average_watts is empty, so power comes from the watts stream (device_watts).
    assert 250 <= run.avg_power_w <= 270


def test_per_km_splits_come_from_the_streams(runs):
    for name, run in runs.items():
        splits = run.splits
        assert len(splits) == math.ceil(run.distance_m / 1000 - 1e-9), name
        assert [s.km for s in splits] == list(range(1, len(splits) + 1))
        assert all(s.distance_m == 1000.0 for s in splits[:-1])
        assert sum(s.distance_m for s in splits) == pytest.approx(run.distance_m, abs=0.5)
        assert sum(s.time_s for s in splits) == pytest.approx(run.samples[-1].t_s, abs=0.01)
    race = runs["race"].splits
    assert race[-1].distance_m == pytest.approx(97.5, abs=0.5)  # 21.0975 km ends mid-km
    assert all(s.avg_hr is not None for s in race)
    assert runs["trail"].splits[0].elev_delta_m is not None
    assert all(s.elev_delta_m is None for s in runs["treadmill"].splits)


def test_samples_keep_private_coordinates_for_outdoor_runs_only(runs):
    outdoor = runs["run-dynamics"].samples
    assert outdoor[0].lat == pytest.approx(51.1234567) and outdoor[0].lon == pytest.approx(
        -0.7654321
    )
    assert all(s.lat is None and s.lon is None for s in runs["treadmill"].samples)
    assert all(s.lat is None for s in runs["trainer-run"].samples)  # no latlng stream
    assert "51.12" not in repr(runs["run-dynamics"])
    # The heart-rate gap in the stream stays a gap.
    assert outdoor[3].hr is None


def test_start_times_are_europe_london(runs):
    summer, winter = runs["run-dynamics"].start_local, runs["run-basic"].start_local
    assert str(summer.tzinfo) == "Europe/London" and summer.utcoffset() == timedelta(hours=1)
    assert winter.utcoffset() == timedelta(0)
    assert (summer.date(), summer.hour, summer.minute) == (date(2026, 10, 11), 7, 15)


def test_normalising_is_deterministic(provider, api):
    first = {n: provider.normalise_activity(b) for n, b in bundles(provider, api).items()}
    again = {n: provider.normalise_activity(b) for n, b in bundles(provider, api).items()}
    assert first == again


def test_the_adapter_never_emits_a_public_id(runs):
    field_names = {f.name for f in dataclasses.fields(NormalisedActivity)}
    assert not field_names & {"id", "run_id", "public_id"}
    for run in runs.values():
        values = [str(getattr(run, f)) for f in field_names if f != "samples"]
        assert not any(PUBLIC_RUN_ID.search(v) for v in values)


def test_free_text_is_private(runs):
    run = runs["run-dynamics"]
    assert run.title_raw.startswith("SENTINEL") and run.description_raw.startswith("SENTINEL")
    assert "SENTINEL" not in repr(run) and "i90000001" not in repr(run)


# --- Wellness ---


def test_wellness_is_reduced_to_approved_keys_before_it_is_returned(provider):
    with provider.session() as session:
        days = list(session.fetch_health(date(2026, 10, 1), date(2026, 10, 31)))
    assert [d.day for d in days] == [date(2026, 10, i) for i in range(1, 8)]  # 10-08 dropped
    for day in days:
        record = json.loads(day.payload)
        assert set(record) <= {
            "id",
            "weight",
            "bodyFat",
            "restingHR",
            "hrv",
            "vo2max",
            "ctl",
            "atl",
        }
        for private in (b"sleepSecs", b"steps", b"spO2", b"sleepScore", b"SENTINEL", b"comments"):
            assert private not in day.payload


def test_wellness_normalises_to_approved_metrics(provider):
    with provider.session() as session:
        days = list(session.fetch_health(date(2026, 10, 1), date(2026, 10, 7)))
    readings = [r for d in days for r in provider.normalise_health(d)]
    assert {r.metric for r in readings} == set(provider.metrics)
    first = {r.metric: r.value for r in provider.normalise_health(days[0])}
    assert first == {
        "weight_kg": 95.1,
        "body_fat_pct": 19.45,
        "resting_hr": 53.0,
        "hrv": 62.0,
        "vo2max": 51.0,
        "fitness_ctl": 49.2,
        "fatigue_atl": 56.0,
    }
    # Day 3 recorded weight as 0 and had no body fat or VO2 max: no readings for those.
    third = {r.metric for r in provider.normalise_health(days[2])}
    assert not third & {"weight_kg", "body_fat_pct", "vo2max"}


def test_normalise_health_rejects_garbage():
    from awingest.providers.intervals.normalise import normalise_health

    with pytest.raises(ProviderChanged):
        normalise_health(RawHealthDay(day=date(2026, 1, 1), payload=b"not json"))


# --- Error mapping ---


@pytest.mark.parametrize(
    ("response", "error"),
    [
        ("401", AuthRejected),
        ("403-json", AuthRejected),
        ("403-html", ProviderForbidden),
        ("429", RateLimited),
    ],
)
def test_http_errors_map_to_the_taxonomy(provider, api, response, error):
    api.fail("/athlete/0/activities", response)
    with provider.session() as session, pytest.raises(error) as caught:
        session.list_activities(*ALL)
    assert TEST_KEY not in str(caught.value)
    assert "i9000000" not in str(caught.value)


def test_a_429_carries_retry_after(provider, api):
    api.fail("/athlete/0/activities", "429")
    with provider.session() as session, pytest.raises(RateLimited) as caught:
        session.list_activities(*ALL)
    assert caught.value.retry_after == 120.0
    assert caught.value.exit_code == 11


def test_a_short_429_is_waited_out_once(provider, api, clock):
    api.fail("/athlete/0/activities", (429, {"retry-after": "5"}, b""))
    with provider.session() as session:
        assert session.list_activities(*ALL)
    assert 5.0 in clock.sleeps


def test_5xx_is_retried_then_transient(provider, api):
    api.fail("/athlete/0/activities", "503", times=3)
    with provider.session() as session, pytest.raises(Transient):
        session.list_activities(*ALL)
    assert len(api.requests) == 3  # the first try and two retries


def test_5xx_that_recovers_is_not_an_error(provider, api):
    api.fail("/athlete/0/activities", "503", times=1)
    with provider.session() as session:
        assert session.list_activities(*ALL)


@pytest.mark.parametrize(
    "response",
    [
        (200, {"content-type": "application/json"}, b"<html>not json</html>"),
        (200, {"content-type": "application/json"}, b'{"not": "a list"}'),
        (200, {"content-type": "application/json"}, b'[{"type": "Run", "id": "../../x"}]'),
        (404, {"content-type": "application/json"}, b"{}"),
        (418, {}, b""),
    ],
)
def test_shape_and_unexpected_status_errors_are_provider_changed(provider, api, response):
    api.fail("/athlete/0/activities", response)
    with provider.session() as session, pytest.raises(ProviderChanged):
        session.list_activities(*ALL)


def test_network_errors_are_transient(make_client):
    def broken(request):
        raise ConnectionResetError("reset by peer")

    client = make_client(transport=broken, retries=0)
    with pytest.raises(Transient):
        client.get_json("/athlete/0/activities")


def test_a_missing_key_is_auth_rejected(monkeypatch):
    monkeypatch.delenv("INTERVALS_API_KEY", raising=False)
    with pytest.raises(AuthRejected):
        IntervalsClient.from_env()


def test_the_client_repr_hides_the_key(make_client):
    assert TEST_KEY not in repr(make_client())


def test_the_key_never_appears_in_logs(provider, api, tmp_path, monkeypatch):
    monkeypatch.setenv("INTERVALS_API_KEY", TEST_KEY)
    api.fail("/athlete/0/activities", "401")
    stream = io.StringIO()
    result = run_fetch(
        provider, LocalArchive(tmp_path), log=Logger("fetch", stream=stream), now=NOW
    )
    assert result.exit_code == 10
    basic = base64.b64encode(f"API_KEY:{TEST_KEY}".encode()).decode()
    output = stream.getvalue() + (tmp_path / "state/fetch-status.json").read_text()
    assert TEST_KEY not in output and basic not in output
    assert "auth_rejected" in output


def test_a_429_records_rate_limited_until(provider, api, tmp_path):
    api.fail("/athlete/0/activities", "429")
    archive = LocalArchive(tmp_path)
    result = run_fetch(provider, archive, log=Logger("fetch", stream=io.StringIO()), now=NOW)
    assert result.exit_code == 11
    status = json.loads(archive.get(FETCH_STATUS))["intervals"]
    assert status["rate_limited_until"] == "2026-10-17T11:02:00Z"  # Retry-After: 120


# --- Archiving and incremental windows ---


def test_archived_wellness_has_approved_keys_only(provider, tmp_path):
    archive = LocalArchive(tmp_path)
    run_fetch(
        provider,
        archive,
        log=Logger("fetch", stream=io.StringIO()),
        now=NOW,
        reimport_from=date(2026, 10, 1),
    )
    objects = [o.key for o in archive.list("raw/intervals/wellness/")]
    assert len(objects) == 7 and "raw/intervals/wellness/2026-10-08.json" not in objects
    for key in objects:
        data = archive.get(key)
        assert b"sleepSecs" not in data and b"steps" not in data and b"spO2" not in data


def test_the_window_is_cursor_minus_14_days(provider, api, tmp_path):
    archive = LocalArchive(tmp_path)
    archive.put(
        CURSOR,
        json.dumps(
            {"activities": {"last_date": "2026-10-10"}, "wellness": {"last_date": "2026-10-05"}}
        ).encode(),
    )
    run_fetch(provider, archive, log=Logger("fetch", stream=io.StringIO()), now=NOW)
    urls = [r.full_url for r in api.requests]
    assert any("activities?oldest=2026-09-26&newest=2026-10-17" in u for u in urls)
    assert any("wellness?oldest=2026-09-21&newest=2026-10-17" in u for u in urls)


def test_unchanged_rows_are_not_refetched_and_changed_ones_are(provider, api, tmp_path):
    archive = LocalArchive(tmp_path)
    log = Logger("fetch", stream=io.StringIO())
    first = run_fetch(provider, archive, log=log, now=NOW, reimport_from=date(2026, 1, 1))
    assert first.activities.fetched == 6
    api.requests.clear()
    second = run_fetch(provider, archive, log=log, now=NOW, reimport_from=None)
    assert second.activities.unchanged == 1 and second.activities.fetched == 0
    assert not [p for p in api.paths() if p.startswith("/activity/")]
    # The owner renames the run in intervals.icu: its list row changes, so it is re-fetched.
    next(r for r in api.rows if r["id"] == "i90000001")["name"] = "SENTINEL renamed"
    api.requests.clear()
    third = run_fetch(provider, archive, log=log, now=NOW)
    assert third.activities.fetched == 1
    assert "/activity/i90000001" in api.paths()
    assert b"SENTINEL renamed" in archive.get("raw/intervals/activities/i90000001/detail.json")
