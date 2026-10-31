"""Fundraising alerts (FR-006; specs/002-fundraising/contracts/pipeline.md, alert contract).

One issue per campaign, under its own label, ``fundraising-failing-<id>``, on the logic it shares
with ``ingest-failing``, which is a separate issue: either can be open without the other. A page
that can't be found or isn't active alerts at once, as does a campaign that has never been read;
anything else alerts after 24 hours. An issue closes on recovery, when its campaign is marked
finished, or when its campaign has left ``campaigns.yaml``.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from awingest.alerts import (
    STALE_AFTER,
    AlertResult,
    Assessment,
    GitHubError,
    GitHubIssues,
    failure_class,
    sync_issue,
)
from awingest.archive.base import ArchiveError, RawArchive
from awingest.errors import IngestError
from awingest.fundraising.campaigns import Campaign, load_campaigns
from awingest.logging import Logger, scrub
from awingest.process.overrides import OwnerDataInvalid
from awingest.providers.justgiving.errors import FiguresUnpublished, PageNotActive, PageNotFound
from awingest.schemas import SchemaSet
from awingest.state import FUNDRAISING_STATE, StateDoc, parse_utc, utc_iso

LABEL_PREFIX = "fundraising-failing-"
LABEL_DESCRIPTION = "Fundraising figures failing"
ACTIVE = "Active"


def label_for(campaign_id: str) -> str:
    return f"{LABEL_PREFIX}{campaign_id}"


def _not_active(entry: dict[str, Any]) -> bool:
    status = entry.get("page_status")
    return bool(status) and status != ACTIVE


def assess(entry: dict[str, Any], now: datetime) -> Assessment:
    last_success = parse_utc(entry.get("last_success_at"))
    first_unpublished = parse_utc(entry.get("first_unpublished_at"))
    never_read = not entry.get("latest") and entry.get("outcome") == "failed"
    failing = (
        entry.get("code") == PageNotFound.code
        or _not_active(entry)
        or never_read
        or (last_success is not None and now - last_success > STALE_AFTER)
        or (
            last_success is None
            and first_unpublished is not None
            and now - first_unpublished > STALE_AFTER
        )
    )
    since = last_success or first_unpublished or parse_utc(entry.get("last_attempt_at"))
    return Assessment(failing, last_success, since)


def _texts(entry: dict[str, Any]) -> tuple[str, str, str, str]:
    """Failure class, code, likely cause and action for the issue body."""
    code = entry.get("code")
    if not code and _not_active(entry):
        code = PageNotActive.code
    elif not code and entry.get("outcome") == "unpublished":
        code = FiguresUnpublished.code
    cls = failure_class(code)
    if cls is None:
        return (
            entry.get("error_class") or "none recorded",
            code or "none",
            "No failure is recorded, so the refresh may not be running at all.",
            "The agent checks the refresh workflow's recent runs.",
        )
    return entry.get("error_class") or cls.__name__, cls.code, cls.likely_cause, cls.action


def _title(campaign: Campaign, assessment: Assessment) -> str:
    since = assessment.since.date().isoformat() if assessment.since else "the first run"
    return f"{campaign.charity_name} fundraising figures failing since {since}"


def _body(
    campaign: Campaign, entry: dict[str, Any], assessment: Assessment, run_url: str | None
) -> str:
    error_class, code, cause, action = _texts(entry)
    message = scrub(str(entry.get("message") or "none"))
    last_good = utc_iso(assessment.last_success) if assessment.last_success else "never"
    lines = [
        f"The {campaign.charity_name} figures from JustGiving aren't reaching the site.",
        "",
        f"- **Failure class**: `{error_class}` (code `{code}`)",
        f"- **Last error**: {message}",
        f"- **Likely cause**: {cause}",
        f"- **Action**: {action}",
        f"- **Last good read**: {last_good}",
        f"- **Last attempt**: {entry.get('last_attempt_at') or 'unknown'}",
        f"- **Consecutive failures**: {entry.get('consecutive_failures', 0)}",
        f"- **Run**: {run_url or 'n/a'}",
        "",
        (
            "The site keeps showing the last good figures (FR-003). This issue closes itself when "
            "a read matches the site again."
        ),
    ]
    return "\n".join(lines)


@dataclass
class FundraisingAlertResult:
    campaigns: dict[str, AlertResult] = field(default_factory=dict)
    exit_code: int = 0
    code: str | None = None

    def fail(self, exc: IngestError) -> None:
        if self.exit_code == 0:
            self.exit_code, self.code = exc.exit_code, exc.code

    def summary(self) -> dict[str, Any]:
        return {
            "actions": {cid: result.action for cid, result in sorted(self.campaigns.items())},
            "code": self.code,
            "exit_code": self.exit_code,
        }


def _sync(
    github: GitHubIssues,
    campaign: Campaign | None,
    entry: dict[str, Any],
    run_url: str | None,
    now: datetime,
) -> AlertResult:
    result = AlertResult()
    if campaign is None or campaign.finished:
        reason = "has left campaigns.yaml" if campaign is None else "is marked finished"
        closing = f"Closed at {utc_iso(now)}: the campaign {reason}."
        sync_issue(github, result, failing=False, title="", body="", closing=closing, now=now)
        return result
    assessment = assess(entry, now)
    recovered = assessment.last_success or now
    sync_issue(
        github,
        result,
        failing=assessment.failing,
        title=_title(campaign, assessment),
        body=_body(campaign, entry, assessment, run_url),
        closing=f"Recovered at {utc_iso(recovered)}: the figures match JustGiving again.",
        now=now,
    )
    return result


def run_fundraising_alert(
    archive: RawArchive,
    issues_for: Callable[[str], GitHubIssues],
    *,
    repo_root: Path,
    log: Logger,
    now: datetime | None = None,
    run_url: str | None = None,
) -> FundraisingAlertResult:
    """``issues_for`` gives the issue client for a label."""
    now = now or datetime.now(UTC)
    result = FundraisingAlertResult()
    try:
        campaigns = {c.id: c for c in load_campaigns(repo_root, SchemaSet(repo_root / "schemas"))}
        state = StateDoc(archive, FUNDRAISING_STATE).value
    except (OwnerDataInvalid, ArchiveError) as exc:
        log.error("alert_failed", exc=exc)
        result.fail(exc)
        return result

    for campaign_id in sorted(campaigns.keys() | state.keys()):
        entry = state.get(campaign_id)
        entry = entry if isinstance(entry, dict) else {}
        try:
            result.campaigns[campaign_id] = _sync(
                issues_for(label_for(campaign_id)),
                campaigns.get(campaign_id),
                entry,
                run_url,
                now,
            )
        except GitHubError as exc:
            log.error("alert_failed", exc=exc, campaign=campaign_id)
            result.fail(exc)
    log.info("alert_finished", **result.summary())
    return result
