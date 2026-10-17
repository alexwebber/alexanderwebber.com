"""Command-line entry point (contracts/pipeline.md). JSON-lines logs go to stderr and a summary
of counts to stdout; the exit code is the failure class's (0 for ok or partial).

``fetch`` and ``backfill`` are wired here; ``process``, ``publish-check``, ``alert`` and
``reprocess`` arrive with the publish stage (T066).
"""

import argparse
import json
import os
import sys
from datetime import date

from awingest.archive.base import ArchiveError, RawArchive
from awingest.archive.local import LocalArchive
from awingest.archive.r2 import R2Archive
from awingest.backfill import run_backfill
from awingest.fetch import run_fetch
from awingest.logging import Logger
from awingest.providers.intervals import IntervalsProvider

LOCAL_ARCHIVE_ENV = "AWINGEST_ARCHIVE_DIR"
DEFAULT_LOCAL_ARCHIVE = ".archive"


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a YYYY-MM-DD date: {value!r}") from None


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
    with_archive(fetch)

    backfill = commands.add_parser("backfill", help="whole history, paced and resumable")
    backfill.add_argument("--from", dest="start", type=_date)
    backfill.add_argument("--resume", action="store_true")
    with_archive(backfill)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    log = Logger(args.command, provider=IntervalsProvider.name)
    window = (args.reimport_from, args.reimport_to) if args.command == "fetch" else (None, None)
    if window[1] and (not window[0] or window[0] > window[1]):
        log.error("bad_arguments", message="--reimport-to needs an earlier --reimport-from")
        return 2
    try:
        archive = _archive(args)
    except ArchiveError as exc:
        log.error("archive_unavailable", exc=exc)
        print(json.dumps({"outcome": "failed", "code": exc.code, "exit_code": exc.exit_code}))
        return exc.exit_code
    provider = IntervalsProvider()
    if args.command == "fetch":
        result = run_fetch(
            provider,
            archive,
            log=log,
            reimport_from=args.reimport_from,
            reimport_to=args.reimport_to,
            health_only=args.health_only,
        )
    else:
        result = run_backfill(provider, archive, log=log, start=args.start, resume=args.resume)
    print(json.dumps(result.summary(), sort_keys=True))
    return result.exit_code


if __name__ == "__main__":
    sys.exit(main())
