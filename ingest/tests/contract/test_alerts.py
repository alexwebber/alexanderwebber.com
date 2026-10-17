"""Failed-refresh alerts (T065, T082; contracts/pipeline.md alert contract), against a fake
GitHub issues API."""

import io
import json
import urllib.parse
from datetime import UTC, datetime, timedelta

import pytest

from awingest.alerts import LABEL, GitHubIssues, failure_class, run_alert
from awingest.archive.local import LocalArchive
from awingest.logging import Logger
from awingest.providers.base import AuthRejected, ProviderForbidden, RateLimited
from awingest.state import FETCH_STATUS

NOW = datetime(2026, 10, 17, 12, 0, tzinfo=UTC)
TOKEN = "ghs_test-token-1234567890"


def iso(when):
    return when.isoformat().replace("+00:00", "Z")


class FakeGitHub:
    """Just enough of the issues API: labels, issues, comments."""

    def __init__(self):
        self.labels: set[str] = set()
        self.issues: list[dict] = []
        self.comments: dict[int, list[dict]] = {}
        self.requests = []
        self.now = NOW
        self.fail_with: int | None = None

    def __call__(self, request):
        self.requests.append(request)
        if self.fail_with:
            return self.fail_with, b'{"message":"nope"}'
        url = urllib.parse.urlsplit(request.full_url)
        path = url.path.removeprefix("/repos/owner/repo")
        query = dict(urllib.parse.parse_qsl(url.query))
        body = json.loads(request.data) if request.data else None
        method = request.get_method()
        if path == f"/labels/{LABEL}":
            return (200, b"{}") if LABEL in self.labels else (404, b"{}")
        if path == "/labels" and method == "POST":
            self.labels.add(body["name"])
            return 201, json.dumps(body).encode()
        if path == "/issues" and method == "GET":
            found = [
                i for i in self.issues
                if i["state"] == query["state"] and query["labels"] in i["labels"]
            ]  # fmt: skip
            return 200, json.dumps(found).encode()
        if path == "/issues" and method == "POST":
            issue = {
                "number": len(self.issues) + 1,
                "title": body["title"],
                "body": body["body"],
                "labels": body["labels"],
                "state": "open",
                "created_at": iso(self.now),
            }
            self.issues.append(issue)
            return 201, json.dumps(issue).encode()
        number = int(path.split("/")[2])
        if path.endswith("/comments") and method == "GET":
            since = datetime.fromisoformat(query["since"])
            found = [
                c for c in self.comments.get(number, [])
                if datetime.fromisoformat(c["created_at"]) >= since
            ]  # fmt: skip
            return 200, json.dumps(found).encode()
        if path.endswith("/comments"):
            comment = {"body": body["body"], "created_at": iso(self.now)}
            self.comments.setdefault(number, []).append(comment)
            return 201, json.dumps(comment).encode()
        if method == "PATCH":
            issue = self.issues[number - 1]
            issue.update(state=body["state"], state_reason=body["state_reason"])
            return 200, json.dumps(issue).encode()
        return 404, b"{}"


@pytest.fixture
def fake():
    return FakeGitHub()


@pytest.fixture
def github(fake):
    return GitHubIssues(TOKEN, "owner/repo", transport=fake)


@pytest.fixture
def archive(tmp_path):
    return LocalArchive(tmp_path / "archive")


def set_status(archive, **entry):
    archive.put(FETCH_STATUS, json.dumps({"intervals": entry}).encode())


def failing(exc_class, last_success=NOW - timedelta(hours=30), **extra):
    return {
        "last_success_at": iso(last_success),
        "last_attempt_at": iso(NOW - timedelta(minutes=5)),
        "outcome": "failed",
        "error_class": exc_class.__name__,
        "code": exc_class.code,
        "message": "intervals.icu rejected the API key for GET /athlete/{id}/activities",
        "consecutive_failures": 15,
        **extra,
    }


def alert(archive, github, now=NOW):
    return run_alert(
        archive,
        github,
        log=Logger("alert", stream=io.StringIO()),
        now=now,
        run_url="https://github.com/owner/repo/actions/runs/1",
    )


