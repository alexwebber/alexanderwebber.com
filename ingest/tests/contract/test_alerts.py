"""Failed-refresh alerts (T065, T082; contracts/pipeline.md alert contract), against a fake
GitHub issues API."""

import io
import json
from datetime import UTC, datetime, timedelta

import pytest
from builders import FakeGitHub

from awingest.alerts import LABEL, GitHubIssues, failure_class, run_alert
from awingest.archive.base import ArchiveUnavailable
from awingest.archive.local import LocalArchive
from awingest.fundraising.alerts import run_fundraising_alert
from awingest.logging import Logger
from awingest.providers.base import AuthRejected, ProviderForbidden, RateLimited, Transient
from awingest.providers.justgiving.errors import (
    FiguresUnpublished,
    KeyRejected,
    PageNotActive,
    PageNotFound,
)
from awingest.state import FETCH_STATUS, FUNDRAISING_STATE, StateCorrupt

NOW = datetime(2026, 10, 17, 12, 0, tzinfo=UTC)
TOKEN = "ghs_test-token-1234567890"


def iso(when):
    return when.isoformat().replace("+00:00", "Z")


@pytest.fixture
def fake():
    return FakeGitHub(NOW)


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


# --- Fundraising: one issue per campaign (specs/002-fundraising/contracts/pipeline.md) ---

BRIGHTON = "- { id: alpha, race_id: alpha, charity: { name: Example }, page_url: https://www.justgiving.com/page/example-alpha%s }\n"
OTHER = "- { id: beta, race_id: beta, charity: { name: Other }, page_url: https://www.justgiving.com/page/example-beta }\n"
ALPHA_LABEL = "fundraising-failing-alpha"


@pytest.fixture
def campaigns(repo):
    (repo / "data/running/owner/campaigns.yaml").write_text(BRIGHTON % "", encoding="utf-8")
    return repo


def issues_for(fake):
    return lambda label: GitHubIssues(TOKEN, "owner/repo", transport=fake, label=label)


def set_campaign(archive, **entry):
    archive.put(FUNDRAISING_STATE, json.dumps({"alpha": entry}).encode())


def fundraising_alert(archive, repo, fake, now=NOW):
    return run_fundraising_alert(
        archive,
        issues_for(fake),
        repo_root=repo,
        log=Logger("fundraising-alert", stream=io.StringIO()),
        now=now,
        run_url="https://github.com/owner/repo/actions/runs/2",
    )


def healthy(**extra):
    return {
        "last_success_at": iso(NOW - timedelta(minutes=5)),
        "last_attempt_at": iso(NOW - timedelta(minutes=5)),
        "outcome": "ok",
        "page_status": "Active",
        "latest": {"read_at": iso(NOW - timedelta(minutes=5))},
        "consecutive_failures": 0,
        **extra,
    }


def failed_read(cls, last_success=NOW - timedelta(hours=25), message="GET fundraising page failed"):
    return healthy(
        last_success_at=iso(last_success),
        outcome="failed",
        error_class=cls.__name__,
        code=cls.code,
        message=message,
        consecutive_failures=12,
    )


def test_a_healthy_campaign_opens_nothing(campaigns, archive, fake):
    set_campaign(archive, **healthy())
    assert fundraising_alert(archive, campaigns, fake).summary() == {
        "actions": {"alpha": "none"},
        "code": None,
        "exit_code": 0,
    }
    assert fake.issues == []


def test_no_state_opens_nothing(campaigns, archive, fake):
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "none"


@pytest.mark.parametrize(("hours", "action"), [(24, "none"), (24.01, "opened")])
def test_a_failing_read_opens_after_24_hours(campaigns, archive, fake, hours, action):
    set_campaign(archive, **failed_read(Transient, last_success=NOW - timedelta(hours=hours)))
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == action


def test_a_page_not_found_opens_at_once_even_if_it_used_to_work(campaigns, archive, fake):
    set_campaign(archive, **failed_read(PageNotFound, last_success=NOW - timedelta(minutes=5)))
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "opened"
    assert PageNotFound.action in fake.issues[0]["body"]


def test_a_page_that_is_not_active_opens_at_once(campaigns, archive, fake):
    set_campaign(archive, **healthy(page_status="Expired"))
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "opened"
    body = fake.issues[0]["body"]
    assert "`PageNotActive` (code `page_not_active`)" in body and PageNotActive.action in body


def test_a_first_failed_read_opens_at_once(campaigns, archive, fake):
    set_campaign(
        archive,
        last_attempt_at=iso(NOW),
        outcome="failed",
        error_class="KeyRejected",
        code=KeyRejected.code,
        message="JUSTGIVING_SUBSCRIPTION_KEY is not set",
        consecutive_failures=1,
    )
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "opened"
    assert fake.issues[0]["title"] == "Example fundraising figures failing since 2026-10-17"
    assert "**JustGiving APIs**" in fake.issues[0]["body"]


