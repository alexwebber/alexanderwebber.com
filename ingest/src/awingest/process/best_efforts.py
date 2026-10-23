"""Best efforts (T059; spec "Best Effort"): the fastest continuous segment of each standard
distance, and of each goal ``race_time`` distance, within a run.

A two-pointer sliding window runs over cumulative distance and elapsed time. For each sample
``j`` the window start is the last sample ``i`` at least the target distance back; the exact
start point is interpolated linearly between ``i`` and ``i + 1``, so efforts aren't rounded to
the sampling interval. Time is the watch's timer time, as on Garmin (owner, 2026-10-23): while
the watch is paused it records nothing, so a pause shows as a jump in the time stream with
almost no distance, and that jump is left out. A stop with the watch still running is recorded
second by second and still counts. (Checked on 197 real runs: these jumps match the provider's
paused time to within 5 s in 168 of them.) Each effort carries its plausibility (FR-057), using
the fastest 1 km inside it.
"""

from bisect import bisect_left
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from awingest.distances import DISTANCES_M, distance_label
from awingest.process.plausibility import is_plausible
from awingest.providers.base import Sample

STANDARD_DISTANCES: tuple[float, ...] = tuple(DISTANCES_M.values())
KM = 1000.0
# A watch pause: a gap between samples longer than this (seconds)...
PAUSE_MIN_S = 1.0
# ...covering less distance than this speed would (m/s; walking is about 1.4).
PAUSE_SPEED_MPS = 0.5
# A paused gap still counts as one ordinary sampling step (the watch records every second).
SAMPLE_STEP_S = 1.0


@dataclass(frozen=True)
class BestEffort:
    distance_m: float
    label: str
    time_s: float
    plausible: bool


@dataclass(frozen=True)
class _Window:
    time_s: float
    start_t: float  # interpolated elapsed time at the window's start
    end: int  # index of the window's last sample


def track(samples: Iterable[Sample]) -> tuple[list[float], list[float]]:
    """Cumulative distance and timer time, skipping samples without a distance. Distance never
    runs backwards (a GPS wobble is held at the furthest point so far). A watch pause (a time
    jump covering less than ``PAUSE_SPEED_MPS``) counts as one sampling step, not its length."""
    dist: list[float] = []
    time: list[float] = []
    last_t = 0.0  # the previous sample's elapsed time
    paused = 0.0  # paused seconds so far
    for s in samples:
        if s.dist_m is None:
            continue
        if time and s.t_s < last_t:
            continue  # out-of-order sample
        d = max(s.dist_m, dist[-1]) if dist else s.dist_m
        if time:
            dt = s.t_s - last_t
            if dt > PAUSE_MIN_S and d - dist[-1] < dt * PAUSE_SPEED_MPS:
                paused += dt - SAMPLE_STEP_S
        dist.append(d)
        time.append(s.t_s - paused)
        last_t = s.t_s
    return dist, time


def windows(dist: Sequence[float], time: Sequence[float], target: float) -> list[_Window]:
    """For each sample that ends a window of ``target`` metres, that window's time."""
    out: list[_Window] = []
    i = 0
    for j in range(len(dist)):
        while i < j and dist[j] - dist[i + 1] >= target:
            i += 1
        if dist[j] - dist[i] < target:
            continue
        start = dist[j] - target
        span = dist[i + 1] - dist[i]
        frac = 0.0 if span <= 0 else (start - dist[i]) / span
        start_t = time[i] + frac * (time[i + 1] - time[i])
        out.append(_Window(time_s=time[j] - start_t, start_t=start_t, end=j))
    return out


def fastest(dist: Sequence[float], time: Sequence[float], target: float) -> _Window | None:
    """The fastest window (the earliest, on a tie). Same walk as ``windows``, without building
    a window per sample."""
    best: _Window | None = None
    i = 0
    for j in range(len(dist)):
        while i < j and dist[j] - dist[i + 1] >= target:
            i += 1
        if dist[j] - dist[i] < target:
            continue
        span = dist[i + 1] - dist[i]
        frac = 0.0 if span <= 0 else (dist[j] - target - dist[i]) / span
        start_t = time[i] + frac * (time[i + 1] - time[i])
        if best is None or time[j] - start_t < best.time_s:
            best = _Window(time_s=time[j] - start_t, start_t=start_t, end=j)
    return best


def effort_distances(extra: Iterable[float] = ()) -> list[float]:
    """The standard distances plus any others (e.g. goal distances), deduplicated to 0.5 m."""
    out = list(STANDARD_DISTANCES)
    for metres in sorted(extra):
        if metres > 0 and all(abs(metres - d) > 0.5 for d in out):
            out.append(metres)
    return sorted(out)


def best_efforts(samples: Sequence[Sample], extra: Iterable[float] = ()) -> list[BestEffort]:
    dist, time = track(samples)
    if len(dist) < 2:
        return []
    kms = windows(dist, time, KM)
    km_ends = [w.end for w in kms]
    km_starts = [w.start_t for w in kms]
    out = []
    for target in effort_distances(extra):
        if dist[-1] - dist[0] < target:
            break
        best = fastest(dist, time, target)
        if best is None or best.time_s <= 0:
            continue
        fastest_km = None
        if target >= KM:
            # The fastest 1 km window lying wholly inside the effort.
            lo = bisect_left(km_starts, best.start_t - 1e-9)
            hi = bisect_left(km_ends, best.end + 1)
            inside = [kms[k].time_s for k in range(lo, hi)]
            fastest_km = min(inside) if inside else None
        out.append(
            BestEffort(
                distance_m=target,
                label=distance_label(target),
                time_s=round(best.time_s, 1),
                plausible=is_plausible(target, best.time_s, fastest_km),
            )
        )
    return out
