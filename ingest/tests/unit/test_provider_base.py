"""The provider contract's types and failure taxonomy (T047)."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from awingest.archive.base import ArchiveConflict, ArchiveUnavailable
from awingest.providers.base import (
    APPROVED_HEALTH_METRICS,
    AuthRejected,
    NormalisedActivity,
    NormalisedHealthReading,
    ProviderChanged,
    ProviderForbidden,
    RateLimited,
    Sample,
    Transient,
)

LONDON = ZoneInfo("Europe/London")


def activity(**overrides) -> NormalisedActivity:
    fields = {
        "provider_id": "i12345678",
        "source": "intervals",
        "start_local": datetime(2026, 10, 11, 7, 15, tzinfo=LONDON),
        "type": "road",
        "treadmill": False,
        "is_race_flag": False,
        "distance_m": 10000.0,
        "moving_s": 2681.0,
        "elapsed_s": 2700.0,
    }
    fields.update(overrides)
    return NormalisedActivity(**fields)


def test_the_approved_health_metrics_are_exactly_the_fr060_list():
    assert set(APPROVED_HEALTH_METRICS) == {
        "weight_kg",
        "body_fat_pct",
        "resting_hr",
        "hrv",
        "vo2max",
        "fitness_ctl",
        "fatigue_atl",
    }


@pytest.mark.parametrize("metric", ["sleep_secs", "steps", "spo2", "stress", "body_battery"])
def test_unapproved_health_metrics_are_rejected(metric):
    with pytest.raises(ValueError, match="approved"):
        NormalisedHealthReading(metric=metric, date=date(2026, 10, 11), value=1.0)


def test_a_valid_activity_and_reading_construct():
    assert activity(type="indoor", treadmill=True).treadmill
    assert NormalisedHealthReading("weight_kg", date(2026, 10, 11), 100.4).value == 100.4


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"type": "road", "treadmill": True}, "treadmill"),
        ({"type": "virtual"}, "type"),
        ({"start_local": datetime(2026, 10, 11, 7, 15)}, "timezone"),
        ({"distance_m": -1.0}, "distance_m"),
        ({"avg_hr": 0.0}, "avg_hr"),
        ({"avg_power_w": float("nan")}, "avg_power_w"),
    ],
)
def test_invalid_activities_are_rejected(overrides, message):
    with pytest.raises(ValueError, match=message):
        activity(**overrides)


def test_missing_optional_metrics_are_none():
    run = activity()
    assert (run.avg_hr, run.avg_power_w, run.dynamics, run.training_effect) == (None,) * 4


def test_private_fields_stay_out_of_repr():
    run = activity(
        title_raw="Morning Run in Hove",
        description_raw="from home",
        samples=(Sample(t_s=0, lat=50.8231, lon=-0.1372),),
    )
    text = repr(run)
    for private in ("i12345678", "Hove", "from home", "50.8231"):
        assert private not in text


def test_failure_classes_match_the_pipeline_contract():
    expected = {
        AuthRejected: ("auth_rejected", 10),
        RateLimited: ("rate_limited", 11),
        ProviderForbidden: ("provider_forbidden", 12),
        ProviderChanged: ("provider_changed", 13),
        Transient: ("transient", 1),
        ArchiveUnavailable: ("archive_unavailable", 14),
        ArchiveConflict: ("archive_conflict", 14),
    }
    for cls, (code, exit_code) in expected.items():
        assert (cls.code, cls.exit_code) == (code, exit_code)
        assert cls.likely_cause and cls.action
    assert RateLimited("429", retry_after=120).retry_after == 120
    assert RateLimited().retry_after is None