@pytest.mark.parametrize(("hours", "action"), [(24, "none"), (24.01, "opened")])
def test_a_first_read_that_never_publishes_opens_after_24_hours(
    campaigns, archive, fake, hours, action
):
    entry = healthy(outcome="unpublished", first_unpublished_at=iso(NOW - timedelta(hours=hours)))
    del entry["last_success_at"]
    set_campaign(archive, **entry)
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == action


def test_figures_not_reaching_the_site_name_the_publish_stage(campaigns, archive, fake):
    set_campaign(
        archive,
        **healthy(outcome="unpublished", last_success_at=iso(NOW - timedelta(hours=30))),
    )
    fundraising_alert(archive, campaigns, fake)
    body = fake.issues[0]["body"]
    assert "`FiguresUnpublished` (code `figures_unpublished`)" in body
    assert FiguresUnpublished.likely_cause in body


def test_reads_that_stopped_altogether_say_so(campaigns, archive, fake):
    set_campaign(archive, **healthy(last_success_at=iso(NOW - timedelta(days=3))))
    fundraising_alert(archive, campaigns, fake)
    assert "may not be running at all" in fake.issues[0]["body"]


def test_the_issue_has_the_contracts_title_label_and_body(campaigns, archive, fake):
    set_campaign(archive, **failed_read(KeyRejected))
    fundraising_alert(archive, campaigns, fake)
    issue = fake.issues[0]
    assert issue["title"] == "Example fundraising figures failing since 2026-10-16"
    assert issue["labels"] == [ALPHA_LABEL] and ALPHA_LABEL in fake.labels
    body = issue["body"]
    assert "`KeyRejected` (code `justgiving_key_rejected`)" in body
    assert "**JustGiving APIs**" in body and "JustGiving" in body
    assert KeyRejected.likely_cause in body and KeyRejected.action in body
    assert "GET fundraising page failed" in body
    assert "- **Last good read**: 2026-10-16T11:00:00Z" in body
    assert "- **Consecutive failures**: 12" in body
    assert "https://github.com/owner/repo/actions/runs/2" in body


def test_the_label_is_created_once(campaigns, archive, fake):
    set_campaign(archive, **failed_read(Transient))
    fundraising_alert(archive, campaigns, fake)
    fake.issues[0]["state"] = "closed"
    fundraising_alert(archive, campaigns, fake)
    posts = [r for r in fake.requests if r.full_url.endswith("/labels")]
    assert len(posts) == 1 and len(fake.issues) == 2


def test_each_campaign_has_its_own_issue(campaigns, archive, fake):
    (campaigns / "data/running/owner/campaigns.yaml").write_text(
        BRIGHTON % "" + OTHER, encoding="utf-8"
    )
    entry = failed_read(Transient)
    archive.put(FUNDRAISING_STATE, json.dumps({"alpha": entry, "beta": entry}).encode())
    result = fundraising_alert(archive, campaigns, fake)
    assert result.summary()["actions"] == {"alpha": "opened", "beta": "opened"}
    assert sorted(i["labels"][0] for i in fake.issues) == [
        "fundraising-failing-alpha",
        "fundraising-failing-beta",
    ]


def test_it_comments_at_most_once_a_day(campaigns, archive, fake):
    set_campaign(archive, **failed_read(Transient))
    fundraising_alert(archive, campaigns, fake)
    later = NOW + timedelta(hours=2)
    assert fundraising_alert(archive, campaigns, fake, later).campaigns["alpha"].action == "waiting"
    fake.now = NOW + timedelta(hours=25)
    result = fundraising_alert(archive, campaigns, fake, fake.now)
    assert result.campaigns["alpha"].action == "commented"
    assert len(fake.comments[1]) == 1 and len(fake.issues) == 1


def test_a_campaigns_recovery_comments_and_closes(campaigns, archive, fake):
    set_campaign(archive, **failed_read(Transient))
    fundraising_alert(archive, campaigns, fake)
    set_campaign(archive, **healthy(last_success_at=iso(NOW + timedelta(hours=1))))
    result = fundraising_alert(archive, campaigns, fake, NOW + timedelta(hours=1))
    assert result.campaigns["alpha"].action == "closed"
    assert fake.issues[0]["state"] == "closed"
    assert fake.comments[1][-1]["body"].startswith("Recovered at 2026-10-17T13:00:00Z")


