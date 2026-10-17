"""Best efforts (T059, T081): the sliding window, interpolation and the distances covered."""

import pytest
from builders import samples

from awingest.process.best_efforts import best_efforts, effort_distances, fastest, track
from awingest.providers.base import Sample


def efforts_by_label(points, extra=()):
    return {e.label: e for e in best_efforts(points, extra)}


def test_a_44_41_continuous_10k_is_found_inside_a_longer_run():
    # 3 km easy, 10 km at 268.1 s/km (44:41), 3 km easy, sampled every second.
    points = samples([(3000, 330), (10000, 268.1), (3000, 330)], step_s=1.0)
    ten = efforts_by_label(points)["10k"]
    assert ten.time_s == pytest.approx(2681, abs=0.5)
    assert ten.plausible


def test_the_window_start_is_interpolated_between_samples():
    # Sampled every 30 s at an even 300 s/km: windows rarely start on a sample.
    points = samples([(6000, 300)], step_s=30.0)
    efforts = efforts_by_label(points)
    assert efforts["1k"].time_s == pytest.approx(300, abs=0.1)
    assert efforts["1mi"].time_s == pytest.approx(482.8, abs=0.1)
    assert efforts["5k"].time_s == pytest.approx(1500, abs=0.1)


def test_only_distances_the_run_covers_are_listed():
    labels = [e.label for e in best_efforts(samples([(5200, 300)]))]
    assert labels == ["1k", "1mi", "3k", "5k"]


def test_goal_distances_are_added_and_deduplicated():
    assert effort_distances([8000, 10000.2]) == sorted([*effort_distances(), 8000])
    efforts = efforts_by_label(samples([(9000, 300)]), extra=[8000])
    assert efforts["8 km"].time_s == pytest.approx(2400, abs=0.5)


def test_pauses_count_against_an_effort():
    points = samples([(2500, 300)], step_s=1.0)
    # A two-minute stop at 1.2 km: elapsed time keeps running, distance doesn't.
    stop = next(i for i, p in enumerate(points) if p.dist_m >= 1200)
    paused = points[: stop + 1] + [
        Sample(t_s=p.t_s + 120, dist_m=p.dist_m, speed_mps=p.speed_mps) for p in points[stop + 1 :]
    ]
    assert efforts_by_label(paused)["1k"].time_s == pytest.approx(300, abs=0.5)  # before the stop
    longer = efforts_by_label(paused)["1mi"].time_s
    assert longer == pytest.approx(482.8 + 120, abs=0.5)


def test_distance_never_runs_backwards_and_missing_distance_is_skipped():
    points = [
        Sample(t_s=0, dist_m=0),
        Sample(t_s=10, dist_m=40),
        Sample(t_s=20, dist_m=35),  # GPS wobble
        Sample(t_s=30, dist_m=None),
        Sample(t_s=40, dist_m=120),
    ]
    assert track(points) == ([0, 40, 40, 120], [0, 10, 20, 40])
    assert fastest(*track(points), 200) is None


def test_implausible_efforts_are_kept_but_marked():
    # A 1 km stretch at 100 s/km (a car, or a GPS jump) inside an easy run.
    points = samples([(2000, 330), (1000, 100), (3000, 330)], step_s=1.0)
    efforts = efforts_by_label(points)
    assert efforts["1k"].time_s == pytest.approx(100, abs=0.5)
    assert not efforts["1k"].plausible
    assert not efforts["3k"].plausible  # its fastest kilometre is the 100 s one
    assert not efforts["5k"].plausible


def test_a_run_without_distance_has_no_efforts():
    assert best_efforts([Sample(t_s=0), Sample(t_s=10)]) == []
