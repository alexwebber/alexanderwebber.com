"""The provider contract (T047; contracts/provider-adapter.md, data-model §2).

Adapters fetch raw payloads (archived verbatim) and map them, purely, to the normalised types
below. Nothing outside an adapter depends on a provider's raw format. Provider IDs appear only as
``provider_id``, which is private: it never leaves the processor, and it is kept out of ``repr``
so a traceback or a log line can't carry it.
"""

import math
from collections.abc import Iterable, Mapping, Sequence
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Protocol, Self, get_args

from awingest.errors import IngestError

RunType = Literal["road", "track", "trail", "indoor"]
HealthMetric = Literal[
    "weight_kg", "body_fat_pct", "resting_hr", "hrv", "vo2max", "fitness_ctl", "fatigue_atl"
]

# FR-060–FR-062: the only health metrics any provider may supply. Sleep, stress, Body Battery,
# steps and SpO2 are never ingested (FR-015).
APPROVED_HEALTH_METRICS: tuple[str, ...] = get_args(HealthMetric)
RUN_TYPES: tuple[str, ...] = get_args(RunType)


# --- Failure taxonomy (exit codes and texts: contracts/pipeline.md, alert contract) ---


class ProviderError(IngestError):
    """A provider failure. Adapters raise only these; library and HTTP errors never escape."""


class AuthRejected(ProviderError):
    code = "auth_rejected"
    exit_code = 10
    likely_cause = "The provider rejected the API key (HTTP 401, or 403 with a JSON body)."
    action = (
        "Replace the key: the agent asks the owner to generate a new API key in intervals.icu "
        "(Settings → Developer Settings) and supplies the `gh secret set INTERVALS_API_KEY` "
        "command. No retry loop."
    )


