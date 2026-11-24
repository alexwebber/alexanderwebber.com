"""Correcting the altimeter's drift (process/elevation.py): from the places a run passes more than
once (2026-11-20), else levelled to the watch's gain and loss (2026-11-19)."""

import math
from dataclasses import replace

import pytest
from builders import activity

from awingest.process.elevation import MIN_DRIFT_M, Levelling, level
from awingest.process.sanitise import sanitise_run
from awingest.providers.intervals.normalise import km_splits
from awingest.schemas import PACKAGE_REPO, SchemaSet

SCHEMAS = SchemaSet(PACKAGE_REPO / "schemas")
LAP_M = 1000.0
M_PER_DEG = 111_195.0


def _with_trace(act, profile, *, gain=None, loss=None):
    """``act`` with each sample's altitude set by ``profile(sample)`` and splits rebuilt from
    them."""
    samples = tuple(replace(s, elev_m=profile(s)) for s in act.samples)
    fields = {"samples": samples, "splits": km_splits(samples)}
    if gain is not None:
        fields |= {"elevation_gain_m": gain, "elevation_loss_m": loss}
    return replace(act, **fields)


def _on_laps(act):
    """``act`` run as laps of a round park ``LAP_M`` round, placed from each sample's distance."""
    radius = LAP_M / (2 * math.pi)

    def place(s):
        theta = 2 * math.pi * s.dist_m / LAP_M
        lat = 51.0 + radius * math.sin(theta) / M_PER_DEG
        lon = radius * math.cos(theta) / (M_PER_DEG * math.cos(math.radians(51.0)))
        return replace(s, lat=lat, lon=lon)

    return replace(act, samples=tuple(place(s) for s in act.samples))


def _on_a_straight_line(act):
    """``act`` run due north, so it never passes the same spot twice."""
    return replace(
        act,
        samples=tuple(replace(s, lat=51.0 + s.dist_m / M_PER_DEG, lon=0.0) for s in act.samples),
    )


def _park(s) -> float:
    """The park's real ground: the same height every lap at the same point on the loop."""
    theta = 2 * math.pi * s.dist_m / LAP_M
    return 50 + 4 * math.sin(theta) + 2 * math.cos(2 * theta)


def _hill(s) -> float:
    """A real hill: up 12 m and back down over the first 1,200 s."""
    return 50 + 12 * math.sin(math.pi * min(s.t_s, 1200) / 1200)


# --- Repeat passes ----------------------------------------------------------------------------


def test_laps_whose_drift_sinks_and_comes_back_are_corrected_from_the_repeat_passes():
    base = _on_laps(activity([(6000, 300)], step_s=1))
    end = base.samples[-1].t_s

    def sinks_and_returns(s):
        return -14 * math.sin(math.pi * s.t_s / end)

    act = _with_trace(base, lambda s: _park(s) + sinks_and_returns(s), gain=30.0, loss=30.0)

    corrected, levelling = level(act)

    assert levelling.method == "repeat-passes"
    assert levelling.drift_m == pytest.approx(-14, abs=1)
    for s in corrected.samples:
        assert s.elev_m == pytest.approx(_park(s), abs=0.5)


def test_laps_drifting_steadily_are_corrected_and_their_splits_follow():
    base = _on_laps(activity([(5000, 300)], step_s=1))
    act = _with_trace(base, lambda s: _park(s) - 20 * s.t_s / 3600)

    corrected, levelling = level(act)

    assert levelling.method == "repeat-passes"
    for s in corrected.samples:
        assert s.elev_m == pytest.approx(_park(s), abs=0.3)
    expected = km_splits(corrected.samples)
    for got, want in zip(corrected.splits, expected, strict=True):
        assert got.elev_delta_m == pytest.approx(want.elev_delta_m, abs=1e-6)


def test_laps_without_drift_are_left_as_recorded():
    act = _with_trace(_on_laps(activity([(5000, 300)], step_s=1)), _park, gain=30.0, loss=0.0)

    assert level(act) == (act, None)


def test_a_run_with_gps_that_never_passes_the_same_spot_falls_back_to_the_totals():
    base = _on_a_straight_line(activity([(8200, 300)]))
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda s: 60 - 15 * s.t_s / end, gain=3.0, loss=8.0)

    corrected, levelling = level(act)

    assert levelling == Levelling(pytest.approx(-10), "totals")
    assert corrected.samples[-1].elev_m - corrected.samples[0].elev_m == pytest.approx(-5)


