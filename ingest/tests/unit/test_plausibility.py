"""Plausibility thresholds (T058, T081; FR-057)."""

import pytest

from awingest.process.plausibility import (
    MIN_KM_SPLIT_S,
    WORLD_RECORD_S,
    is_plausible,
    min_plausible_time_s,
    world_record_s,
)


@pytest.mark.parametrize(
    ("distance", "threshold"),
    [
        (5000, 641.75),  # 0.85 x 12:35 = 10:41.75
        (10000, 1335.35),  # 0.85 x 26:11 = 22:15.35
        (21097.5, 2891.7),  # 0.85 x 56:42 = 48:11.7
        (42195, 6149.75),  # 0.85 x 2:00:35 = 1:42:29.75
    ],
)
def test_the_threshold_is_85_percent_of_the_world_record(distance, threshold):
    assert min_plausible_time_s(distance) == pytest.approx(threshold)
    assert not is_plausible(distance, threshold - 1, None)
    assert is_plausible(distance, threshold + 1, None)


def test_every_standard_distance_has_a_record():
    assert set(WORLD_RECORD_S) == {
        1000,
        1609.344,
        3000,
        5000,
        10000,
        15000,
        16093.44,
        20000,
        21097.5,
        30000,
        42195,
    }


def test_other_distances_scale_from_the_nearest_record():
    assert world_record_s(8000) == pytest.approx(1571 * (8000 / 10000) ** 1.06)
    assert world_record_s(50000) == pytest.approx(7235 * (50000 / 42195) ** 1.06)


def test_a_kilometre_under_2_30_makes_an_effort_implausible():
    assert MIN_KM_SPLIT_S == 150
    assert not is_plausible(10000, 2700, fastest_km_s=149)
    assert is_plausible(10000, 2700, fastest_km_s=150)
    assert is_plausible(10000, 2700, fastest_km_s=None)