class RateLimited(ProviderError):
    code = "rate_limited"
    exit_code = 11
    likely_cause = "The provider is rate-limiting requests (HTTP 429)."
    action = "Wait: back-off is automatic. Raise with the owner only if it persists over 3 days."

    def __init__(self, message: str = "rate limited", retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class ProviderForbidden(ProviderError):
    code = "provider_forbidden"
    exit_code = 12
    likely_cause = (
        "A bot block, not an auth failure: HTTP 403 with an HTML body (Cloudflare challenge)."
    )
    action = (
        "The agent checks the client still sends its descriptive User-Agent and whether "
        "Cloudflare rules changed (compare a local call). No owner action."
    )


class ProviderChanged(ProviderError):
    code = "provider_changed"
    exit_code = 13
    likely_cause = "The provider's response shape changed (parse or schema-drift error)."
    action = (
        "The agent checks the provider's OpenAPI spec, fixes the adapter and runs "
        "`process --all` (no provider calls needed for archived data)."
    )


class Transient(ProviderError):
    code = "transient"
    exit_code = 1
    likely_cause = "A network error or a provider-side 5xx."
    action = "None: retried on the next run. Alerted only if it persists over 24 hours."


# --- Raw (archived verbatim) ---


@dataclass(frozen=True)
class ActivityRef:
    """One running activity from a provider's activity list."""

    provider_id: str = field(repr=False)
    start_local: datetime
    # A hash of the list row, so the fetch stage re-fetches only new or changed activities.
    row_hash: str


@dataclass(frozen=True)
class RawBundle:
    """An activity's raw parts as received (e.g. summary, detail, streams, time-at-hr, fit)."""

    ref: ActivityRef
    parts: Mapping[str, bytes] = field(repr=False)


@dataclass(frozen=True)
class RawHealthDay:
    """One day of wellness data, already reduced to approved keys (Rule 2) and serialised."""

    day: date
    payload: bytes = field(repr=False)


# --- Normalised (adapter output; still private, full fidelity) ---


@dataclass(frozen=True)
class Dynamics:
    gct_ms: float | None = None
    gct_balance_pct: float | None = None
    vert_osc_mm: float | None = None
    vert_ratio_pct: float | None = None


@dataclass(frozen=True)
class TrainingEffect:
    aerobic: float
    anaerobic: float


@dataclass(frozen=True)
class Split:
    """One kilometre (the last may be partial: ``distance_m`` < 1000)."""

    km: int
    distance_m: float
    time_s: float
    avg_hr: float | None = None
    elev_delta_m: float | None = None


@dataclass(frozen=True)
class HrZone:
    zone: int
    seconds: float


@dataclass(frozen=True)
class Sample:
    """One stream point. ``lat``/``lon`` are private: published only for race tracks."""

    t_s: float
    dist_m: float | None = None
    speed_mps: float | None = None
    hr: float | None = None
    cadence: float | None = None
    power: float | None = None
    elev_m: float | None = None
    lat: float | None = field(default=None, repr=False)
    lon: float | None = field(default=None, repr=False)


def _check_optional(name: str, value: float | None) -> None:
    # A metric the provider didn't record is None, never 0 (contract: missing is None).
    if value is not None and (not math.isfinite(value) or value <= 0):
        raise ValueError(f"{name} must be a positive number or None (missing), got {value!r}")


@dataclass(frozen=True)
class NormalisedActivity:
    provider_id: str = field(repr=False)
    source: str
    start_local: datetime  # Europe/London
    type: RunType
    treadmill: bool
    is_race_flag: bool
    distance_m: float
    moving_s: float
    elapsed_s: float
    elevation_gain_m: float | None = None
    elevation_loss_m: float | None = None
    avg_hr: float | None = None
    max_hr: float | None = None
    avg_cadence: float | None = None
    avg_stride_m: float | None = None
    avg_power_w: float | None = None
    training_load: float | None = None  # private; per-run load is not published
    dynamics: Dynamics | None = None
    training_effect: TrainingEffect | None = None  # not exposed by intervals.icu
    title_raw: str | None = field(default=None, repr=False)
    description_raw: str | None = field(default=None, repr=False)
    splits: tuple[Split, ...] = ()
    hr_zones: tuple[HrZone, ...] = ()
    samples: tuple[Sample, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        if self.type not in RUN_TYPES:
            raise ValueError(f"type must be one of {RUN_TYPES}, got {self.type!r}")
        if self.treadmill and self.type != "indoor":
            raise ValueError("a treadmill run must have type 'indoor'")
        if self.start_local.tzinfo is None:
            raise ValueError("start_local must be timezone-aware (Europe/London)")
        for name in ("distance_m", "moving_s", "elapsed_s"):
            value = getattr(self, name)
            if not math.isfinite(value) or value < 0:
                raise ValueError(f"{name} must be a non-negative number, got {value!r}")
        for name in ("avg_hr", "max_hr", "avg_cadence", "avg_stride_m", "avg_power_w"):
            _check_optional(name, getattr(self, name))


@dataclass(frozen=True)
class NormalisedHealthReading:
    metric: HealthMetric
    date: date
    value: float
    extra: Mapping[str, Any] | None = None

    def __post_init__(self) -> None:
        if self.metric not in APPROVED_HEALTH_METRICS:
            raise ValueError(f"metric {self.metric!r} is not on the approved list")
        if not math.isfinite(self.value):
            raise ValueError(f"value must be a finite number, got {self.value!r}")


# --- Protocols ---


class ActivityProvider(Protocol):
    name: str

    def list_activities(self, oldest: date, newest: date) -> Iterable[ActivityRef]:
        """Running activities only (FR-009) started between ``oldest`` and ``newest``."""
        ...

    def fetch_activity(self, ref: ActivityRef) -> RawBundle:
        """The activity's raw parts, keyed by name."""
        ...

    def normalise_activity(self, bundle: RawBundle) -> NormalisedActivity:
        """Pure: no I/O, and the same bundle always gives the same result."""
        ...


class HealthProvider(Protocol):
    name: str
    metrics: Sequence[str]  # a subset of APPROVED_HEALTH_METRICS

    def fetch_health(self, oldest: date, newest: date) -> Iterable[RawHealthDay]:
        """One record per day, already reduced to approved keys before it is returned."""
        ...

    def normalise_health(self, raw: RawHealthDay) -> list[NormalisedHealthReading]:
        """Pure: no I/O."""
        ...


class Provider(ActivityProvider, HealthProvider, Protocol):
    def session(self) -> AbstractContextManager[Self]:
        """Open the HTTP client (credentials from the environment) for a block of calls."""
        ...
