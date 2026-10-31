"""Command-line entry point (T066; contracts/pipeline.md). JSON-lines logs go to stderr and a
summary of counts to stdout; the exit code is the failure class's (0 for ok or partial, 2 for
bad arguments).

- ``fetch``: intervals.icu -> raw archive.
- ``process [--all]``, ``reprocess --run RUN_ID``: raw archive -> ``data/running/published/``.
- ``publish-check``: validates the published tree and its manifest (no archive needed).
- ``alert``: keeps the ``ingest-failing`` issue in step with ``state/fetch-status.json``.
- ``fundraising-read``: JustGiving -> ``state/fundraising.json`` (allow-listed figures only).
- ``fundraising-publish``: ``state/fundraising.json`` -> ``data/running/published/fundraising/``.
- ``fundraising-alert``: keeps each campaign's issue in step with ``state/fundraising.json``.

The fundraising commands are dispatched before anything touches intervals.icu, and none of them
constructs ``IntervalsProvider``, so a Running fault can't reach them (FR-003).
"""

import argparse
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

from awingest.alerts import GitHubError, GitHubIssues, default_run_url, run_alert
from awingest.archive.base import ArchiveError, RawArchive
from awingest.archive.local import LocalArchive
from awingest.archive.r2 import R2Archive
from awingest.fetch import run_fetch
from awingest.fundraising.alerts import LABEL_DESCRIPTION, run_fundraising_alert
from awingest.fundraising.publish import run_fundraising_publish
from awingest.fundraising.read import run_fundraising_read
from awingest.logging import Logger
from awingest.process.pipeline import PUBLISHED, run_process
from awingest.providers.intervals import IntervalsProvider
from awingest.providers.justgiving import JustGivingProvider
from awingest.publish.manifest import check_published
from awingest.schemas import SchemaSet, find_repo_root

LOCAL_ARCHIVE_ENV = "AWINGEST_ARCHIVE_DIR"
DEFAULT_LOCAL_ARCHIVE = ".archive"
FUNDRAISING_COMMANDS = ("fundraising-read", "fundraising-publish", "fundraising-alert")


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a YYYY-MM-DD date: {value!r}") from None


def _run_id(value: str) -> str:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}-[a-z2-7]{4}", value):
        raise argparse.ArgumentTypeError(f"not a run ID (YYYY-MM-DD-xxxx): {value!r}")
    return value