def test_marking_a_campaign_finished_closes_its_issue(campaigns, archive, fake):
    set_campaign(archive, **failed_read(Transient))
    fundraising_alert(archive, campaigns, fake)
    (campaigns / "data/running/owner/campaigns.yaml").write_text(
        BRIGHTON % ", finished: true", encoding="utf-8"
    )
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "closed"
    assert "marked finished" in fake.comments[1][-1]["body"]


def test_a_campaign_leaving_the_list_closes_its_issue(campaigns, archive, fake):
    set_campaign(archive, **failed_read(Transient))
    fundraising_alert(archive, campaigns, fake)
    (campaigns / "data/running/owner/campaigns.yaml").write_text(OTHER, encoding="utf-8")
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "closed"
    assert "left campaigns.yaml" in fake.comments[1][-1]["body"]


def test_a_finished_campaign_never_opens_an_issue(campaigns, archive, fake):
    (campaigns / "data/running/owner/campaigns.yaml").write_text(
        BRIGHTON % ", finished: true", encoding="utf-8"
    )
    set_campaign(archive, **failed_read(PageNotFound))
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "none"
    assert fake.issues == []


def test_both_alerts_open_together_without_touching_each_other(campaigns, archive, github, fake):
    set_status(archive, **failing(AuthRejected))
    set_campaign(archive, **failed_read(Transient))
    assert alert(archive, github).action == "opened"
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "opened"
    assert [i["labels"] for i in fake.issues] == [[LABEL], [ALPHA_LABEL]]

    # Running recovers; fundraising's issue stays open, and the reverse.
    set_status(archive, last_success_at=iso(NOW), outcome="ok", consecutive_failures=0)
    assert alert(archive, github).action == "closed"
    assert fake.issues[1]["state"] == "open"
    fake.issues[0]["state"] = "open"
    set_status(archive, **failing(AuthRejected))
    set_campaign(archive, **healthy())
    assert fundraising_alert(archive, campaigns, fake).campaigns["alpha"].action == "closed"
    assert fake.issues[0]["state"] == "open"


def test_a_github_failure_exits_1(campaigns, archive, fake):
    set_campaign(archive, **failed_read(Transient))
    fake.fail_with = 500
    result = fundraising_alert(archive, campaigns, fake)
    assert (result.exit_code, result.code) == (1, "github_unavailable")


def test_an_unreadable_state_opens_each_active_campaigns_issue_at_once_and_exits_14(
    campaigns, archive, fake
):
    # Every read fails until the file is fixed, and the read's step can't turn the run red, so
    # without this the figures would go stale with no alert at all (FR-006, T108).
    (campaigns / "data/running/owner/campaigns.yaml").write_text(
        BRIGHTON % "" + OTHER.replace("beta }", "beta, finished: true }"), encoding="utf-8"
    )
    archive.put(FUNDRAISING_STATE, b"{not json")
    result = fundraising_alert(archive, campaigns, fake)
    assert (result.exit_code, result.code) == (14, "archive_unavailable")
    assert result.summary()["actions"] == {"alpha": "opened", "beta": "none"}
    body = fake.issues[0]["body"]
    assert "`StateCorrupt` (code `archive_unavailable`)" in body
    assert StateCorrupt.action in body and "state/fundraising.json is not valid JSON" in body


def test_an_archive_outage_opens_nothing_and_exits_14(campaigns, archive, fake, monkeypatch):
    def outage(key):
        raise ArchiveUnavailable("R2 get failed")

    monkeypatch.setattr(archive, "get", outage)
    result = fundraising_alert(archive, campaigns, fake)
    assert result.exit_code == 14 and result.campaigns == {} and fake.issues == []


def test_an_invalid_campaigns_file_exits_20(campaigns, archive, fake):
    (campaigns / "data/running/owner/campaigns.yaml").write_text("- { id: alpha }\n")
    assert fundraising_alert(archive, campaigns, fake).exit_code == 20


def test_secrets_in_a_fundraising_message_are_scrubbed(campaigns, archive, fake, monkeypatch):
    monkeypatch.setenv("JUSTGIVING_SUBSCRIPTION_KEY", "super-secret-key-value")
    set_campaign(archive, **failed_read(Transient, message="key super-secret-key-value"))
    fundraising_alert(archive, campaigns, fake)
    assert "super-secret-key-value" not in fake.issues[0]["body"]


@pytest.mark.parametrize(
    "code",
    [
        "justgiving_key_rejected",
        "justgiving_quota",
        "justgiving_forbidden",
        "page_not_found",
        "justgiving_changed",
        "suspect_figures",
        "page_not_active",
        "figures_unpublished",
        "rate_limited",
        "transient",
    ],
)
def test_failure_class_finds_every_fundraising_code(code):
    cls = failure_class(code)
    assert cls is not None and cls.code == code and cls.action and cls.likely_cause
