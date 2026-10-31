"""Failed-refresh alerts (T065; FR-010, SC-012; contracts/pipeline.md "Alert contract").

``sync_issue`` is the open, comment and close logic, shared with ``fundraising/alerts.py``, which
keeps one issue per campaign. ``run_alert`` reads ``state/fetch-status.json`` and keeps one GitHub
issue, labelled ``ingest-failing``, in step with it:

- **Failing** means the last successful fetch is more than 24 hours old (or there has never
  been one, and a failure is recorded). With no open issue, one is opened, titled
  ``intervals.icu refresh failing since <date>``. Its body gives the failure class and code, the
  last error (already scrubbed when it was recorded, and scrubbed again here), the likely cause,
  the action from the pipeline contract's table, a link to the run and the last good time.
- **Still failing**: at most one comment per 24 hours.
- **Recovered**: a "recovered at <time>" comment, then the issue is closed.

It talks to the GitHub REST API with the workflow's ``GITHUB_TOKEN`` (``issues: write``).
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

# The pipeline import registers every failure class (provider, archive, owner data, publish)
# as an IngestError subclass before failure_class looks one up.
import awingest.process.pipeline
import awingest.providers.justgiving.errors  # noqa: F401
from awingest.archive.base import RawArchive
from awingest.errors import IngestError
from awingest.logging import Logger, scrub
from awingest.state import FETCH_STATUS, StateDoc, parse_utc, utc_iso

LABEL = "ingest-failing"
LABEL_DESCRIPTION = "Running data refresh failing"
STALE_AFTER = timedelta(hours=24)
COMMENT_EVERY = timedelta(hours=24)
SOURCE_NAMES = {"intervals": "intervals.icu"}
USER_AGENT = "alexanderwebber.com-ingest-alerts (+https://alexanderwebber.com)"

Transport = Callable[[urllib.request.Request], tuple[int, bytes]]


class GitHubError(IngestError):
    code = "github_unavailable"
    exit_code = 1
    likely_cause = "The GitHub API refused or failed an issue request."
    action = "The agent checks the alert job's log and the workflow's issues: write permission."


def _urlopen(request: urllib.request.Request) -> tuple[int, bytes]:
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise GitHubError(f"GitHub API unreachable ({type(exc).__name__})") from None


class GitHubIssues:
    """The few issue endpoints the alert needs, for one repository and one label."""

    def __init__(
        self,
        token: str,
        repository: str,
        *,
        api_url: str = "https://api.github.com",
        transport: Transport = _urlopen,
        label: str = LABEL,
        label_description: str = LABEL_DESCRIPTION,
    ) -> None:
        self._token = token
        self._base = f"{api_url.rstrip('/')}/repos/{repository}"
        self._transport = transport
        self.label = label
        self._label_description = label_description

    @classmethod
    def from_env(
        cls, label: str = LABEL, label_description: str = LABEL_DESCRIPTION
    ) -> "GitHubIssues":
        token = os.environ.get("GITHUB_TOKEN", "")
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        if not token or not repository:
            raise GitHubError("GITHUB_TOKEN and GITHUB_REPOSITORY must be set")
        return cls(
            token,
            repository,
            api_url=os.environ.get("GITHUB_API_URL", "https://api.github.com"),
            label=label,
            label_description=label_description,
        )

    def request(
        self, method: str, path: str, body: Any = None, ok: tuple[int, ...] = (200, 201)
    ) -> Any:
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(
            self._base + path,
            data=data,
            method=method,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self._token}",
                "User-Agent": USER_AGENT,
                "X-GitHub-Api-Version": "2022-11-28",
                **({"Content-Type": "application/json"} if data is not None else {}),
            },
        )
        status, payload = self._transport(request)
        if status not in ok:
            raise GitHubError(f"GitHub API {method} {path.split('?')[0]} returned {status}")
        try:
            return json.loads(payload) if payload else None
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise GitHubError(f"GitHub API {method} returned non-JSON") from None

    def ensure_label(self) -> None:
        try:
            self.request("GET", f"/labels/{self.label}")
        except GitHubError:
            self.request(
                "POST",
                "/labels",
                {"name": self.label, "color": "d93f0b", "description": self._label_description},
            )

    def open_issue(self) -> dict[str, Any] | None:
        issues = self.request("GET", f"/issues?labels={self.label}&state=open&per_page=10")
        issues = [i for i in issues or [] if "pull_request" not in i]
        return min(issues, key=lambda i: i["number"]) if issues else None

    def comments_since(self, number: int, since: datetime) -> list[dict[str, Any]]:
        query = urllib.parse.urlencode({"since": utc_iso(since), "per_page": 1})
        return self.request("GET", f"/issues/{number}/comments?{query}") or []

    def create(self, title: str, body: str) -> dict[str, Any]:
        issue = {"title": title, "body": body, "labels": [self.label]}
        return self.request("POST", "/issues", issue)

    def comment(self, number: int, body: str) -> None:
        self.request("POST", f"/issues/{number}/comments", {"body": body})

    def close(self, number: int) -> None:
        self.request("PATCH", f"/issues/{number}", {"state": "closed", "state_reason": "completed"})


def failure_class(code: str | None) -> type[IngestError] | None:
    """The failure class with this ``code``, among every ``IngestError`` subclass."""
    if not code:
        return None
    pending = list(IngestError.__subclasses__())
    while pending:
        cls = pending.pop()
        if cls.__dict__.get("code") == code:
            return cls
        pending.extend(cls.__subclasses__())
    return None


@dataclass(frozen=True)
class Assessment:
    failing: bool
    last_success: datetime | None
    since: datetime | None


def assess(entry: dict[str, Any], now: datetime) -> Assessment:
    last_success = parse_utc(entry.get("last_success_at"))
    if last_success is not None:
        return Assessment(now - last_success > STALE_AFTER, last_success, last_success)
    attempt = parse_utc(entry.get("last_attempt_at"))
    failed = entry.get("outcome") == "failed"
    return Assessment(failed, None, attempt)


def _when(value: datetime | None) -> str:
    return utc_iso(value) if value else "never"


def issue_title(source: str, assessment: Assessment) -> str:
    since = assessment.since.date().isoformat() if assessment.since else "the first run"
    return f"{SOURCE_NAMES.get(source, source)} refresh failing since {since}"


def issue_body(
    source: str, entry: dict[str, Any], assessment: Assessment, run_url: str | None
) -> str:
    cls = failure_class(entry.get("code"))
    error_class = entry.get("error_class") or "none recorded"
    code = entry.get("code") or "none"
    if cls is None:
        cause = (
            "No failure is recorded, so the refresh may not be running at all (a disabled or "
            "failing workflow before the fetch step)."
        )
        action = "The agent checks the refresh workflow's recent runs."
    else:
        cause, action = cls.likely_cause, cls.action
    message = scrub(str(entry.get("message") or "none"))
    lines = [
        f"The {SOURCE_NAMES.get(source, source)} refresh has not succeeded for over 24 hours.",
        "",
        f"- **Failure class**: `{error_class}` (code `{code}`)",
        f"- **Last error**: {message}",
        f"- **Likely cause**: {cause}",
        f"- **Action**: {action}",
        f"- **Last good refresh**: {_when(assessment.last_success)}",
        f"- **Last attempt**: {entry.get('last_attempt_at') or 'unknown'}",
        f"- **Consecutive failures**: {entry.get('consecutive_failures', 0)}",
        f"- **Run**: {run_url or 'n/a'}",
        "",
        (
            "The site keeps showing the last good data (FR-007). This issue closes itself when "
            "a refresh succeeds."
        ),
    ]
    return "\n".join(lines)


def default_run_url() -> str | None:
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repository = os.environ.get("GITHUB_REPOSITORY")
    run = os.environ.get("GITHUB_RUN_ID")
    return f"{server}/{repository}/actions/runs/{run}" if repository and run else None


@dataclass
class AlertResult:
    action: str = "none"  # none | opened | commented | waiting | closed
    failing: bool = False
    issue: int | None = None
    exit_code: int = 0
    code: str | None = None

    def summary(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "failing": self.failing,
            "issue": self.issue,
            "exit_code": self.exit_code,
            "code": self.code,
        }


def sync_issue(
    github: GitHubIssues,
    result: AlertResult,
    *,
    failing: bool,
    title: str,
    body: str,
    closing: str,
    now: datetime,
) -> None:
    """Keeps one label's issue in step: opened when failing, a comment at most once a day while
    it lasts, and ``closing`` as the last comment when it ends."""
    result.failing = failing
    issue = github.open_issue()
    result.issue = issue["number"] if issue else None
    if failing and issue is None:
        github.ensure_label()
        created = github.create(title, body)
        result.action, result.issue = "opened", created.get("number")
    elif failing:
        opened = parse_utc(issue.get("created_at"))
        recent = github.comments_since(issue["number"], now - COMMENT_EVERY)
        if not recent and (opened is None or now - opened >= COMMENT_EVERY):
            github.comment(issue["number"], f"Still failing at {utc_iso(now)}.\n\n{body}")
            result.action = "commented"
        else:
            result.action = "waiting"
    elif issue is not None:
        github.comment(issue["number"], closing)
        github.close(issue["number"])
        result.action = "closed"


def run_alert(
    archive: RawArchive,
    github: GitHubIssues,
    *,
    log: Logger,
    source: str = "intervals",
    now: datetime | None = None,
    run_url: str | None = None,
) -> AlertResult:
    now = now or datetime.now(UTC)
    result = AlertResult()
    try:
        status = StateDoc(archive, FETCH_STATUS).value
        entry = status.get(source)
        entry = entry if isinstance(entry, dict) else {}
        assessment = assess(entry, now)
        sync_issue(
            github,
            result,
            failing=assessment.failing,
            title=issue_title(source, assessment),
            body=issue_body(source, entry, assessment, run_url),
            closing=f"Recovered at {_when(assessment.last_success)}: the last refresh succeeded.",
            now=now,
        )
    except IngestError as exc:
        log.error("alert_failed", exc=exc)
        result.exit_code, result.code = exc.exit_code, exc.code
    log.info("alert_finished", **result.summary())
    return result
