"""Pure mapping from archived intervals.icu parts to the normalised types (T053; data-model §2).

No I/O, and the same parts always give the same result, so an adapter fix is applied by
reprocessing the archive (Rule 1). Units come out as metres, seconds, kg and bpm.

- ``start_date_local`` is the wall-clock start where the run happened; it is read as
  Europe/London. Only the date is ever published, so a run abroad keeps its own calendar date.
- A metric the provider didn't record is ``None``, never 0. Treadmill runs have no elevation.
- Free text (``name``, ``description``) is kept only as the private ``title_raw`` and
  ``description_raw``; the provider ID only as ``provider_id``.
- ``training_effect`` is always ``None``: intervals.icu doesn't expose Garmin's.
"""

import json
import math
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from awingest.providers.base import (
    Dynamics,
    HrZone,
    NormalisedActivity,
    NormalisedHealthReading,
    ProviderChanged,
    RawBundle,
    RawHealthDay,
    RunType,
    Sample,
    Split,
    UnsupportedActivity,
)

SOURCE = "intervals"
LONDON = ZoneInfo("Europe/London")
RUN_TYPES: dict[str, RunType] = {"Run": "road", "TrailRun": "trail", "VirtualRun": "indoor"}

# intervals.icu wellness key -> approved metric, and whether 0 is a real value for it (fitness
# and fatigue can be 0; a weight or heart rate of 0 means "not recorded").
WELLNESS_METRICS: dict[str, tuple[str, bool]] = {
    "weight": ("weight_kg", False),
    "bodyFat": ("body_fat_pct", False),
    "restingHR": ("resting_hr", False),
    "hrv": ("hrv", False),
    "vo2max": ("vo2max", False),
    "ctl": ("fitness_ctl", True),
    "atl": ("fatigue_atl", True),
}


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def _positive(value: Any) -> float | None:
    number = _number(value)
    return number if number is not None and number > 0 else None


def _non_negative(value: Any) -> float | None:
    number = _number(value)
    return number if number is not None and number >= 0 else None


def _required(record: Mapping[str, Any], key: str) -> float:
    number = _non_negative(record.get(key))
    if number is None:
        raise ProviderChanged(f"activity field {key!r} is missing or not a non-negative number")
    return number


def _json(parts: Mapping[str, bytes], name: str, kind: type) -> Any:
    data = parts.get(name)
    if data is None:
        return None
    try:
        value = json.loads(data)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ProviderChanged(f"archived {name} is not JSON") from None
    if not isinstance(value, kind):
        raise ProviderChanged(f"archived {name} is not a JSON {kind.__name__}")
    return value


def start_local(record: Mapping[str, Any]) -> datetime:
    """The activity's start as an aware Europe/London datetime."""
    raw = record.get("start_date_local")
    if not isinstance(raw, str):
        raise ProviderChanged("activity has no start_date_local")
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        raise ProviderChanged("activity start_date_local is not an ISO datetime") from None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=LONDON)
    return parsed.astimezone(LONDON)


def activity_type(record: Mapping[str, Any]) -> tuple[RunType, bool]:
    """``(type, treadmill)``; anything that isn't a run raises ``UnsupportedActivity``."""
    kind = record.get("type")
    if kind not in RUN_TYPES:
        raise UnsupportedActivity(f"activity type {kind!r} is not a run (FR-009)")
    if kind == "VirtualRun":
        return "indoor", True
    if record.get("trainer") is True:
        return "indoor", False
    return RUN_TYPES[kind], False


# --- Streams ---


def _streams(raw: Sequence[Any]) -> dict[str, tuple[list[Any], list[Any] | None]]:
    out: dict[str, tuple[list[Any], list[Any] | None]] = {}
    for stream in raw:
        if not isinstance(stream, dict) or not isinstance(stream.get("type"), str):
            raise ProviderChanged("a stream is not an object with a type")
        data = stream.get("data")
        data2 = stream.get("data2")
        if isinstance(data, list):  # a stream without data is skipped, not fatal
            out[stream["type"]] = (data, data2 if isinstance(data2, list) else None)
    return out


