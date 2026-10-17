"""Throwaway (Principle I): checks the Phase 2e adapter against the owner's real intervals.icu data.

Run by a throwaway branch workflow after ``awingest backfill --archive local`` has filled a
runner-local archive. It normalises every archived activity and wellness day and prints
**aggregates only** (counts, key names, rounded medians of metrics that are public by intent),
never IDs, times, dates, coordinates or free text, because Actions logs may become public.

    uv run --project ingest python spikes/intervals/adapter_check.py <archive-dir>
"""

import json
import math
import statistics
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from awingest.archive.local import LocalArchive
from awingest.providers.base import ActivityRef, RawBundle, RawHealthDay, UnsupportedActivity
from awingest.providers.intervals import IntervalsProvider
from awingest.providers.intervals.normalise import start_local

DETAIL_KEYS = [
    "start_date_local", "start_date", "timezone", "distance", "moving_time", "elapsed_time",
    "total_elevation_gain", "total_elevation_loss", "average_heartrate", "max_heartrate",
    "average_cadence", "average_stride", "average_stance_time", "average_stance_time_balance",
    "average_vertical_oscillation", "average_vertical_ratio", "device_watts", "icu_average_watts",
    "icu_training_load", "icu_hr_zone_times", "race", "trainer",
]


def median(values: list[float], digits: int = 1) -> float | None:
    values = [v for v in values if v is not None]
    return round(statistics.median(values), digits) if values else None


