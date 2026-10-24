"""Race tracks (T125; data-model "Race track", FR-014, FR-054, FR-058): a race's GPS route, the
only published coordinates anywhere (Principle VI).

- **When**: only for a race (``is_race``) that is not a treadmill or indoor run and whose
  ``race.yaml`` doesn't say ``hide_map``. Anything else has no track, and the pipeline removes any
  track it had (a race un-designated, or its map hidden, loses it on the next process).
- **Trim**: ``trim_ends_m`` (``race.yaml``, default 0) drops that many metres from each end, for
  a race that starts or finishes near somewhere private. Points keep the race's own distances,
  so the site's km markers still line up with the race.
- **Simplify**: Douglas–Peucker in local metres, with the tolerance doubled from 0.5 m until the
  track fits in ``MAX_POINTS``. At race scale that loses about a metre, which no map can show.
- **Output**: ``{id, points: [[lat, lon, dist_m, elev_m]], trim_ends_m, bbox, source}``, written
  by the pipeline to ``race-tracks/<run-id>.json`` beside the run's ``track_ref``.

A track with fewer than two fixes (no GPS, or everything trimmed) is no track.
"""

import math
from collections.abc import Sequence

from awingest.process.overrides import RaceLink
from awingest.providers.base import NormalisedActivity

SCHEMA_VERSION = 1
MAX_POINTS = 1000
START_TOLERANCE_M = 0.5
EARTH_RADIUS_M = 6_371_000

Point = tuple[float, float, float, float | None]  # lat, lon, dist_m, elev_m


def track_path(run_id: str) -> str:
    return f"race-tracks/{run_id}.json"


def track_ref(run_id: str) -> str:
    return f"race-tracks/{run_id}"


def wants_track(activity: NormalisedActivity, *, is_race: bool, race: RaceLink | None) -> bool:
    if not is_race or activity.treadmill or activity.type == "indoor":
        return False
    return not (race is not None and race.hide_map)


def _fixes(activity: NormalisedActivity) -> list[Point]:
    return [
        (s.lat, s.lon, s.dist_m, s.elev_m)
        for s in activity.samples
        if s.lat is not None and s.lon is not None and s.dist_m is not None
    ]


def trim(points: Sequence[Point], metres: float) -> list[Point]:
    """The points at least ``metres`` from both ends, by distance along the route."""
    if metres <= 0 or not points:
        return list(points)
    start, end = points[0][2] + metres, points[-1][2] - metres
    return [p for p in points if start <= p[2] <= end]


def _xy(points: Sequence[Point]) -> list[tuple[float, float]]:
    """Local metres (equirectangular about the mean latitude): plenty for a race's extent."""
    lat0 = math.radians(sum(p[0] for p in points) / len(points))
    k = math.pi / 180 * EARTH_RADIUS_M
    return [(p[1] * k * math.cos(lat0), p[0] * k) for p in points]


def _offset(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distance from ``p`` to the segment ``a``–``b``."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    t = (
        0.0
        if length2 == 0
        else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2))
    )
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def douglas_peucker(xy: Sequence[tuple[float, float]], tolerance: float) -> list[int]:
    """Indexes kept by Douglas–Peucker at ``tolerance`` metres (iterative: a 1 Hz marathon has
    over 10,000 points, too deep for recursion)."""
    if len(xy) <= 2:
        return list(range(len(xy)))
    keep = {0, len(xy) - 1}
    stack = [(0, len(xy) - 1)]
    while stack:
        lo, hi = stack.pop()
        far, at = 0.0, -1
        for i in range(lo + 1, hi):
            d = _offset(xy[i], xy[lo], xy[hi])
            if d > far:
                far, at = d, i
        if at >= 0 and far > tolerance:
            keep.add(at)
            stack.extend(((lo, at), (at, hi)))
    return sorted(keep)


def simplify(points: Sequence[Point], max_points: int = MAX_POINTS) -> list[Point]:
    xy = _xy(points)
    tolerance = START_TOLERANCE_M
    kept = douglas_peucker(xy, tolerance)
    while len(kept) > max_points:
        tolerance *= 2
        kept = douglas_peucker(xy, tolerance)
    return [points[i] for i in kept]


def build_track(
    activity: NormalisedActivity, *, run_id: str, trim_ends_m: float = 0
) -> dict | None:
    """The published track document, or None when there is nothing to draw."""
    points = trim(_fixes(activity), trim_ends_m)
    if len(points) < 2:
        return None
    points = simplify(points)
    lats, lons = [p[0] for p in points], [p[1] for p in points]
    return {
        "schema_version": SCHEMA_VERSION,
        "id": run_id,
        "points": [
            [
                round(lat, 6),
                round(lon, 6),
                round(max(dist, 0.0), 1),
                None if elev is None or not math.isfinite(elev) else round(elev, 1),
            ]
            for lat, lon, dist, elev in points
        ],
        "trim_ends_m": trim_ends_m,
        "bbox": [
            round(min(lats), 6),
            round(min(lons), 6),
            round(max(lats), 6),
            round(max(lons), 6),
        ],
        "source": activity.source,
    }
