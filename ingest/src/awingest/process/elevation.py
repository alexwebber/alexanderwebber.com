"""Correcting a run's altitude trace for the altimeter's drift (owner, 2026-11-19 and 2026-11-20).

The watch's barometric altimeter drifts during a run. From June 2026 the owner's Venu X1 read
lower and lower as each run went on (typically 17-22 m an hour from July to November, against
about 2 m an hour before), so laps of a park charted as a long downhill. Garmin's own chart shows
the same trace, so the drift is in the recording.

**Repeat passes** (the default, 2026-11-20): wherever a run passes the same spot again, at least
``MIN_GAP_S`` later and within ``REPEAT_RADIUS_M``, the true height there hasn't changed, so the
difference between the two readings is the drift between those two moments. The drift is fitted
as a piecewise-linear curve in time (a knot every ``KNOT_S``, lightly smoothed) through all those
differences and subtracted, holding it level before the first and after the last repeat pass. On
the owner's November runs, readings at the same spot 30-60 minutes apart went from 4-15 m out to
0.2-0.5 m on passes held out of the fit. The run's start keeps its recorded height.

**Gain and loss** (the fallback, 2026-11-19): a run with too few repeat passes (a point-to-point
run, a run without GPS) is levelled to end at its start plus (gain - loss), the difference spread
evenly over the time between the first and last altitude readings. The watch's totals leave most
of the drift out, but this can't see drift that comes back before the finish.

The series, the km splits' elevation changes and a race's course profile all come from the
corrected samples. The published run carries ``elev_drift_m`` (the largest drift taken out,
signed) and ``elev_drift_method``, so the page can say so under the chart. Treadmill runs, runs
with no altitude and a drift under ``MIN_DRIFT_M`` are left as recorded. The owner asked for the
repeat-pass method to be re-evaluated once it has been live for a while.
"""

import itertools
import math
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from typing import Literal

from awingest.providers.base import NormalisedActivity, Split

MIN_DRIFT_M = 1.0
REPEAT_RADIUS_M = 12.0
MIN_GAP_S = 180.0
THIN_S = 5.0
KNOT_S = 120.0
MIN_PAIRS = 50
MAX_PAIRS = 40_000
# Weight of the smoothing (second differences of the drift at the knots), per repeat pair per knot.
SMOOTHING = 0.004
EARTH_M = 6_371_000.0

Method = Literal["repeat-passes", "totals"]


@dataclass(frozen=True)
class Levelling:
    drift_m: float
    """The largest drift taken out, signed: negative when the watch read too low."""
    method: Method


def _finite(value: float | None) -> bool:
    return value is not None and math.isfinite(value)


def level(activity: NormalisedActivity) -> tuple[NormalisedActivity, Levelling | None]:
    """The activity with the altimeter's drift taken out of its altitude trace, and how, or the
    activity unchanged and ``None``."""
    if activity.treadmill:
        return activity, None
    readings = [(s.t_s, s.elev_m) for s in activity.samples if _finite(s.elev_m)]
    if len(readings) < 2 or readings[-1][0] <= readings[0][0]:
        return activity, None
    found = _from_repeat_passes(activity) or _from_totals(activity, readings)
    if found is None:
        return activity, None
    drift, levelling = found
    if abs(levelling.drift_m) < MIN_DRIFT_M:
        return activity, None

    def correction(t: float) -> float:
        return -drift(t)

    samples = tuple(
        replace(s, elev_m=s.elev_m + correction(s.t_s)) if _finite(s.elev_m) else s
        for s in activity.samples
    )
    corrected = replace(activity, samples=samples, splits=_level_splits(activity, correction))
    return corrected, levelling


def _from_totals(
    activity: NormalisedActivity, readings: Sequence[tuple[float, float]]
) -> tuple[Callable[[float], float], Levelling] | None:
    gain, loss = activity.elevation_gain_m, activity.elevation_loss_m
    if not _finite(gain) or not _finite(loss):
        return None
    (t0, e0), (t1, e1) = readings[0], readings[-1]
    end_drift = (e1 - e0) - (gain - loss)

    def drift(t: float) -> float:
        return end_drift * min(max((t - t0) / (t1 - t0), 0.0), 1.0)

    return drift, Levelling(end_drift, "totals")