@pytest.mark.parametrize("exc_class", [AuthRejected, ProviderForbidden, RateLimited])
def test_a_failure_over_24_hours_opens_an_issue_naming_the_cause_and_action(
    archive, github, fake, exc_class
):
    set_status(archive, **failing(exc_class))
    result = alert(archive, github)
    assert (result.action, result.issue, result.failing) == ("opened", 1, True)
    issue = fake.issues[0]
    assert issue["title"] == "intervals.icu refresh failing since 2026-10-16"
    assert issue["labels"] == [LABEL] and LABEL in fake.labels
    body = issue["body"]
    assert f"`{exc_class.__name__}` (code `{exc_class.code}`)" in body
    assert exc_class.likely_cause in body and exc_class.action in body
    assert "2026-10-16T06:00:00Z" in body  # last good refresh
    assert "https://github.com/owner/repo/actions/runs/1" in body


def test_requests_carry_the_token_and_a_user_agent(archive, github, fake):
    set_status(archive, **failing(AuthRejected))
    alert(archive, github)
    request = fake.requests[0]
    assert request.get_header("Authorization") == f"Bearer {TOKEN}"
    assert request.get_header("User-agent").startswith("alexanderwebber.com-ingest-alerts")


def test_under_24_hours_is_not_yet_an_alert(archive, github, fake):
    set_status(archive, **failing(AuthRejected, last_success=NOW - timedelta(hours=23)))
    assert alert(archive, github).action == "none"
    assert fake.issues == []


def test_while_failing_it_comments_at_most_once_a_day(archive, github, fake):
    set_status(archive, **failing(RateLimited))
    alert(archive, github)
    assert alert(archive, github, now=NOW + timedelta(hours=2)).action == "waiting"
    fake.now = NOW + timedelta(hours=25)
    assert alert(archive, github, now=fake.now).action == "commented"
    fake.now = NOW + timedelta(hours=27)
    assert alert(archive, github, now=fake.now).action == "waiting"
    assert len(fake.comments[1]) == 1 and fake.comments[1][0]["body"].startswith("Still failing at")
    assert len(fake.issues) == 1


def test_recovery_comments_and_closes(archive, github, fake):
    set_status(archive, **failing(AuthRejected))
    alert(archive, github)
    set_status(
        archive, last_success_at=iso(NOW + timedelta(hours=1)), outcome="ok", consecutive_failures=0
    )
    result = alert(archive, github, now=NOW + timedelta(hours=1))
    assert result.action == "closed"
    assert fake.issues[0]["state"] == "closed"
    assert fake.comments[1][-1]["body"].startswith("Recovered at 2026-10-17T13:00:00Z")
    assert alert(archive, github, now=NOW + timedelta(hours=2)).action == "none"


def test_a_refresh_that_stopped_running_is_also_an_alert(archive, github, fake):
    set_status(archive, last_success_at=iso(NOW - timedelta(days=3)), outcome="ok")
    result = alert(archive, github)
    assert result.action == "opened"
    assert "may not be running at all" in fake.issues[0]["body"]


def test_never_succeeded_alerts_only_after_a_failure(archive, github, fake):
    assert alert(archive, github).action == "none"  # no status at all yet
    set_status(archive, **(failing(AuthRejected) | {"last_success_at": None}))
    result = alert(archive, github)
    assert result.action == "opened"
    assert fake.issues[0]["title"] == "intervals.icu refresh failing since 2026-10-17"


def test_secrets_in_the_recorded_message_are_scrubbed(archive, github, fake, monkeypatch):
    monkeypatch.setenv("INTERVALS_API_KEY", "super-secret-key-value")
    set_status(archive, **failing(AuthRejected, message="key super-secret-key-value for i12345678"))
    alert(archive, github)
    body = fake.issues[0]["body"]
    assert "super-secret-key-value" not in body and "i12345678" not in body


def test_github_errors_exit_1(archive, github, fake):
    set_status(archive, **failing(AuthRejected))
    fake.fail_with = 403
    result = alert(archive, github)
    assert (result.exit_code, result.code) == (1, "github_unavailable")


def test_every_failure_code_maps_to_its_class():
    for code in ("auth_rejected", "rate_limited", "provider_forbidden", "provider_changed",
                 "transient", "archive_unavailable", "publish_invalid", "owner_data_invalid"):  # fmt: skip
        cls = failure_class(code)
        assert cls is not None and cls.code == code and cls.action
    assert failure_class("nonsense") is None
