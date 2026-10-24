"""The allow-list sanitiser (T062; data-model §7, rules 1–7): a normalised activity -> one
published run document.

The document is built field by field from what is listed here; nothing is copied wholesale, so a
new provider field can't reach a published file by accident. The published schema
(``additionalProperties: false``) checks the result again before it is written.

- **Times**: ``start_local`` becomes the date only (``run_date``, the date in the run's ID, when
  the pipeline passes it: a start date edited later doesn't move a published run). Series use elapsed seconds and distance on
  the x axis, never clock time (FR-011, FR-013).
- **Location and free text**: no coordinates (samples' ``lat``/``lon`` are never read) and no
  provider ``name``/``description`` (``title_raw``/``description_raw`` are never read). Titles
  come from ``titles.py``; the note is the owner's (FR-011, FR-012). Race tracks are written by
  their own module (T125), not here.
- **Device**: the Garmin model (``device``) is kept for the Garmin attribution (FR-077); the
  adapter has already reduced it to a plain model name.
- **IDs**: the public run ID comes from ``run_ids.py``; ``provider_id`` is never read.
- **Series** are averaged into at most 600 buckets (Spike 1b).
- **Flags**: the owner's ``exclude_from_records`` and ``include_in_records`` are mirrored as
  ``flags.excluded_from_records`` and ``flags.include_indoor_in_records``. ``is_race`` is the
  owner's ``run-overrides`` ``is_race`` if set; else a ``race.yaml`` linked by ``run_id`` makes
  the run a race (unless it says ``designate: not_race``); else the intervals.icu ``race`` flag,
  which Garmin sync doesn't set (FR-050).
- **HR zones** are the watch's own (Garmin's five, with names and bpm ranges), from the adapter.
- A value outside the published range (e.g. a heart rate over 260) is treated as not recorded and
  left out (FR-048), rather than failing the whole publish.

Hidden runs never get here: the pipeline doesn't build them at all (FR-017).
"""

import itertools
import math
from collections.abc import Iterable, Sequence
from datetime import date
from typing import Any

from awingest.process import titles
from awingest.process.best_efforts import BestEffort, best_efforts
from awingest.process.overrides import RaceLink, RunOverride
from awingest.providers.base import NormalisedActivity, Sample

SCHEMA_VERSION = 1
MAX_SERIES_POINTS = 600
MAX_BPM = 260
MAX_HR_ZONES = 5  # Garmin's five zones
STOPPED_MPS = 0.5  # slower than this (over 33 min/km) is standing still: no pace


class Unpublishable(ValueError):
    """The activity has no distance or no duration, so it has no pace and can't be published."""


def _num(value: float, places: int) -> float | int:
    rounded = round(value, places)
    return int(rounded) if places == 0 else rounded


def _in_range(value: float | None, low: float, high: float) -> float | None:
    if value is None or not math.isfinite(value) or not low < value <= high:
        return None
    return value


def resolve_is_race(
    activity: NormalisedActivity, override: RunOverride, race: RaceLink | None
) -> bool:
    if override.is_race is not None:
        return override.is_race
    if race is not None:
        return race.designate != "not_race"
    return activity.is_race_flag


def pace(time_s: float, distance_m: float) -> float:
    return time_s / distance_m * 1000


# --- Series ---


def _speeds(points: Sequence[Sample]) -> list[float | None]:
    """Recorded speed, else the speed between consecutive samples."""
    if any(p.speed_mps is not None for p in points):
        return [p.speed_mps for p in points]
    out: list[float | None] = [None]
    for prev, cur in itertools.pairwise(points):
        dt = cur.t_s - prev.t_s
        out.append((cur.dist_m - prev.dist_m) / dt if dt > 0 else None)
    return out


