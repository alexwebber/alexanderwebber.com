"""Plausibility of a best effort (T058; FR-057).

An effort is implausible, and ignored for PBs and race-time goals (it is still published, for
audit), when its time is under 0.85 x the men's world record for the distance, or when its
fastest 1 km inside it is under 2:30. Both catch GPS glitches and runs recorded in a car or on a
bike, not real performances.

The records are rounded down to the second, so the threshold errs towards "plausible". A goal
distance outside the table is scaled from the nearest record with Riegel's formula
(t2 = t1 x (d2/d1)^1.06).
"""

import math

from awingest.distances import DISTANCES_M

# By distance name, so every named distance has a record and the metres come from one table.
_WORLD_RECORDS_BY_NAME: dict[str, float] = {
    "1k": 131,  # 2:11.96
    "1mi": 223,  # 3:43.13
    "3k": 437,  # 7:17.55
    "5k": 755,  # 12:35.36
    "10k": 1571,  # 26:11.00
    "15k": 2427,  # 40:27 (road)
    "10mi": 2664,  # 44:24 (road)
    "20k": 3321,  # 55:21 (road)
    "half": 3402,  # 56:42 (road)
    "30k": 5207,  # 1:26:47
    "marathon": 7235,  # 2:00:35
}
WORLD_RECORD_S: dict[float, float] = {
    DISTANCES_M[name]: seconds for name, seconds in _WORLD_RECORDS_BY_NAME.items()
}
WORLD_RECORD_FACTOR = 0.85
MIN_KM_SPLIT_S = 150  # 2:30/km
RIEGEL_EXPONENT = 1.06


def world_record_s(distance_m: float) -> float:
    if distance_m in WORLD_RECORD_S:
        return WORLD_RECORD_S[distance_m]
    nearest = min(WORLD_RECORD_S, key=lambda d: abs(math.log(d / distance_m)))
    return WORLD_RECORD_S[nearest] * (distance_m / nearest) ** RIEGEL_EXPONENT


def min_plausible_time_s(distance_m: float) -> float:
    return WORLD_RECORD_FACTOR * world_record_s(distance_m)


def is_plausible(distance_m: float, time_s: float, fastest_km_s: float | None) -> bool:
    """``fastest_km_s`` is the fastest 1 km within the effort, or None if it is shorter."""
    if time_s < min_plausible_time_s(distance_m):
        return False
    return fastest_km_s is None or fastest_km_s >= MIN_KM_SPLIT_S
