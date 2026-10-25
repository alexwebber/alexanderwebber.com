"""Named race distances (data-model §4), from ``schemas/distances.json``, the table the site
reads too (``src/sections/running/domain/distances.ts``)."""

import json
import math

from awingest.schemas import find_repo_root

DISTANCES_M: dict[str, float] = {
    name: float(metres)
    for name, metres in json.loads(
        (find_repo_root() / "schemas" / "distances.json").read_text(encoding="utf-8")
    ).items()
}


def parse_distance(value: object) -> float | None:
    """Metres for a distance name or a positive number of metres; None for anything else."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) and value > 0 else None
    return DISTANCES_M.get(value) if isinstance(value, str) else None


def distance_label(metres: float) -> str:
    """The distance's name if it has one (within half a metre), else e.g. ``8 km``/``8.5 km``."""
    for name, value in DISTANCES_M.items():
        if abs(value - metres) <= 0.5:
            return name
    return f"{metres / 1000:g} km"
