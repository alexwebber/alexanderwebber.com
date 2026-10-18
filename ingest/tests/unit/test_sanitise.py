"""The allow-list sanitiser (T062, T080; data-model §7). Every published run must validate, and
nothing private may survive: start times, coordinates, provider free text or provider IDs."""

import json
import random
from dataclasses import replace
from datetime import datetime, timedelta

import pytest
from builders import LONDON, activity

from awingest.process.overrides import RaceLink, RunOverride
from awingest.process.sanitise import MAX_SERIES_POINTS, Unpublishable, sanitise_run, series
from awingest.process.titles import neutral_title, run_title
from awingest.providers.base import Dynamics, Sample
from awingest.publish.writer import canonical_json
from awingest.schemas import PACKAGE_REPO, SchemaSet

RUN = "2026-10-11-k3f7"
SCHEMAS = SchemaSet(PACKAGE_REPO / "schemas")

# Everything a published run may hold (run.schema.json); the sanitiser must add nothing else.
ALLOWED = {
    "schema_version", "id", "date", "type", "treadmill", "is_race", "title", "note", "device",
    "distance_m", "moving_s", "elapsed_s", "elevation_gain_m", "elevation_loss_m",
    "avg_pace_s_per_km", "best_pace_s_per_km", "hr", "cadence_avg", "stride_m_avg",
    "power_w_avg", "dynamics", "training_effect", "splits", "hr_zones", "series",
    "best_efforts", "flags", "track_ref",
}  # fmt: skip


def valid(run):
    assert SCHEMAS.issues("published/run", run) == []
    return run


def test_a_full_run_is_built_from_the_allow_list_and_validates():
    run = valid(sanitise_run(activity(), run_id=RUN))
    assert set(run) <= ALLOWED
    assert run["id"] == RUN and run["date"] == "2026-10-11"
    assert run["title"] == "Run · 8.2 km"
    assert run["hr"] == {"avg": 150, "max": 171}
    assert run["dynamics"] == {
        "gct_ms": 245.0,
        "gct_balance_pct": 50.2,
        "vert_osc_mm": 88.0,
        "vert_ratio_pct": 7.9,
    }
    assert run["avg_pace_s_per_km"] == pytest.approx(300, abs=0.5)
    assert run["best_pace_s_per_km"] <= run["avg_pace_s_per_km"]
    assert run["splits"] == [
        {"km": 1, "time_s": 300, "pace_s_per_km": 300.0, "hr": 150, "elev_delta_m": 2.0}
    ]
    assert run["flags"] == {}
    assert "track_ref" not in run  # race tracks are T125's
    assert "training_effect" not in run  # intervals.icu doesn't supply it


def test_missing_metrics_are_omitted_not_zero():
    bare = activity(
        avg_hr=None,
        max_hr=None,
        avg_cadence=None,
        avg_stride_m=None,
        avg_power_w=None,
        dynamics=None,
        elevation_gain_m=None,
        elevation_loss_m=None,
        hr_zones=(),
        samples=tuple(replace(s, hr=None, cadence=None) for s in activity().samples),
    )
    run = valid(sanitise_run(bare, run_id=RUN))
    for key in ("hr", "cadence_avg", "stride_m_avg", "power_w_avg", "dynamics", "hr_zones",
                "elevation_gain_m", "elevation_loss_m"):  # fmt: skip
        assert key not in run
    assert set(run["series"]) == {"x_dist_m", "x_elapsed_s", "pace"}


def test_the_device_is_kept_for_the_attribution_and_omitted_when_unknown():
    assert valid(sanitise_run(activity(device="Venu X1"), run_id=RUN))["device"] == "Venu X1"
    assert "device" not in valid(sanitise_run(activity(), run_id=RUN))


def test_out_of_range_values_are_left_out_rather_than_failing():
    odd = activity(max_hr=300.0, dynamics=Dynamics(gct_ms=240.0, vert_ratio_pct=140.0))
    run = valid(sanitise_run(odd, run_id=RUN))
    assert "hr" not in run
    assert run["dynamics"] == {"gct_ms": 240.0}


def test_treadmill_and_owner_flags_are_mirrored():
    treadmill = activity(
        type="indoor", treadmill=True, elevation_gain_m=None, elevation_loss_m=None
    )
    override = RunOverride(include_in_records=True, exclude_from_records=True, note="Hill reps")
    run = valid(sanitise_run(treadmill, run_id=RUN, override=override))
    assert run["treadmill"] is True and run["type"] == "indoor"
    assert run["title"] == "Treadmill run · 8.2 km"
    assert run["flags"] == {"include_indoor_in_records": True, "excluded_from_records": True}
    assert run["note"] == "Hill reps"


