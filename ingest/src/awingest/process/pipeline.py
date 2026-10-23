"""The process stage (T064; contracts/pipeline.md ``process``, ``reprocess``): raw archive ->
sanitised published JSON. It never calls the provider: it reads archived bundles and uses only
the adapter's pure ``normalise_*`` functions.

- **Incremental**: each run's ``input_hash`` covers its archived parts' ETags and the owner
  overrides for it (``OwnerInputs.run_hash``, which includes the goal distances); each health
  file's covers the wellness days it depends on and the exclusions in them. Unchanged hashes are
  skipped. Both hashes include ``PROCESSOR_VERSION``: bump it whenever the same archive and
  owner files would now publish something different (a new published field, an adapter or
  processor fix), and the next scheduled refresh reprocesses everything, with no manual step.
  Files whose output didn't change still produce no diff. ``--all`` redoes everything at once;
  ``reprocess --run`` redoes one run.
- **IDs**: new activities get a public run ID from the append-only map (``run_ids.py``), which is
  saved before the published tree is committed, so a published ID is always on record.
- **Hidden runs** are recorded in the manifest as hidden and their file is removed (FR-017).
- **All or nothing**: an owner file or a published document failing validation stops the run
  before the published tree is touched (exit 20). One activity the adapter can't normalise is
  logged and skipped (outcome ``partial``); its last good file stays.
- **Refresh record**: ``state/refresh.json`` is rewritten only when published data changed.

Activities are logged by public run ID only, never by provider ID.
"""

import json
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Protocol

from awingest.archive.base import ArchiveError, ObjectInfo, RawArchive
from awingest.errors import IngestError
from awingest.logging import Logger
from awingest.process import health
from awingest.process.overrides import OwnerInputs, load_owner
from awingest.process.run_ids import RunIdMap
from awingest.process.sanitise import Unpublishable, sanitise_run
from awingest.providers.base import (
    ActivityRef,
    NormalisedActivity,
    NormalisedHealthReading,
    ProviderChanged,
    RawBundle,
    RawHealthDay,
    UnsupportedActivity,
)
from awingest.publish.manifest import (
    MANIFEST,
    REFRESH,
    Manifest,
    health_path,
    input_hash,
    refresh_doc,
    run_path,
)
from awingest.publish.writer import PublishedWriter
from awingest.schemas import SchemaSet
from awingest.state import FETCH_STATUS, StateDoc, parse_utc, utc_iso

# Bump when unchanged inputs would now publish differently (see the module docstring).
# 2: runs carry the Garmin ``device`` (FR-077 attribution).
# 3: best efforts use timer time, leaving watch pauses out (owner, 2026-10-23).
PROCESSOR_VERSION = 3
MARKER = "fetch.json"
PUBLISHED = Path("data/running/published")
OWNER = Path("data/running/owner")


class UnknownRun(IngestError):
    code = "unknown_run"
    exit_code = 2
    likely_cause = "``reprocess --run`` named a run ID that has no archived activity."
    action = "Check the run ID (copy it from the run page URL)."


class ProcessorDataMissing(ArchiveError):
    code = "run_ids_missing"
    likely_cause = (
        "state/run-ids.json is missing from the archive although runs are published, so new "
        "IDs would replace every published one."
    )
    action = (
        "The agent restores state/run-ids.json (R2 object versions or the last backup) before "
        "the next process run. Nothing was published."
    )


class NormalisingProvider(Protocol):
    """What the processor needs from a provider: its name and its pure normalisers."""

    name: str

    def normalise_activity(self, bundle: RawBundle) -> NormalisedActivity: ...

    def normalise_health(self, raw: RawHealthDay) -> list[NormalisedHealthReading]: ...


@dataclass
class RunCounts:
    activities: int = 0
    written: int = 0
    unchanged: int = 0
    hidden: int = 0
    removed: int = 0
    skipped: int = 0
    failed: int = 0
    incomplete: int = 0
    new_ids: int = 0


@dataclass
class HealthCounts:
    days: int = 0
    written: int = 0
    unchanged: int = 0
    removed: int = 0


