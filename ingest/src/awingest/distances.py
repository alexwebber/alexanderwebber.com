"""Named race distances and owner time strings (data-model §4), as the site parses them
(``src/shared/format/parse.ts``)."""

import math
import re

DISTANCES_M: dict[str, float] = {
    "1k": 1000,
    "1mi": 1609.344,
    "3k": 3000,
    "5k": 5000,
    "10k": 10000,
    "15k": 15000,
    "10mi": 16093.44,
    "20k": 20000,
    "half": 21097.5,
    "30k": 30000,
    "marathon": 42195,
}

_TIME = re.compile(r"^(?:(\d{1,2}):([0-5]\d):([0-5]\d)|(\d{1,3}):([0-5]\d))$")
_MAX_TIME_S = 24 * 3600


def parse_distance(value: object) -> float | None:
    """Metres for a distance name or a positive number of metres; None for anything else."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) and value > 0 else None
    return DISTANCES_M.get(value) if isinstance(value, str) else None


def parse_time(text: str) -> float | None:
    """Seconds for ``h:mm:ss`` or ``mm:ss``; None if invalid, zero, or a day or more."""
    match = _TIME.match(text)
    if not match:
        return None
    if match.group(1) is not None:
        h, m, s = (int(match.group(i)) for i in (1, 2, 3))
        seconds = h * 3600 + m * 60 + s
    else:
        seconds = int(match.group(4)) * 60 + int(match.group(5))
    return float(seconds) if 0 < seconds < _MAX_TIME_S else None


def distance_label(metres: float) -> str:
    """The distance's name if it has one (within half a metre), else e.g. ``8 km``/``8.5 km``."""
    for name, value in DISTANCES_M.items():
        if abs(value - metres) <= 0.5:
            return name
    return f"{metres / 1000:g} km"