@pytest.mark.parametrize(
    ("flag", "override", "designate", "expected"),
    [
        (False, None, None, False),
        (True, None, None, True),
        (False, None, "race", True),
        (False, None, "linked", True),  # a linked race.yaml designates the run by itself
        (True, None, "not_race", False),
        (False, True, "not_race", True),  # run-overrides wins over race.yaml
        (True, False, None, False),
    ],
)
def test_is_race_comes_from_the_owner_first_then_the_provider(flag, override, designate, expected):
    race = None if designate is None else RaceLink(slug="x", designate=designate)
    if designate == "linked":
        race = RaceLink(slug="x")
    run = sanitise_run(
        activity(is_race_flag=flag), run_id=RUN, override=RunOverride(is_race=override), race=race
    )
    assert run["is_race"] is expected


def test_titles():
    a = activity()
    assert neutral_title(replace(a, type="trail")) == "Trail run · 8.2 km"
    assert neutral_title(replace(a, type="indoor")) == "Indoor run · 8.2 km"
    assert run_title(a, is_race=True) == "Race · 8.2 km"
    assert run_title(a, is_race=True, race_name="Hastings Half") == "Hastings Half"
    assert run_title(a, is_race=False, race_name="Hastings Half") == "Run · 8.2 km"
    assert run_title(a, is_race=True, custom="My title", race_name="Hastings Half") == "My title"


def test_a_run_without_distance_or_time_is_unpublishable():
    with pytest.raises(Unpublishable):
        sanitise_run(activity(distance_m=0.0), run_id=RUN)
    with pytest.raises(Unpublishable):
        sanitise_run(activity(moving_s=0.0, elapsed_s=0.0), run_id=RUN)


def test_series_are_capped_at_600_points_and_aligned():
    long = activity([(42195, 290)], step_s=1.0)
    out = series(long.samples)
    lengths = {len(v) for v in out.values()}
    assert lengths == {MAX_SERIES_POINTS}
    assert out["x_dist_m"] == sorted(out["x_dist_m"]) and out["x_dist_m"][-1] <= 42195
    assert out["x_elapsed_s"] == sorted(out["x_elapsed_s"])
    assert all(p == pytest.approx(290, abs=1) for p in out["pace"])


def test_stopped_samples_have_no_pace():
    points = [Sample(t_s=t, dist_m=float(t), speed_mps=0.1) for t in range(5)]
    assert series(points)["pace"] == [None] * 5


def test_speed_is_derived_when_the_stream_has_none():
    points = [Sample(t_s=t * 10, dist_m=t * 30.0) for t in range(4)]
    assert series(points)["pace"] == [None, 333.3, 333.3, 333.3]


# --- Property test: nothing private survives (data-model §7 rule 6) ---

SENTINELS = ("SENTINEL", "i90000042", "garmin_sentinel_")


def random_activity(rng: random.Random):
    lat0, lon0 = 51.1234567 + rng.random() * 0.01, -0.7654321 - rng.random() * 0.01
    start = datetime(2026, 1, 1, 6, 0, tzinfo=LONDON) + timedelta(
        days=rng.randrange(300), hours=rng.randrange(14), minutes=rng.randrange(60)
    )
    segments = [(rng.uniform(300, 6000), rng.uniform(170, 600)) for _ in range(rng.randint(1, 4))]
    base = activity(segments, start=start, step_s=rng.choice([1.0, 3.0, 10.0]))
    noisy = tuple(
        replace(
            s,
            lat=lat0 + i * 1e-5,
            lon=lon0 - i * 1e-5,
            hr=rng.choice([None, rng.uniform(90, 190)]),
            power=rng.choice([None, rng.uniform(200, 700)]),
            elev_m=rng.choice([None, rng.uniform(-5, 300)]),
        )
        for i, s in enumerate(base.samples)
    )
    kind = rng.choice(["road", "trail", "indoor"])
    return replace(
        base,
        provider_id=rng.choice(["i90000042", "garmin_sentinel_77", "i90000043"]),
        type=kind,
        treadmill=kind == "indoor" and rng.random() < 0.5,
        is_race_flag=rng.random() < 0.3,
        title_raw=f"SENTINEL {rng.choice(['Hastings', 'Brighton', 'Home loop'])} Running",
        description_raw="SENTINEL past 12 Example Street",
        samples=noisy,
    )


def test_no_start_time_coordinate_free_text_or_provider_id_survives():
    rng = random.Random(20261017)
    for _ in range(60):
        a = random_activity(rng)
        is_race = rng.random() < 0.5
        override = RunOverride(is_race=is_race)
        run = valid(sanitise_run(a, run_id=RUN, override=override, goal_distances=[8000]))
        text = canonical_json(run).decode()
        for sentinel in SENTINELS:
            assert sentinel not in text
        assert a.provider_id not in text
        assert a.start_local.strftime("%H:%M") not in text
        assert "T0" not in text and "T1" not in text  # no ISO datetimes
        lat, lon = a.samples[0].lat, a.samples[0].lon
        for coordinate in (lat, lon):
            assert f"{coordinate:.4f}" not in text
        keys = set(json.loads(text)) | {k for v in run.values() if isinstance(v, dict) for k in v}
        assert not keys & {
            "lat",
            "lon",
            "latlng",
            "start_local",
            "start_time",
            "name",
            "description",
        }
