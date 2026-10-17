"""Structured logging (T046): JSON lines, and nothing secret or provider-identifying in them."""

import base64
import io
import json

import pytest

from awingest.archive.base import ArchiveUnavailable
from awingest.logging import Logger, scrub
from awingest.providers.base import AuthRejected

KEY = "4f2c9a7e1b3d5f6a8c0e2d4b"


def lines(stream: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in stream.getvalue().splitlines()]


@pytest.fixture
def log(monkeypatch):
    monkeypatch.setenv("INTERVALS_API_KEY", KEY)
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "r2-secret-value-123")
    monkeypatch.setenv("GITHUB_RUN_ID", "39055362164")
    monkeypatch.setenv("GITHUB_RUN_ATTEMPT", "2")
    stream = io.StringIO()
    return Logger("fetch", provider="intervals", stream=stream), stream


def test_writes_one_json_object_per_line_with_the_standard_fields(log):
    logger, stream = log
    logger.info("fetch.start", window_days=14)
    logger.bind(stage="publish").warning("publish.skip", reason="no changes")
    first, second = lines(stream)
    assert first["event"] == "fetch.start"
    assert first["level"] == "info"
    assert first["stage"] == "fetch"
    assert first["provider"] == "intervals"
    assert first["window_days"] == 14
    assert first["ts"].endswith("Z")
    # The pipeline run (not a public run ID) comes from GitHub Actions and isn't scrubbed.
    assert first["run_id"] == second["run_id"] == "39055362164-2"
    assert second["stage"] == "publish"


def test_run_id_is_local_outside_actions(monkeypatch):
    monkeypatch.delenv("GITHUB_RUN_ID", raising=False)
    assert Logger("fetch").run_id.startswith("local-")


def test_secrets_are_redacted_wherever_they_appear(log):
    logger, stream = log
    basic = base64.b64encode(f"API_KEY:{KEY}".encode()).decode()
    logger.info(
        "http.request",
        message=f"GET with key {KEY}",
        headers={"Authorization": f"Basic {basic}", "User-Agent": "alexanderwebber.com-ingest"},
        nested=[{"note": f"secret r2-secret-value-123 and Basic {basic}"}],
        raw="Authorization: Bearer abc.def.ghi",
    )
    text = stream.getvalue()
    for secret in (KEY, basic, "r2-secret-value-123", "abc.def.ghi"):
        assert secret not in text
    record = lines(stream)[0]
    assert record["headers"]["Authorization"] == "[redacted]"
    assert record["headers"]["User-Agent"] == "alexanderwebber.com-ingest"


def test_emails_are_redacted(log):
    logger, stream = log
    logger.info("owner.contact", message="sent to someone.else+tag@example.co.uk")
    assert "example.co.uk" not in stream.getvalue()
    assert "[email]" in stream.getvalue()


@pytest.mark.parametrize(
    "text",
    [
        "fetched i12345678",
        "GET /api/v1/activity/i1234567/streams.json",
        "garmin external id 17234567890",
    ],
)
def test_provider_activity_ids_are_redacted(text):
    out = scrub(text, [])
    assert "1234567" not in out
    assert "[activity-id]" in out


@pytest.mark.parametrize(
    "text",
    [
        "10k in 44:41 on 2026-10-17",
        "run 2026-10-11-k3f7 written",
        "listed 5000 activities, 123456 bytes",
        "2026-10-17T18:00:00Z",
        "weight 101.234567891",
    ],
)
def test_ordinary_values_survive_scrubbing(text):
    assert scrub(text, []) == text


def test_sensitive_keys_are_redacted_whatever_their_value(log):
    logger, stream = log
    logger.info(
        "map", provider_id="abc", activityId=42, external_id=None, public_id="2026-10-11-k3f7"
    )
    record = lines(stream)[0]
    assert record["provider_id"] == "[redacted]"
    assert record["activityId"] == "[redacted]"
    assert record["external_id"] == "[redacted]"
    assert record["public_id"] == "2026-10-11-k3f7"


def test_errors_carry_class_and_code(log):
    logger, stream = log
    logger.error("fetch.failed", exc=AuthRejected(f"401 for key {KEY}"))
    logger.error("archive.failed", exc=ArchiveUnavailable("R2 put x failed: AccessDenied"))
    logger.error("crash", exc=ValueError("boom i98765432"))
    auth, archive, crash = lines(stream)
    assert (auth["error_class"], auth["code"]) == ("AuthRejected", "auth_rejected")
    assert KEY not in auth["message"]
    assert (archive["error_class"], archive["code"]) == (
        "ArchiveUnavailable",
        "archive_unavailable",
    )
    assert (crash["error_class"], crash["code"]) == ("ValueError", "unexpected")
    assert "98765432" not in crash["message"]
