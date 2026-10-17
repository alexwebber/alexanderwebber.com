"""Run titles (T057; FR-011, FR-012, FR-049).

Training runs get a neutral title from the run type and distance, e.g. ``Run · 8.2 km``. The
provider's free-text name and description (often Garmin's town-based default, e.g. "Hastings
Running") are never used: they can give away where the owner lives and trains. intervals.icu
supplies no workout type (and no Garmin training effect), so the type word comes from the run
type only. A race takes the owner's race name from ``race.yaml``, else ``Race · 21.1 km``. An
owner custom title from ``run-overrides.yaml`` always wins.
"""

from awingest.providers.base import NormalisedActivity

SEPARATOR = " · "


def km(distance_m: float) -> str:
    return f"{distance_m / 1000:.1f} km"


def type_word(activity: NormalisedActivity) -> str:
    if activity.treadmill:
        return "Treadmill run"
    if activity.type == "indoor":
        return "Indoor run"
    if activity.type == "trail":
        return "Trail run"
    if activity.type == "track":
        return "Track run"
    return "Run"


def neutral_title(activity: NormalisedActivity) -> str:
    return type_word(activity) + SEPARATOR + km(activity.distance_m)


def run_title(
    activity: NormalisedActivity,
    *,
    is_race: bool,
    custom: str | None = None,
    race_name: str | None = None,
) -> str:
    if custom:
        return custom
    if is_race:
        return race_name or "Race" + SEPARATOR + km(activity.distance_m)
    return neutral_title(activity)
