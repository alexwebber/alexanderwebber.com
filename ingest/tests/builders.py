"""Builders for normalised activities with synthetic streams (processor tests)."""

from datetime import datetime
from zoneinfo import ZoneInfo

from awingest.providers.base import Dynamics, HrZone, NormalisedActivity, Sample, Split

LONDON = ZoneInfo("Europe/London")


def samples(segments: list[tuple[float, float]], step_s: float = 1.0, **extra) -> list[Sample]:
    """Samples every ``step_s`` seconds over ``[(metres, pace_s_per_km), ...]`` at even pace
    within each segment. ``extra`` sets constant values (e.g. ``hr=150``)."""
    out = [Sample(t_s=0.0, dist_m=0.0, speed_mps=1000 / segments[0][1], **extra)]
    t = d = 0.0
    for metres, pace in segments:
        speed = 1000 / pace
        end = d + metres
        while d < end - 1e-9:
            dt = min(step_s, (end - d) / speed)
            t += dt
            d = min(end, d + speed * dt)
            out.append(Sample(t_s=round(t, 6), dist_m=d, speed_mps=speed, **extra))
    return out


def activity(
    segments: list[tuple[float, float]] | None = None,
    *,
    start: datetime = datetime(2026, 10, 11, 7, 15, tzinfo=LONDON),
    step_s: float = 5.0,
    **fields,
) -> NormalisedActivity:
    points = tuple(samples(segments or [(8200, 300)], step_s, hr=150.0, cadence=170.0))
    distance = points[-1].dist_m
    elapsed = points[-1].t_s
    values = {
        "provider_id": "i90000042",
        "source": "intervals",
        "start_local": start,
        "type": "road",
        "treadmill": False,
        "is_race_flag": False,
        "distance_m": distance,
        "moving_s": elapsed,
        "elapsed_s": elapsed,
        "elevation_gain_m": 40.0,
        "elevation_loss_m": 38.0,
        "avg_hr": 150.0,
        "max_hr": 171.0,
        "avg_cadence": 170.0,
        "avg_stride_m": 1.12,
        "avg_power_w": 540.0,
        "training_load": 77.0,
        "dynamics": Dynamics(
            gct_ms=245.0, gct_balance_pct=50.2, vert_osc_mm=88.0, vert_ratio_pct=7.9
        ),
        "title_raw": "SENTINEL Hastings Running",
        "description_raw": "SENTINEL loop past the pier",
        "splits": (Split(km=1, distance_m=1000, time_s=300, avg_hr=150, elev_delta_m=2.0),),
        "hr_zones": (HrZone(zone=1, seconds=600), HrZone(zone=2, seconds=1800)),
        "samples": points,
    }
    return NormalisedActivity(**(values | fields))
