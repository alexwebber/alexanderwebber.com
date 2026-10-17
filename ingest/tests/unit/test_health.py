"""Published health series (T060, T081; FR-061, FR-062, FR-067)."""

from datetime import date, timedelta

from awingest.process.health import (
    SERIES,
    by_year,
    daily_values,
    series_doc,
    series_points,
    trailing_mean,
    window_for_year,
)
from awingest.providers.base import NormalisedHealthReading

D0 = date(2026, 10, 1)


def reading(metric, offset, value):
    return NormalisedHealthReading(metric=metric, date=D0 + timedelta(days=offset), value=value)


def test_the_weight_example_averages_to_100_7():
    weights = [101.2, 100.6, 101.0, 100.4, 100.8, 100.2, 100.5]
    daily = {D0 + timedelta(days=i): w for i, w in enumerate(weights)}
    points = trailing_mean(daily)
    assert points[-1] == (D0 + timedelta(days=6), 100.7)
    assert points[0] == (D0, 101.2)  # the first day's window holds only itself


def test_a_day_with_no_reading_in_its_window_is_omitted():
    daily = {D0: 100.0, D0 + timedelta(days=10): 99.0}
    days = [d for d, _ in trailing_mean(daily)]
    assert days == [D0 + timedelta(days=k) for k in (*range(7), 10)]


def test_the_series_can_run_on_to_a_later_day():
    daily = {D0: 100.0}
    assert [d for d, _ in trailing_mean(daily, until=D0 + timedelta(days=9))] == [
        D0 + timedelta(days=k) for k in range(7)
    ]


def test_excluded_readings_are_removed_before_averaging():
    readings = [reading("weight_kg", 0, 100.0), reading("weight_kg", 1, 140.0)]
    daily = daily_values(readings, excluded={("weight_kg", D0 + timedelta(days=1))})
    assert daily["weight_kg"] == {D0: 100.0}
    until = D0 + timedelta(days=1)
    assert series_points(daily, until=until)["weight_avg7"] == [(D0, 100.0), (until, 100.0)]


def test_individual_weights_are_never_output_and_other_metrics_are_as_recorded():
    readings = [
        reading("weight_kg", 0, 101.0),
        reading("weight_kg", 1, 100.0),
        reading("body_fat_pct", 0, 19.45),
        reading("hrv", 0, 62.0),
        reading("fitness_ctl", 0, 0.0),
    ]
    points = series_points(daily_values(readings))
    assert "weight_kg" not in points
    assert points["weight_avg7"] == [(D0, 101.0), (D0 + timedelta(days=1), 100.5)]
    assert points["body_fat_pct"] == [(D0, 19.45)]
    assert points["fitness_ctl"] == [(D0, 0.0)]  # zero is a real fitness value
    assert "vo2max" not in points  # no readings, no series


def test_documents_have_the_fixed_unit_and_split_by_year():
    points = [(date(2025, 12, 31), 50.0), (date(2026, 1, 1), 51.0)]
    years = by_year(points)
    assert sorted(years) == [2025, 2026]
    doc = series_doc("vo2max", years[2026])
    assert doc == {
        "schema_version": 1,
        "metric": "vo2max",
        "unit": "ml/kg/min",
        "points": [{"date": "2026-01-01", "value": 51.0}],
    }
    assert {unit for _, unit in SERIES.values()} == {"%", "bpm", "kg", "load", "ml/kg/min", "ms"}


def test_a_weight_year_depends_on_the_end_of_the_year_before():
    assert window_for_year("weight_avg7", 2026) == (date(2025, 12, 26), date(2026, 12, 31))
    assert window_for_year("vo2max", 2026) == (date(2026, 1, 1), date(2026, 12, 31))
