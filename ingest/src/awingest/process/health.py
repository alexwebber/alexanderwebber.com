"""Published health series (T060; FR-060–FR-062, FR-067; data-model §3 "Health series").

Approved-metric readings become one series per metric:

- ``weight_avg7``: the trailing 7-day mean (the day and the six before it) of the daily weight
  readings, in kg to one decimal. A day with no reading in its window is omitted. Points run
  from the first weigh-in to the last day with any wellness data, so a week without weighing
  ends the series; individual weigh-ins are never output (FR-061).
- ``body_fat_pct``, ``hrv`` (rMSSD), ``vo2max``, ``resting_hr``, ``fitness_ctl`` and
  ``fatigue_atl``: as recorded, one per day, except where a known step is joined (below). intervals.icu supplies no HRV baseline, so no
  baseline fields are written. Form (fitness - fatigue) is derived by the site, never stored.

Owner exclusions (``health-exclusions.yaml``) are removed before anything is computed, so an
excluded weigh-in doesn't reach any average (FR-067). Then known steps (``health-steps.yaml``,
FR-062a) are joined: every reading from a step's date on has its shift added, so a source whose
reference was reset carries on from its earlier readings. Training status and race predictions are
owner data, not series.
"""

from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import date, timedelta
from decimal import Decimal

from awingest.providers.base import NormalisedHealthReading

WEIGHT_WINDOW_DAYS = 7

# Published series -> (source metric, unit).
SERIES: dict[str, tuple[str, str]] = {
    "vo2max": ("vo2max", "ml/kg/min"),
    "fitness_ctl": ("fitness_ctl", "load"),
    "fatigue_atl": ("fatigue_atl", "load"),
    "resting_hr": ("resting_hr", "bpm"),
    "hrv": ("hrv", "ms"),
    "weight_avg7": ("weight_kg", "kg"),
    "body_fat_pct": ("body_fat_pct", "%"),
}

Point = tuple[date, float]


def daily_values(
    readings: Iterable[NormalisedHealthReading],
    excluded: Iterable[tuple[str, date]] = (),
    onwards: Mapping[str, date] | None = None,
    steps: Mapping[str, Sequence[tuple[date, float]]] | None = None,
) -> dict[str, dict[date, float]]:
    """Source metric -> {date: value}, with excluded readings removed (single days, and every day
    from a metric's ``onwards`` date on) and known steps joined."""
    skip = set(excluded)
    from_day = onwards or {}
    out: dict[str, dict[date, float]] = defaultdict(dict)
    for r in readings:
        first = from_day.get(r.metric)
        if (r.metric, r.date) not in skip and (first is None or r.date < first):
            out[r.metric][r.date] = joined(r.value, r.date, (steps or {}).get(r.metric, ()))
    return out


def joined(value: float, day: date, steps: Iterable[tuple[date, float]]) -> float:
    """``value`` plus the shift of every step on or before ``day``. Decimal sums, so 17.7 + 8.5
    is 26.2, not 26.199999999999996."""
    shifts = [shift for first, shift in steps if first <= day]
    if not shifts:
        return value
    return float(Decimal(str(value)) + sum(Decimal(str(s)) for s in shifts))


def trailing_mean(
    daily: Mapping[date, float], days: int = WEIGHT_WINDOW_DAYS, until: date | None = None
) -> list[Point]:
    """The mean of each day's window, from the first reading to ``until`` (default: the last
    reading). Pass the overall last reading as ``until`` when ``daily`` is only part of the
    history, so the series ends where it would if computed over everything."""
    if not daily:
        return []
    first, last = min(daily), until or max(daily)
    out = []
    day = first
    while day <= last:
        window = [daily[d] for k in range(days) if (d := day - timedelta(days=k)) in daily]
        if window:
            out.append((day, round(sum(window) / len(window), 1)))
        day += timedelta(days=1)
    return out


def series_points(
    daily: Mapping[str, Mapping[date, float]], until: date | None = None
) -> dict[str, list[Point]]:
    """Published series -> its points, sorted by date (series without points are left out).
    ``until`` is passed to ``trailing_mean``."""
    out = {}
    for series, (source, _unit) in SERIES.items():
        values = daily.get(source, {})
        if series == "weight_avg7":
            points = trailing_mean(values, until=until)
        else:
            points = sorted(values.items())
        if points:
            out[series] = points
    return out


def by_year(points: Iterable[Point]) -> dict[int, list[Point]]:
    out: dict[int, list[Point]] = defaultdict(list)
    for day, value in points:
        out[day.year].append((day, value))
    return dict(out)


def series_doc(series: str, points: Iterable[Point]) -> dict:
    """One ``health/<series>/<yyyy>.json`` document."""
    return {
        "schema_version": 1,
        "metric": series,
        "unit": SERIES[series][1],
        "points": [{"date": d.isoformat(), "value": v} for d, v in points],
    }


def window_for_year(series: str, year: int) -> tuple[date, date]:
    """The days whose readings a year's file depends on (a 7-day mean reaches into December)."""
    start = date(year, 1, 1)
    if series == "weight_avg7":
        start -= timedelta(days=WEIGHT_WINDOW_DAYS - 1)
    return start, date(year, 12, 31)