def _archive(args: argparse.Namespace) -> RawArchive:
    if args.archive == "local":
        return LocalArchive(
            args.archive_dir or os.environ.get(LOCAL_ARCHIVE_ENV) or DEFAULT_LOCAL_ARCHIVE
        )
    return R2Archive.from_env()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="awingest")
    commands = parser.add_subparsers(dest="command", required=True)

    def with_archive(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("--archive", choices=("r2", "local"), default="r2")
        sub.add_argument(
            "--archive-dir",
            help=f"LocalArchive directory (default: ${LOCAL_ARCHIVE_ENV} or {DEFAULT_LOCAL_ARCHIVE})",
        )

    fetch = commands.add_parser("fetch", help="intervals.icu -> raw archive, incrementally")
    fetch.add_argument("--reimport-from", type=_date)
    fetch.add_argument("--reimport-to", type=_date)
    fetch.add_argument("--health-only", action="store_true")
    fetch.add_argument(
        "--missing-only",
        action="store_true",
        help="with --reimport-from: fetch only new or changed activities and parts missing from "
        "archived ones (e.g. after the adapter adds a part), not everything in the window",
    )
    with_archive(fetch)

    def with_repo(sub: argparse.ArgumentParser) -> None:
        sub.add_argument(
            "--repo-root",
            type=Path,
            help="the repository (holding schemas/ and data/); default: found from the cwd",
        )

    process = commands.add_parser("process", help="raw archive -> published JSON, incrementally")
    process.add_argument("--all", action="store_true", help="reprocess every run and series")
    with_archive(process)
    with_repo(process)

    reprocess = commands.add_parser("reprocess", help="re-run one published run")
    reprocess.add_argument("--run", required=True, type=_run_id, metavar="RUN_ID")
    with_archive(reprocess)
    with_repo(reprocess)

    check = commands.add_parser("publish-check", help="validate the published tree + manifest")
    with_repo(check)

    alert = commands.add_parser("alert", help="open, update or close the ingest-failing issue")
    with_archive(alert)

    for name, description in (
        ("fundraising-read", "JustGiving -> state/fundraising.json, allow-listed figures only"),
        ("fundraising-publish", "state/fundraising.json -> published campaign files"),
        ("fundraising-alert", "open, update or close each campaign's issue"),
    ):
        fundraising = commands.add_parser(name, help=description)
        with_archive(fundraising)
        with_repo(fundraising)
    return parser


def _publish_check(args: argparse.Namespace, log: Logger) -> int:
    root = args.repo_root or find_repo_root()
    problems = check_published(root / PUBLISHED, SchemaSet(root / "schemas"))
    for problem in problems:
        log.error("publish_invalid", problem=problem)
    print(json.dumps({"outcome": "failed" if problems else "ok", "problems": len(problems)}))
    return 20 if problems else 0


def _campaign_issues(label: str) -> GitHubIssues:
    return GitHubIssues.from_env(label=label, label_description=LABEL_DESCRIPTION)


def _fundraising(args: argparse.Namespace, archive: RawArchive, log: Logger) -> int:
    root = args.repo_root or find_repo_root()
    if args.command == "fundraising-read":
        result = run_fundraising_read(JustGivingProvider(), archive, repo_root=root, log=log)
    elif args.command == "fundraising-publish":
        result = run_fundraising_publish(archive, repo_root=root, log=log)
    else:
        result = run_fundraising_alert(
            archive, _campaign_issues, repo_root=root, log=log, run_url=default_run_url()
        )
    print(json.dumps(result.summary(), sort_keys=True))
    return result.exit_code


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    fundraising = args.command in FUNDRAISING_COMMANDS
    name = JustGivingProvider.name if fundraising else IntervalsProvider.name
    log = Logger(args.command, provider=name)
    if args.command == "publish-check":
        return _publish_check(args, log)
    window = (args.reimport_from, args.reimport_to) if args.command == "fetch" else (None, None)
    if window[1] and (not window[0] or window[0] > window[1]):
        log.error("bad_arguments", message="--reimport-to needs an earlier --reimport-from")
        return 2
    if args.command == "fetch" and args.missing_only and not window[0]:
        log.error("bad_arguments", message="--missing-only needs --reimport-from")
        return 2
    try:
        archive = _archive(args)
    except ArchiveError as exc:
        log.error("archive_unavailable", exc=exc)
        print(json.dumps({"outcome": "failed", "code": exc.code, "exit_code": exc.exit_code}))
        return exc.exit_code
    if fundraising:
        return _fundraising(args, archive, log)
    if args.command == "alert":
        try:
            github = GitHubIssues.from_env()
        except GitHubError as exc:
            log.error("alert_failed", exc=exc)
            print(json.dumps({"action": "none", "code": exc.code, "exit_code": exc.exit_code}))
            return exc.exit_code
        alert = run_alert(archive, github, log=log, run_url=default_run_url())
        print(json.dumps(alert.summary(), sort_keys=True))
        return alert.exit_code
    provider = IntervalsProvider()
    if args.command in ("process", "reprocess"):
        processed = run_process(
            provider,
            archive,
            repo_root=args.repo_root or find_repo_root(),
            log=log,
            all_runs=args.command == "process" and args.all,
            only_run=args.run if args.command == "reprocess" else None,
        )
        print(json.dumps(processed.summary(), sort_keys=True))
        return processed.exit_code
    result = run_fetch(
        provider,
        archive,
        log=log,
        reimport_from=args.reimport_from,
        reimport_to=args.reimport_to,
        health_only=args.health_only,
        missing_only=args.missing_only,
    )
    print(json.dumps(result.summary(), sort_keys=True))
    return result.exit_code


if __name__ == "__main__":
    sys.exit(main())
