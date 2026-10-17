"""Throwaway: lists recent runs with the average power the adapter computes, so the owner can
compare them with Garmin Connect. Prints date, type, distance, moving time and power only
(all public by intent); no IDs, start times, coordinates or free text.

    uv run --project ingest python spikes/intervals/power_check.py <archive-dir>
"""

import json
import sys
from pathlib import Path

from awingest.archive.local import LocalArchive
from awingest.providers.base import ActivityRef, RawBundle
from awingest.providers.intervals import IntervalsProvider
from awingest.providers.intervals.normalise import start_local

archive = LocalArchive(Path(sys.argv[1]))
groups: dict[str, dict[str, bytes]] = {}
for obj in archive.list("raw/intervals/activities/"):
    _, _, _, aid, name = obj.key.split("/")
    groups.setdefault(aid, {})[name] = archive.get(obj.key)
runs = []
for parts in groups.values():
    detail = json.loads(parts["detail.json"])
    ref = ActivityRef(provider_id=detail["id"], start_local=start_local(detail), row_hash="")
    run = IntervalsProvider().normalise_activity(
        RawBundle(ref=ref, parts={k: v for k, v in parts.items() if k != "fetch.json"})
    )
    if run.avg_power_w:
        runs.append(run)
runs.sort(key=lambda r: r.start_local, reverse=True)
for run in runs[:6]:
    m, s = divmod(int(run.moving_s), 60)
    kind = "treadmill" if run.treadmill else "outdoor"
    print(f"{run.start_local.date()}  {kind:9}  {run.distance_m / 1000:5.2f} km  {m}:{s:02d} moving  "
          f"avg power {run.avg_power_w:.0f} W")
