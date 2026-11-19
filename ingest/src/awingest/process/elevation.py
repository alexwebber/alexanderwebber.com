"""Levelling a run's altitude trace (owner, 2026-11-19).

The watch's barometric altimeter drifts during a run, so its altitude trace ends metres away from
where it should: on the 18 Nov 2026 loop it ended 10.6 m below its start, and nearly every run's
chart sloped downhill. The watch's own gain and loss totals leave the drift out (it counts only
climbs and descents above a threshold): on the loops of Aug to Nov 2026, gain minus loss was within
about 1 m of zero while the trace was 8 to 11 m out.

So the trace is levelled to end at its start plus (gain - loss), with the difference spread evenly
over the run's elapsed time between the first and last altitude readings. The series, the km
splits' elevation changes and a race's course profile all come from the levelled samples. The
published run carries ``elev_drift_m``, the metres taken out, so the page can say so under the
chart. Runs without both totals (treadmill runs, a watch with no altimeter) are left as recorded,
and so is a drift under ``MIN_DRIFT_M``.
"""

import itertools
import math
from collections.abc import Callable
from dataclasses import replace

from awingest.providers.base import NormalisedActivity, Split

MIN_DRIFT_M = 1.0


def _finite(value: float | None) -> bool:
    return value is not None and math.isfinite(value)


def level(activity: NormalisedActivity) -> tuple[NormalisedActivity, float | None]:
    """The activity with its altitude trace levelled, and the drift taken out (metres, the trace's
    end minus where it should end), or the activity unchanged and ``None``."""
    gain, loss = activity.elevation_gain_m, activity.elevation_loss_m
    if activity.treadmill or not _finite(gain) or not _finite(loss):
        return activity, None
    readings = [(s.t_s, s.elev_m) for s in activity.samples if _finite(s.elev_m)]
    if len(readings) < 2:
        return activity, None
    (t0, e0), (t1, e1) = readings[0], readings[-1]
    drift = (e1 - e0) - (gain - loss)
    if t1 <= t0 or abs(drift) < MIN_DRIFT_M:
        return activity, None

    def correction(t: float) -> float:
        return -drift * min(max((t - t0) / (t1 - t0), 0.0), 1.0)

    samples = tuple(
        replace(s, elev_m=s.elev_m + correction(s.t_s)) if _finite(s.elev_m) else s
        for s in activity.samples
    )
    return replace(activity, samples=samples, splits=_level_splits(activity, correction)), drift


def _level_splits(
    activity: NormalisedActivity, correction: Callable[[float], float]
) -> tuple[Split, ...]:
    """Each split's elevation change, levelled. Splits run back to back from the first sample
    with a distance (as the adapters' ``km_splits`` builds them), so each one's start and end
    times follow from the durations."""
    start = next((s.t_s for s in activity.samples if s.dist_m is not None), None)
    if start is None:
        return activity.splits
    ends = itertools.accumulate((s.time_s for s in activity.splits), initial=start)
    out = []
    for split, (t_a, t_b) in zip(activity.splits, itertools.pairwise(ends), strict=True):
        if split.elev_delta_m is None:
            out.append(split)
        else:
            delta = split.elev_delta_m + correction(t_b) - correction(t_a)
            out.append(replace(split, elev_delta_m=delta))
    return tuple(out)