@dataclass
class ProcessResult:
    """What a run did, in counts only (printed on stdout; no IDs or values)."""

    runs: RunCounts = field(default_factory=RunCounts)
    health: HealthCounts = field(default_factory=HealthCounts)
    files: dict[str, int] = field(default_factory=lambda: {"added": 0, "changed": 0, "removed": 0})
    outcome: str = "ok"  # ok | partial | failed
    error_class: str | None = None
    code: str | None = None
    exit_code: int = 0

    def fail(self, exc: BaseException) -> None:
        self.outcome = "failed"
        self.error_class = type(exc).__name__
        self.code = exc.code if isinstance(exc, IngestError) else "unexpected"
        self.exit_code = exc.exit_code if isinstance(exc, IngestError) else 1

    def summary(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class _Context:
    provider: NormalisingProvider
    archive: RawArchive
    owner: OwnerInputs
    ids: RunIdMap
    writer: PublishedWriter
    old: Manifest
    new: Manifest
    log: Logger
    force: bool
    result: ProcessResult


# --- Runs ---


def group_activities(archive: RawArchive, prefix: str) -> dict[str, dict[str, ObjectInfo]]:
    """Archived activity parts by provider ID, then part name."""
    groups: dict[str, dict[str, ObjectInfo]] = defaultdict(dict)
    for info in archive.list(prefix):
        provider_id, _, name = info.key.removeprefix(prefix).partition("/")
        if provider_id and name and "/" not in name:
            groups[provider_id][name] = info
    return dict(groups)


def load_bundle(archive: RawArchive, prefix: str, provider_id: str, names: list[str]) -> RawBundle:
    base = f"{prefix}{provider_id}/"
    marker_data = archive.get(base + MARKER)
    try:
        marker = json.loads(marker_data) if marker_data is not None else None
        start = datetime.fromisoformat(marker["start_local"])
        row_hash = marker["row_hash"]
    except (TypeError, KeyError, ValueError, UnicodeDecodeError):
        raise ProviderChanged("an archived fetch.json marker is unreadable") from None
    parts = {}
    for name in names:
        if name == MARKER:
            continue
        data = archive.get(base + name)
        if data is None:
            raise ProviderChanged("an archived activity part disappeared while processing")
        parts[name] = data
    ref = ActivityRef(
        provider_id=provider_id,
        start_local=start,
        row_hash=row_hash,
        row=parts.get("summary.json", b""),
    )
    return RawBundle(ref=ref, parts=parts)


def _run_hash(ctx: _Context, run_id: str, objects: dict[str, ObjectInfo]) -> str:
    etags = {name: info.etag for name, info in objects.items()}
    return input_hash(
        {"processor": PROCESSOR_VERSION, "parts": etags, "owner": ctx.owner.run_hash(run_id)}
    )


def _drop(ctx: _Context, run_id: str | None) -> None:
    """Unpublish a run that is no longer publishable (e.g. its type stopped being a run)."""
    if run_id is not None and run_id in ctx.new.runs:
        ctx.writer.remove(run_path(run_id))
        del ctx.new.runs[run_id]
        ctx.result.runs.removed += 1


def process_activity(ctx: _Context, prefix: str, provider_id: str, objects: dict) -> None:
    counts = ctx.result.runs
    run_id = ctx.ids.get(provider_id)
    if run_id is not None and not ctx.force:
        entry = ctx.old.runs.get(run_id)
        current = entry and entry["input_hash"] == _run_hash(ctx, run_id, objects)
        if current and (entry.get("hidden") or ctx.writer.exists(entry["path"])):
            counts.unchanged += 1
            return

    try:
        bundle = load_bundle(ctx.archive, prefix, provider_id, sorted(objects))
        activity = ctx.provider.normalise_activity(bundle)
    except UnsupportedActivity:
        ctx.log.warning("activity_not_a_run", run_id=run_id)
        counts.skipped += 1
        _drop(ctx, run_id)
        return
    except ProviderChanged as exc:
        ctx.log.error("activity_failed", exc=exc, run_id=run_id)
        counts.failed += 1
        return

    if activity.distance_m < 1 or (activity.moving_s or activity.elapsed_s) <= 0:
        ctx.log.warning("activity_unpublishable", run_id=run_id, reason="no distance or duration")
        counts.skipped += 1
        _drop(ctx, run_id)
        return
    if run_id is None:
        run_id = ctx.ids.assign(provider_id, activity.start_local.date())
        counts.new_ids += 1
    elif run_id[:10] != activity.start_local.date().isoformat():
        # The start date was edited in intervals.icu. IDs are never reassigned and the gate
        # requires an ID to start with its run's date, so the run keeps its first date.
        ctx.log.warning("run_date_changed", run_id=run_id)

    path = run_path(run_id)
    entry_hash = _run_hash(ctx, run_id, objects)
    override = ctx.owner.override(run_id)
    if override.hide:
        ctx.writer.remove(path)
        ctx.new.runs[run_id] = {"input_hash": entry_hash, "hidden": True}
        counts.hidden += 1
        return
    try:
        doc = sanitise_run(
            activity,
            run_id=run_id,
            run_date=date.fromisoformat(run_id[:10]),
            override=override,
            race=ctx.owner.races.get(run_id),
            goal_distances=ctx.owner.goal_distances,
        )
    except Unpublishable:
        counts.skipped += 1
        _drop(ctx, run_id)
        return
    ctx.writer.write_json(path, doc, "published/run")  # PublishInvalid stops the whole run
    ctx.new.runs[run_id] = {"input_hash": entry_hash, "path": path}
    counts.written += 1


def process_runs(ctx: _Context, only_run: str | None) -> None:
    prefix = f"raw/{ctx.provider.name}/activities/"
    groups = group_activities(ctx.archive, prefix)
    if only_run is not None:
        provider_id = ctx.ids.provider_id(only_run)
        if provider_id is None or provider_id not in groups:
            raise UnknownRun(f"no archived activity for run {only_run}")
        groups = {provider_id: groups[provider_id]}
    for provider_id in sorted(groups):
        objects = groups[provider_id]
        ctx.result.runs.activities += 1
        if MARKER not in objects:
            ctx.result.runs.incomplete += 1  # still being fetched, or a fetch died part-way
            continue
        process_activity(ctx, prefix, provider_id, objects)


# --- Health ---


def process_health(ctx: _Context) -> None:
    counts = ctx.result.health
    prefix = f"raw/{ctx.provider.name}/wellness/"
    etags: dict[date, str] = {}
    for info in ctx.archive.list(prefix):
        try:
            etags[date.fromisoformat(info.key.removeprefix(prefix).removesuffix(".json"))] = (
                info.etag
            )
        except ValueError:
            continue
    counts.days = len(etags)
    last_day = max(etags, default=None)
    cache: dict[date, list[NormalisedHealthReading]] = {}

    def readings(start: date, end: date) -> list[NormalisedHealthReading]:
        out = []
        for day in sorted(d for d in etags if start <= d <= end):
            if day not in cache:
                data = ctx.archive.get(f"{prefix}{day.isoformat()}.json")
                cache[day] = (
                    [] if data is None else ctx.provider.normalise_health(RawHealthDay(day, data))
                )
            out.extend(cache[day])
        return out

    years = {d.year for d in etags}
    for series in health.SERIES:
        source = health.SERIES[series][0]
        known = {int(k.split("/")[1]) for k in ctx.old.health if k.startswith(series + "/")}
        for year in sorted(years | known):
            key = f"{series}/{year}"
            path = health_path(key)
            start, end = health.window_for_year(series, year)
            until = min(end, last_day) if last_day else end
            entry_hash = input_hash(
                {
                    "processor": PROCESSOR_VERSION,
                    "days": {d.isoformat(): e for d, e in etags.items() if start <= d <= end},
                    "until": until.isoformat(),
                    "excluded": ctx.owner.exclusion_hash(source, start, end),
                }
            )
            entry = ctx.old.health.get(key)
            if (
                not ctx.force
                and entry
                and entry["input_hash"] == entry_hash
                and ctx.writer.exists(entry["path"])
            ):
                counts.unchanged += 1
                continue
            daily = health.daily_values(readings(start, end), ctx.owner.exclusions)
            points = [
                p
                for p in health.series_points(daily, until=until).get(series, [])
                if p[0].year == year
            ]
            if points:
                ctx.writer.write_json(
                    path, health.series_doc(series, points), "published/health-series"
                )
                ctx.new.health[key] = {"input_hash": entry_hash, "path": path}
                counts.written += 1
            else:
                if key in ctx.new.health:
                    counts.removed += 1
                ctx.writer.remove(path)
                ctx.new.health.pop(key, None)


# --- The stage ---


def _last_success_at(archive: RawArchive, source: str, fallback: str) -> str:
    status = StateDoc(archive, FETCH_STATUS).value.get(source, {})
    when = parse_utc(status.get("last_success_at")) if isinstance(status, dict) else None
    return utc_iso(when) if when else fallback


def run_process(
    provider: NormalisingProvider,
    archive: RawArchive,
    *,
    repo_root: Path,
    log: Logger,
    now: datetime | None = None,
    all_runs: bool = False,
    only_run: str | None = None,
) -> ProcessResult:
    now = now or datetime.now(UTC)
    stamp = utc_iso(now)
    result = ProcessResult()
    log.info("process_started", all=all_runs, reprocess=only_run is not None)
    try:
        schemas = SchemaSet(repo_root / "schemas")
        owner = load_owner(repo_root / OWNER, schemas)
        ids = RunIdMap(archive)
        writer = PublishedWriter(repo_root / PUBLISHED, schemas)
        old = Manifest.load(writer)
        if ids.absent and old.runs:
            raise ProcessorDataMissing("state/run-ids.json is missing but runs are published")
        new = Manifest(runs=dict(old.runs), health=dict(old.health))
        ctx = _Context(
            provider=provider,
            archive=archive,
            owner=owner,
            ids=ids,
            writer=writer,
            old=old,
            new=new,
            log=log,
            force=all_runs or only_run is not None,
            result=result,
        )
        process_runs(ctx, only_run)
        if only_run is None:
            process_health(ctx)

        data_changed = bool(writer.commit_plan())
        if new.body() != old.body() or (data_changed and not writer.exists(MANIFEST)):
            writer.write_json(MANIFEST, new.doc(stamp), "published/manifest")
        has_data = bool(new.runs or new.health)
        if data_changed or (has_data and not writer.exists(REFRESH)):
            refresh = refresh_doc(
                changed_at=stamp, last_success_at=_last_success_at(archive, provider.name, stamp)
            )
            writer.write_json(REFRESH, refresh, "published/refresh")

        ids.save()  # IDs are on record before anything that uses them is committed
        diff = writer.commit()
        result.files = diff.counts()
    except IngestError as exc:
        result.fail(exc)
        log.error("process_failed", exc=exc)
    except Exception as exc:  # noqa: BLE001 - reported as an unexpected failure
        result.fail(exc)
        log.error("process_failed", exc=exc)
    else:
        result.outcome = "partial" if result.runs.failed else "ok"
    log.info("process_finished", **result.summary())
    return result