def _mean(values: Iterable[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return sum(present) / len(present) if present else None


def series(samples: Sequence[Sample]) -> dict[str, list]:
    points = [s for s in samples if s.dist_m is not None]
    speeds = _speeds(points)
    n = len(points)
    buckets = min(n, MAX_SERIES_POINTS)
    columns: dict[str, list] = {
        k: [] for k in ("x_dist_m", "x_elapsed_s", "pace", "hr", "elev", "cadence", "power")
    }
    for b in range(buckets):
        lo, hi = b * n // buckets, (b + 1) * n // buckets
        group = points[lo:hi]
        speed = _mean(speeds[lo:hi])
        columns["x_dist_m"].append(_num(_mean(p.dist_m for p in group), 1))
        columns["x_elapsed_s"].append(_num(_mean(p.t_s for p in group), 0))
        columns["pace"].append(
            None if speed is None or speed < STOPPED_MPS else _num(1000 / speed, 1)
        )
        for key, attr, places in (
            ("hr", "hr", 0),
            ("elev", "elev_m", 1),
            ("cadence", "cadence", 0),
            ("power", "power", 0),
        ):
            value = _mean(getattr(p, attr) for p in group)
            columns[key].append(None if value is None else _num(value, places))
    out = {k: columns[k] for k in ("x_dist_m", "x_elapsed_s", "pace")}
    for key in ("hr", "elev", "cadence", "power"):
        if any(v is not None for v in columns[key]):
            out[key] = columns[key]
    return out


# --- The run ---


def _splits(activity: NormalisedActivity) -> list[dict[str, Any]]:
    out = []
    for split in activity.splits:
        if split.time_s <= 0 or split.distance_m <= 0:
            continue
        item: dict[str, Any] = {
            "km": split.km,
            "time_s": _num(split.time_s, 1),
            "pace_s_per_km": _num(pace(split.time_s, split.distance_m), 1),
        }
        hr = _in_range(split.avg_hr, 0, MAX_BPM)
        if hr is not None:
            item["hr"] = _num(hr, 0)
        if split.elev_delta_m is not None and math.isfinite(split.elev_delta_m):
            item["elev_delta_m"] = _num(split.elev_delta_m, 1)
        out.append(item)
    return out


def _dynamics(activity: NormalisedActivity) -> dict[str, Any] | None:
    d = activity.dynamics
    if d is None:
        return None
    values = {
        "gct_ms": _in_range(d.gct_ms, 0, math.inf),
        "gct_balance_pct": _in_range(d.gct_balance_pct, 0, 100),
        "vert_osc_mm": _in_range(d.vert_osc_mm, 0, math.inf),
        "vert_ratio_pct": _in_range(d.vert_ratio_pct, 0, 100),
    }
    out = {k: _num(v, 1) for k, v in values.items() if v is not None}
    return out or None


def _hr_zones(activity: NormalisedActivity) -> list[dict[str, Any]]:
    """The watch's zones, all or none: one out-of-range zone leaves the breakdown out."""
    zones = []
    for z in activity.hr_zones:
        low, high = _in_range(z.low_bpm, 0, MAX_BPM), _in_range(z.high_bpm, 0, MAX_BPM)
        if not 1 <= z.zone <= MAX_HR_ZONES or low is None or high is None or low >= high:
            return []
        if not math.isfinite(z.seconds) or z.seconds < 0:
            return []
        zones.append(
            {
                "zone": z.zone,
                "name": z.name,
                "low_bpm": _num(low, 0),
                "high_bpm": _num(high, 0),
                "seconds": _num(z.seconds, 0),
            }
        )
    return zones


def _best_pace(efforts: Sequence[BestEffort], average: float) -> float:
    """The fastest kilometre (the 1 km best effort) if it is plausible, else the average."""
    km = next((e for e in efforts if e.distance_m == 1000 and e.plausible), None)
    return min(km.time_s, average) if km else average


def sanitise_run(
    activity: NormalisedActivity,
    *,
    run_id: str,
    run_date: date | None = None,
    override: RunOverride | None = None,
    race: RaceLink | None = None,
    goal_distances: Iterable[float] = (),
) -> dict[str, Any]:
    override = override or RunOverride()
    duration = activity.moving_s or activity.elapsed_s
    if activity.distance_m < 1 or duration <= 0:
        raise Unpublishable("the run has no distance or no duration")
    is_race = resolve_is_race(activity, override, race)
    average = pace(duration, activity.distance_m)
    efforts = best_efforts(activity.samples, goal_distances)

    run: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "id": run_id,
        "date": (run_date or activity.start_local.date()).isoformat(),
        "type": activity.type,
        "treadmill": activity.treadmill,
        "is_race": is_race,
        "title": titles.run_title(
            activity,
            is_race=is_race,
            custom=override.title,
            race_name=race.name if race else None,
        ),
        "distance_m": _num(activity.distance_m, 1),
        "moving_s": _num(duration, 0),
        "elapsed_s": _num(activity.elapsed_s, 0),
        "avg_pace_s_per_km": _num(average, 1),
        "best_pace_s_per_km": _num(_best_pace(efforts, average), 1),
        "splits": _splits(activity),
        "series": series(activity.samples),
        "best_efforts": [
            {
                "distance_m": e.distance_m,
                "label": e.label,
                "time_s": e.time_s,
                "plausible": e.plausible,
            }
            for e in efforts
        ],
        "flags": {},
    }
    if override.note:
        run["note"] = override.note
    device = override.device or activity.device
    if device:
        run["device"] = device
    for key, value in (
        ("elevation_gain_m", activity.elevation_gain_m),
        ("elevation_loss_m", activity.elevation_loss_m),
    ):
        if value is not None and math.isfinite(value) and value >= 0:
            run[key] = _num(value, 1)
    avg_hr = _in_range(activity.avg_hr, 0, MAX_BPM)
    max_hr = _in_range(activity.max_hr, 0, MAX_BPM)
    if avg_hr is not None and max_hr is not None:
        run["hr"] = {"avg": _num(avg_hr, 0), "max": _num(max_hr, 0)}
    for key, value, places in (
        ("cadence_avg", activity.avg_cadence, 1),
        ("stride_m_avg", activity.avg_stride_m, 2),
        ("power_w_avg", activity.avg_power_w, 0),
    ):
        if _in_range(value, 0, math.inf) is not None:
            run[key] = _num(value, places)
    dynamics = _dynamics(activity)
    if dynamics:
        run["dynamics"] = dynamics
    effect = activity.training_effect
    if effect is not None and 0 <= effect.aerobic <= 5 and 0 <= effect.anaerobic <= 5:
        run["training_effect"] = {
            "aerobic": _num(effect.aerobic, 1),
            "anaerobic": _num(effect.anaerobic, 1),
        }
    zones = _hr_zones(activity)
    if zones:
        run["hr_zones"] = zones
    if override.exclude_from_records:
        run["flags"]["excluded_from_records"] = True
    if override.include_in_records:
        run["flags"]["include_indoor_in_records"] = True
    return run