def main() -> int:
    archive = LocalArchive(Path(sys.argv[1]))
    provider = IntervalsProvider()
    report: dict = {}

    groups: dict[str, dict[str, bytes]] = {}
    for obj in archive.list("raw/intervals/activities/"):
        _, _, _, aid, name = obj.key.split("/")
        groups.setdefault(aid, {})[name] = archive.get(obj.key)
    report["activities_archived"] = len(groups)
    report["part_counts"] = Counter(n for parts in groups.values() for n in parts)

    key_present: Counter = Counter()
    start_forms: Counter = Counter()
    stream_types: Counter = Counter()
    latlng_shape: Counter = Counter()
    tah_shape: Counter = Counter()
    fit_magic: Counter = Counter()
    zone_lengths: Counter = Counter()
    outcomes: Counter = Counter()
    errors: Counter = Counter()
    metrics: dict[str, list] = {k: [] for k in (
        "avg_cadence", "sample_cadence", "avg_stride_m", "gct_ms", "gct_balance_pct",
        "vert_osc_mm", "vert_ratio_pct", "avg_power_w", "avg_hr", "speed_mps")}
    none_rates: Counter = Counter()
    split_mismatch = 0
    split_dist_diff: list[float] = []
    stream_vs_summary: list[float] = []
    types: Counter = Counter()
    years: Counter = Counter()

    for parts in groups.values():
        detail = json.loads(parts["detail.json"])
        key_present.update(k for k in DETAIL_KEYS if detail.get(k) not in (None, "", []))
        raw_start = str(detail.get("start_date_local", ""))
        start_forms["aware" if raw_start.endswith("Z") or "+" in raw_start[10:] else "naive"] += 1
        if isinstance(detail.get("icu_hr_zone_times"), list):
            zone_lengths[len(detail["icu_hr_zone_times"])] += 1
        for stream in json.loads(parts.get("streams.json", b"[]")):
            stream_types[stream.get("type")] += 1
            if stream.get("type") == "latlng":
                data = stream.get("data") or []
                first = next((x for x in data if x is not None), None)
                latlng_shape[f"data2={'data2' in stream} first={type(first).__name__}"] += 1
                if isinstance(first, (int, float)):
                    latlng_shape[f"data_in_lat_range={-90 <= first <= 90}"] += 1
        if "time-at-hr.json" in parts:
            tah = json.loads(parts["time-at-hr.json"])
            tah_shape[f"{type(tah).__name__}:{','.join(sorted(tah)) if isinstance(tah, dict) else ''}"] += 1
        if "activity.fit" in parts:
            data = parts["activity.fit"]
            kind = "gzip" if data[:2] == b"\x1f\x8b" else ("fit" if data[8:12] == b".FIT" else "other")
            fit_magic[kind] += 1

        marker = json.loads(parts["fetch.json"])
        ref = ActivityRef(provider_id=detail["id"], start_local=start_local(detail), row_hash=marker["row_hash"])
        bundle = RawBundle(ref=ref, parts={k: v for k, v in parts.items() if k != "fetch.json"})
        try:
            run = provider.normalise_activity(bundle)
        except UnsupportedActivity:
            outcomes["unsupported"] += 1
            continue
        except Exception as exc:  # noqa: BLE001 - a spike report
            outcomes["error"] += 1
            errors[f"{type(exc).__name__}: {exc}"] += 1
            continue
        outcomes["ok"] += 1
        types[f"{run.type}{'+treadmill' if run.treadmill else ''}{'+race' if run.is_race_flag else ''}"] += 1
        years[run.start_local.year] += 1
        for name in ("elevation_gain_m", "elevation_loss_m", "avg_hr", "max_hr", "avg_cadence",
                     "avg_stride_m", "avg_power_w", "training_load", "dynamics"):
            if getattr(run, name) is None:
                none_rates[name] += 1
        if not run.splits:
            none_rates["splits"] += 1
        if not run.hr_zones:
            none_rates["hr_zones"] += 1
        if not run.samples:
            none_rates["samples"] += 1
        metrics["avg_cadence"].append(run.avg_cadence)
        metrics["sample_cadence"].append(median([s.cadence for s in run.samples if s.cadence]))
        metrics["avg_stride_m"].append(run.avg_stride_m)
        metrics["avg_power_w"].append(run.avg_power_w)
        metrics["avg_hr"].append(run.avg_hr)
        metrics["speed_mps"].append(median([s.speed_mps for s in run.samples if s.speed_mps], 2))
        if run.dynamics:
            for f in ("gct_ms", "gct_balance_pct", "vert_osc_mm", "vert_ratio_pct"):
                metrics[f].append(getattr(run.dynamics, f))
        if run.splits:
            stream_end = max((s.dist_m for s in run.samples if s.dist_m is not None), default=0)
            if len(run.splits) != math.ceil(stream_end / 1000 - 1e-9):
                split_mismatch += 1
            split_dist_diff.append(abs(sum(s.distance_m for s in run.splits) - stream_end))
            stream_vs_summary.append(abs(stream_end - run.distance_m))

    report["detail_key_present"] = dict(key_present)
    report["start_date_local_form"] = dict(start_forms)
    report["hr_zone_lengths"] = dict(zone_lengths)
    report["stream_types"] = dict(stream_types)
    report["latlng_shape"] = dict(latlng_shape)
    report["time_at_hr_shape"] = dict(tah_shape)
    report["fit_magic"] = dict(fit_magic)
    report["normalise_outcomes"] = dict(outcomes)
    report["normalise_errors"] = dict(errors)
    report["types"] = dict(types)
    report["years"] = dict(sorted(years.items()))
    report["none_counts"] = dict(none_rates)
    report["medians"] = {k: median(v) for k, v in metrics.items()}
    report["splits"] = {
        "count_mismatch": split_mismatch,
        "max_split_sum_vs_stream_m": round(max(split_dist_diff, default=0), 1),
        "median_stream_vs_summary_m": median(stream_vs_summary),
        "max_stream_vs_summary_m": round(max(stream_vs_summary, default=0), 1),
    }

    days = [o.key for o in archive.list("raw/intervals/wellness/")]
    keys: Counter = Counter()
    metric_counts: Counter = Counter()
    for key in days:
        payload = archive.get(key)
        keys.update(json.loads(payload))
        day = date.fromisoformat(key.rsplit("/", 1)[1].removesuffix(".json"))
        metric_counts.update(r.metric for r in provider.normalise_health(RawHealthDay(day=day, payload=payload)))
    report["wellness"] = {
        "days": len(days),
        "archived_keys": dict(keys),
        "readings": dict(metric_counts),
        "first_year": days[0].rsplit("/", 1)[1][:4] if days else None,
    }
    for key in ("state/cursor.json", "state/backfill.json", "state/fetch-status.json", "public/freshness.json"):
        report[f"exists:{key}"] = archive.exists(key)
    print(json.dumps(report, indent=1, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
