"""Levelling the altitude trace to the watch's gain and loss (process/elevation.py, 2026-11-19)."""

import math
from dataclasses import replace

import pytest
from builders import activity

from awingest.process.elevation import MIN_DRIFT_M, level
from awingest.process.sanitise import sanitise_run
from awingest.providers.intervals.normalise import km_splits
from awingest.schemas import PACKAGE_REPO, SchemaSet

SCHEMAS = SchemaSet(PACKAGE_REPO / "schemas")


def _with_trace(act, profile, *, gain=None, loss=None):
    """``act`` with each sample's altitude set by ``profile(t_s)`` and splits rebuilt from them."""
    samples = tuple(replace(s, elev_m=profile(s.t_s)) for s in act.samples)
    fields = {"samples": samples, "splits": km_splits(samples)}
    if gain is not None:
        fields |= {"elevation_gain_m": gain, "elevation_loss_m": loss}
    return replace(act, **fields)


def _hill(t: float) -> float:
    """A real hill: up 12 m and back down over the first 1,200 s."""
    return 50 + 12 * math.sin(math.pi * min(t, 1200) / 1200)


def test_a_loop_drifting_downhill_is_levelled_to_end_where_it_started():
    base = activity([(8200, 300)])
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda t: _hill(t) - 10.6 * t / end, gain=12.0, loss=12.0)

    levelled, drift = level(act)

    assert drift == pytest.approx(-10.6)
    first, last = levelled.samples[0].elev_m, levelled.samples[-1].elev_m
    assert last - first == pytest.approx(0, abs=1e-9)
    for s in levelled.samples:
        assert s.elev_m == pytest.approx(_hill(s.t_s), abs=1e-9)


def test_the_splits_match_splits_built_from_the_levelled_trace():
    base = activity([(3000, 300), (2500, 280)], step_s=3)
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda t: _hill(t) - 9.2 * t / end, gain=12.0, loss=12.0)

    levelled, _ = level(act)

    expected = km_splits(levelled.samples)
    assert [s.km for s in levelled.splits] == [s.km for s in expected]
    for got, want in zip(levelled.splits, expected, strict=True):
        assert got.elev_delta_m == pytest.approx(want.elev_delta_m, abs=1e-6)
        assert got.time_s == want.time_s
    assert sum(s.elev_delta_m for s in levelled.splits) == pytest.approx(0, abs=1e-6)


def test_a_point_to_point_run_keeps_its_real_height_difference():
    base = activity([(8200, 300)])
    end = base.samples[-1].t_s
    # The finish is 5 m lower (gain 3, loss 8); the trace says 15 m lower.
    act = _with_trace(base, lambda t: 60 - 15 * t / end, gain=3.0, loss=8.0)

    levelled, drift = level(act)

    assert drift == pytest.approx(-10)
    assert levelled.samples[-1].elev_m - levelled.samples[0].elev_m == pytest.approx(-5)


def test_the_gap_is_spread_over_the_time_between_the_first_and_last_readings():
    base = activity([(5000, 300)])
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda t: 40 + 6 * t / end, gain=0.0, loss=0.0)
    # No altitude for the first and last minute: the correction starts and ends with the readings.
    samples = tuple(
        replace(s, elev_m=None) if s.t_s < 60 or s.t_s > end - 60 else s for s in act.samples
    )
    levelled, drift = level(replace(act, samples=samples))

    readings = [s.elev_m for s in levelled.samples if s.elev_m is not None]
    assert drift == pytest.approx(6 * (end - 120) / end)
    assert readings[-1] == pytest.approx(readings[0])
    assert all(s.elev_m is None for s in levelled.samples if s.t_s < 60)


@pytest.mark.parametrize(
    "fields",
    [
        {"treadmill": True, "type": "indoor"},
        {"elevation_gain_m": None},
        {"elevation_loss_m": None},
    ],
)
def test_a_run_without_both_totals_is_left_as_recorded(fields):
    base = activity([(5000, 300)])
    act = replace(_with_trace(base, lambda t: 50 - t / 100, gain=0.0, loss=0.0), **fields)

    assert level(act) == (act, None)


def test_a_run_with_no_altitude_is_left_as_recorded():
    act = activity([(5000, 300)])  # the builder's samples have no altitude

    assert level(act) == (act, None)


def test_a_drift_under_the_minimum_is_left_as_recorded():
    base = activity([(5000, 300)])
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda t: 50 - (MIN_DRIFT_M - 0.1) * t / end, gain=0.0, loss=0.0)

    assert level(act) == (act, None)


def test_the_published_run_says_how_much_drift_was_taken_out():
    base = activity([(5000, 300)])
    end = base.samples[-1].t_s
    act, drift = level(_with_trace(base, lambda t: 50 - 7.34 * t / end, gain=0.0, loss=0.0))

    doc = sanitise_run(act, run_id="2026-11-18-abcd", elev_drift_m=drift)

    assert SCHEMAS.issues("published/run", doc) == []
    assert doc["elev_drift_m"] == -7.3
    assert doc["series"]["elev"][-1] == pytest.approx(doc["series"]["elev"][0], abs=0.2)


def test_no_drift_field_without_an_elevation_series():
    act = activity([(5000, 300)])

    doc = sanitise_run(act, run_id="2026-11-18-abcd", elev_drift_m=-3.0)

    assert "elev" not in doc["series"] and "elev_drift_m" not in doc