def _at(values: list[Any] | None, i: int) -> float | None:
    if values is None or i >= len(values):
        return None
    return _number(values[i])


def _latlon(
    stream: tuple[list[Any], list[Any] | None] | None, i: int
) -> tuple[float, float] | tuple[None, None]:
    """``latlng`` holds latitudes in ``data`` and longitudes in ``data2`` (older payloads put
    ``[lat, lon]`` pairs in ``data``). A point without a fix comes back as ``(None, None)``."""
    if stream is None:
        return None, None
    data, data2 = stream
    if data2 is not None:
        lat, lon = _at(data, i), _at(data2, i)
    elif i < len(data) and isinstance(data[i], list) and len(data[i]) == 2:
        lat, lon = _number(data[i][0]), _number(data[i][1])
    else:
        return None, None
    if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None, None
    if lat == 0 and lon == 0:
        return None, None
    return lat, lon


def samples(
    streams: dict[str, tuple[list[Any], list[Any] | None]], treadmill: bool
) -> tuple[Sample, ...]:
    time = streams.get("time")
    if time is None:
        return ()
    dist, speed, hr, cad, watts, alt = (
        streams.get(name, (None, None))[0]
        for name in ("distance", "velocity_smooth", "heartrate", "cadence", "watts", "altitude")
    )
    latlng = None if treadmill else streams.get("latlng")
    out = []
    for i, t in enumerate(time[0]):
        t_s = _number(t)
        if t_s is None:
            continue
        lat, lon = _latlon(latlng, i)
        out.append(
            Sample(
                t_s=t_s,
                dist_m=_non_negative(_at(dist, i)),
                speed_mps=_non_negative(_at(speed, i)),
                hr=_positive(_at(hr, i)),
                cadence=_non_negative(_at(cad, i)),
                power=_non_negative(_at(watts, i)),
                elev_m=None if treadmill else _at(alt, i),
                lat=lat,
                lon=lon,
            )
        )
    return tuple(out)