# --- Levelled to the gain and loss (no repeat passes) -----------------------------------------


def test_a_loop_drifting_downhill_is_levelled_to_end_where_it_started():
    base = activity([(8200, 300)])
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda s: _hill(s) - 10.6 * s.t_s / end, gain=12.0, loss=12.0)

    levelled, levelling = level(act)

    assert levelling == Levelling(pytest.approx(-10.6), "totals")
    first, last = levelled.samples[0].elev_m, levelled.samples[-1].elev_m
    assert last - first == pytest.approx(0, abs=1e-9)
    for s in levelled.samples:
        assert s.elev_m == pytest.approx(_hill(s), abs=1e-9)


def test_the_splits_match_splits_built_from_the_levelled_trace():
    base = activity([(3000, 300), (2500, 280)], step_s=3)
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda s: _hill(s) - 9.2 * s.t_s / end, gain=12.0, loss=12.0)

    levelled, _ = level(act)

    expected = km_splits(levelled.samples)
    assert [s.km for s in levelled.splits] == [s.km for s in expected]
    for got, want in zip(levelled.splits, expected, strict=True):
        assert got.elev_delta_m == pytest.approx(want.elev_delta_m, abs=1e-6)
        assert got.time_s == want.time_s
    assert sum(s.elev_delta_m for s in levelled.splits) == pytest.approx(0, abs=1e-6)


def test_the_gap_is_spread_over_the_time_between_the_first_and_last_readings():
    base = activity([(5000, 300)])
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda s: 40 + 6 * s.t_s / end, gain=0.0, loss=0.0)
    # No altitude for the first and last minute: the correction starts and ends with the readings.
    samples = tuple(
        replace(s, elev_m=None) if s.t_s < 60 or s.t_s > end - 60 else s for s in act.samples
    )
    levelled, levelling = level(replace(act, samples=samples))

    readings = [s.elev_m for s in levelled.samples if s.elev_m is not None]
    assert levelling.drift_m == pytest.approx(6 * (end - 120) / end)
    assert readings[-1] == pytest.approx(readings[0])
    assert all(s.elev_m is None for s in levelled.samples if s.t_s < 60)


# --- Left as recorded -------------------------------------------------------------------------


@pytest.mark.parametrize(
    "fields",
    [
        {"elevation_gain_m": None},
        {"elevation_loss_m": None},
    ],
)
def test_a_run_without_both_totals_or_repeat_passes_is_left_as_recorded(fields):
    base = activity([(5000, 300)])
    act = replace(_with_trace(base, lambda s: 50 - s.t_s / 100, gain=0.0, loss=0.0), **fields)

    assert level(act) == (act, None)


def test_a_treadmill_run_is_left_as_recorded():
    base = _on_laps(activity([(5000, 300)], step_s=1))
    act = replace(_with_trace(base, lambda s: 50 - s.t_s / 100), treadmill=True, type="indoor")

    assert level(act) == (act, None)


def test_a_run_with_no_altitude_is_left_as_recorded():
    act = activity([(5000, 300)])  # the builder's samples have no altitude

    assert level(act) == (act, None)


def test_a_drift_under_the_minimum_is_left_as_recorded():
    base = activity([(5000, 300)])
    end = base.samples[-1].t_s
    act = _with_trace(base, lambda s: 50 - (MIN_DRIFT_M - 0.1) * s.t_s / end, gain=0.0, loss=0.0)

    assert level(act) == (act, None)


# --- Published ----------------------------------------------------------------------------------


def test_the_published_run_says_how_much_drift_was_taken_out_and_how():
    base = _on_laps(activity([(5000, 300)], step_s=1))
    act, levelling = level(_with_trace(base, lambda s: _park(s) - 22 * s.t_s / 3600))

    doc = sanitise_run(act, run_id="2026-11-18-abcd", levelling=levelling)

    assert SCHEMAS.issues("published/run", doc) == []
    assert doc["elev_drift_method"] == "repeat-passes"
    assert doc["elev_drift_m"] == pytest.approx(-22 * base.samples[-1].t_s / 3600, abs=0.5)


def test_no_drift_fields_without_an_elevation_series():
    act = activity([(5000, 300)])

    doc = sanitise_run(act, run_id="2026-11-18-abcd", levelling=Levelling(-3.0, "totals"))

    assert "elev" not in doc["series"]
    assert "elev_drift_m" not in doc and "elev_drift_method" not in doc