def _from_repeat_passes(
    activity: NormalisedActivity,
) -> tuple[Callable[[float], float], Levelling] | None:
    points = _thinned_points(activity)
    pairs = _repeat_pairs(points)
    if len(pairs) < MIN_PAIRS:
        return None
    if len(pairs) > MAX_PAIRS:
        pairs = pairs[:: math.ceil(len(pairs) / MAX_PAIRS)]
    lo = min(p[0] for p in pairs)
    hi = max(p[1] for p in pairs)
    knots = max(1, math.ceil((hi - lo) / KNOT_S))
    step = (hi - lo) / knots
    values = [0.0, *_fit_knots(pairs, lo, step, knots)]

    def drift(t: float) -> float:
        x = (min(max(t, lo), hi) - lo) / step
        k = min(int(x), knots - 1)
        f = x - k
        return values[k] * (1 - f) + values[k + 1] * f

    largest = max(values, key=abs)
    return drift, Levelling(largest, "repeat-passes")


def _thinned_points(activity: NormalisedActivity) -> list[tuple[float, float, float, float]]:
    """(t, x, y, elev) one reading per ``THIN_S`` at most, with x and y in metres from the first
    fix (an equirectangular projection: a run spans a few km at most)."""
    out: list[tuple[float, float, float, float]] = []
    origin: tuple[float, float] | None = None
    last_t = -math.inf
    for s in activity.samples:
        if not (_finite(s.lat) and _finite(s.lon) and _finite(s.elev_m)):
            continue
        if s.t_s - last_t < THIN_S:
            continue
        lat, lon = math.radians(s.lat), math.radians(s.lon)
        if origin is None:
            origin = (lat, lon)
        x = EARTH_M * (lon - origin[1]) * math.cos(origin[0])
        y = EARTH_M * (lat - origin[0])
        out.append((s.t_s, x, y, s.elev_m))
        last_t = s.t_s
    return out


def _repeat_pairs(
    points: Sequence[tuple[float, float, float, float]],
) -> list[tuple[float, float, float]]:
    """(t_first, t_again, elev_again - elev_first) for every pair of readings at the same spot."""
    cells: dict[tuple[int, int], list[tuple[float, float, float, float]]] = defaultdict(list)
    for p in points:
        cells[(math.floor(p[1] / REPEAT_RADIUS_M), math.floor(p[2] / REPEAT_RADIUS_M))].append(p)
    pairs = []
    for t, x, y, e in points:
        cx, cy = math.floor(x / REPEAT_RADIUS_M), math.floor(y / REPEAT_RADIUS_M)
        for dx, dy in itertools.product((-1, 0, 1), repeat=2):
            for t2, x2, y2, e2 in cells.get((cx + dx, cy + dy), ()):
                if t2 - t >= MIN_GAP_S and math.hypot(x2 - x, y2 - y) <= REPEAT_RADIUS_M:
                    pairs.append((t, t2, e2 - e))
    return pairs


def _fit_knots(
    pairs: Sequence[tuple[float, float, float]], lo: float, step: float, knots: int
) -> list[float]:
    """The drift at knots 1..``knots`` (knot 0, at ``lo``, is zero) by least squares over the
    repeat pairs, with a second-difference penalty to keep the curve smooth."""

    def basis(t: float) -> list[tuple[int, float]]:
        x = (t - lo) / step
        k = min(int(x), knots - 1)
        f = x - k
        return [(k, 1 - f), (k + 1, f)]

    size = knots + 1
    normal = [[0.0] * size for _ in range(size)]
    rhs = [0.0] * size
    for t_a, t_b, diff in pairs:
        weights: dict[int, float] = defaultdict(float)
        for k, w in basis(t_b):
            weights[k] += w
        for k, w in basis(t_a):
            weights[k] -= w
        for r, wr in weights.items():
            rhs[r] += wr * diff
            for c, wc in weights.items():
                normal[r][c] += wr * wc
    penalty = SMOOTHING * len(pairs) / knots
    for k in range(1, knots):
        row = ((k - 1, 1.0), (k, -2.0), (k + 1, 1.0))
        for r, wr in row:
            for c, wc in row:
                normal[r][c] += penalty * wr * wc
    # Knot 0 is fixed at zero: drop its row and column, and keep the system well posed.
    a = [row[1:] for row in normal[1:]]
    b = rhs[1:]
    for k in range(knots):
        a[k][k] += 1e-9
    return _solve(a, b)


def _solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Gaussian elimination with partial pivoting (the systems are a few dozen knots)."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(col + 1, n):
            f = m[r][col] / m[col][col]
            if f:
                for c in range(col, n + 1):
                    m[r][c] -= f * m[col][c]
    out = [0.0] * n
    for r in range(n - 1, -1, -1):
        out[r] = (m[r][n] - sum(m[r][c] * out[c] for c in range(r + 1, n))) / m[r][r]
    return out


def _level_splits(
    activity: NormalisedActivity, correction: Callable[[float], float]
) -> tuple[Split, ...]:
    """Each split's elevation change, corrected. Splits run back to back from the first sample
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