def _mean(values: Sequence[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return sum(present) / len(present) if present else None


def km_splits(points: Sequence[Sample]) -> tuple[Split, ...]:
    """Per-km splits from the distance and time streams, interpolating each km boundary.

    The last split is partial (``distance_m`` < 1000) when the run doesn't end on a km.
    """
    track = [p for p in points if p.dist_m is not None]
    if len(track) < 2:
        return ()
    splits: list[Split] = []
    max_dist = track[0].dist_m
    km = int(max_dist // 1000) + 1
    seg_t, seg_e = track[0].t_s, track[0].elev_m
    seg_hr: list[float | None] = []
    prev = track[0]
    for cur in track[1:]:
        dist = max(cur.dist_m, max_dist)  # a GPS wobble must not run the distance backwards
        while dist >= km * 1000 and dist > max_dist:
            frac = (km * 1000 - max_dist) / (dist - max_dist)
            t = prev.t_s + frac * (cur.t_s - prev.t_s)
            if prev.elev_m is not None and cur.elev_m is not None:
                elev = prev.elev_m + frac * (cur.elev_m - prev.elev_m)
            else:
                elev = cur.elev_m if cur.elev_m is not None else prev.elev_m
            splits.append(
                Split(
                    km=km,
                    distance_m=1000.0,
                    time_s=t - seg_t,
                    avg_hr=_mean(seg_hr),
                    elev_delta_m=None if seg_e is None or elev is None else elev - seg_e,
                )
            )
            seg_t, seg_e, seg_hr = t, elev, []
            km += 1
        seg_hr.append(cur.hr)
        max_dist, prev = dist, cur
    remainder = max_dist - (km - 1) * 1000
    if remainder >= 1:
        end_e = prev.elev_m
        splits.append(
            Split(
                km=km,
                distance_m=remainder,
                time_s=prev.t_s - seg_t,
                avg_hr=_mean(seg_hr),
                elev_delta_m=None if seg_e is None or end_e is None else end_e - seg_e,
            )
        )
    return tuple(splits)


# --- Activity ---


def _dynamics(record: Mapping[str, Any], streams: dict) -> Dynamics | None:
    balance = _positive(record.get("average_stance_time_balance"))
    if balance is None and "stance_time_balance" in streams:
        balance = _mean([_positive(v) for v in streams["stance_time_balance"][0]])
    dynamics = Dynamics(
        gct_ms=_positive(record.get("average_stance_time")),
        gct_balance_pct=balance,
        vert_osc_mm=_positive(record.get("average_vertical_oscillation")),
        vert_ratio_pct=_positive(record.get("average_vertical_ratio")),
    )
    return None if dynamics == Dynamics() else dynamics


def _power(record: Mapping[str, Any], streams: dict) -> float | None:
    if record.get("device_watts") is not True:
        return None
    average = _positive(record.get("icu_average_watts"))
    if average is None and "watts" in streams:
        average = _positive(_mean([_non_negative(v) for v in streams["watts"][0]]))
    return average


def _hr_zones(record: Mapping[str, Any]) -> tuple[HrZone, ...]:
    times = record.get("icu_hr_zone_times")
    if not isinstance(times, list):
        return ()
    values = [_non_negative(seconds) for seconds in times]
    if any(v is None for v in values):
        return ()  # a malformed breakdown is left out rather than half-shown
    return tuple(HrZone(zone=i + 1, seconds=v) for i, v in enumerate(values))


def _text(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def normalise_activity(bundle: RawBundle) -> NormalisedActivity:
    parts = bundle.parts
    summary = _json(parts, "summary.json", dict) or {}
    detail = _json(parts, "detail.json", dict)
    if detail is None:
        raise ProviderChanged("the activity has no archived detail.json")
    # The detail is a superset of the list row; the row fills anything the detail lacks.
    record = {**summary, **{k: v for k, v in detail.items() if v is not None}}
    kind, treadmill = activity_type(record)
    streams = _streams(_json(parts, "streams.json", list) or [])
    points = samples(streams, treadmill)
    moving = _non_negative(record.get("moving_time"))
    elapsed = _required(record, "elapsed_time")
    provider_id = record.get("id")
    if not isinstance(provider_id, str) or not provider_id:
        raise ProviderChanged("activity has no string id")
    load = _non_negative(record.get("icu_training_load"))
    return NormalisedActivity(
        provider_id=provider_id,
        source=SOURCE,
        start_local=start_local(record),
        type=kind,
        treadmill=treadmill,
        is_race_flag=record.get("race") is True,
        distance_m=_required(record, "distance"),
        moving_s=elapsed if moving is None else moving,
        elapsed_s=elapsed,
        elevation_gain_m=None if treadmill else _non_negative(record.get("total_elevation_gain")),
        elevation_loss_m=None if treadmill else _non_negative(record.get("total_elevation_loss")),
        avg_hr=_positive(record.get("average_heartrate")),
        max_hr=_positive(record.get("max_heartrate")),
        avg_cadence=_positive(record.get("average_cadence")),
        avg_stride_m=_positive(record.get("average_stride")),
        avg_power_w=_power(record, streams),
        training_load=load,
        dynamics=_dynamics(record, streams),
        training_effect=None,
        title_raw=_text(record.get("name")),
        description_raw=_text(record.get("description")),
        splits=km_splits(points),
        hr_zones=_hr_zones(record),
        samples=points,
    )


# --- Wellness ---


def normalise_health(raw: RawHealthDay) -> list[NormalisedHealthReading]:
    try:
        record = json.loads(raw.payload)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ProviderChanged("archived wellness day is not JSON") from None
    if not isinstance(record, dict):
        raise ProviderChanged("archived wellness day is not a JSON object")
    day: date = raw.day
    readings = []
    for key, (metric, zero_ok) in WELLNESS_METRICS.items():
        value = (_non_negative if zero_ok else _positive)(record.get(key))
        if value is not None:
            readings.append(NormalisedHealthReading(metric=metric, date=day, value=value))
    return readings
