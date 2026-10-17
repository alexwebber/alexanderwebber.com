"""Spike 0 (intervals.icu coverage check). Throwaway, Principle I.

Calls the intervals.icu API with the owner's personal key and reports which fields it returns:
fill counts and date ranges only, never values. Raw responses go to spikes/intervals/out/
(gitignored) so the adapter can be designed from them; nothing from out/ is ever committed.

    python spikes/intervals/probe.py      # needs env INTERVALS_API_KEY; stdlib only
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

BASE = "https://intervals.icu/api/v1"
OUT = Path(__file__).parent / "out"
USER_AGENT = "alexanderwebber.com-ingest-spike/0.1 (+https://alexanderwebber.com)"
WELLNESS_FIELDS = ["weight", "bodyFat", "restingHR", "hrv", "hrvSDNN", "vo2max", "ctl", "atl",
                   "rampRate", "steps", "sleepSecs", "stress", "readiness", "spO2", "respiration"]
ACTIVITY_FIELDS = ["distance", "moving_time", "elapsed_time", "total_elevation_gain",
                   "average_heartrate", "max_heartrate", "average_cadence", "average_stride",
                   "average_vertical_oscillation", "average_vertical_ratio", "icu_average_watts",
                   "device_watts", "icu_training_load", "trimp", "icu_hr_zone_times",
                   "pace_zone_times", "gap", "race", "start_date_local", "device_name",
                   "stream_types", "interval_summary", "source", "file_type"]


def get(path: str, auth: str) -> tuple[int, object]:
    # Cloudflare in front of intervals.icu 403s urllib's default "Python-urllib/x.y" User-Agent.
    headers = {"Authorization": auth, "Accept": "*/*", "User-Agent": USER_AGENT}
    req = urllib.request.Request(BASE + path, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
            ctype = resp.headers.get("Content-Type", "")
            return resp.status, json.loads(body) if "json" in ctype else {"bytes": len(body), "type": ctype}
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read()[:300].decode(errors="replace")}


def save(name: str, payload: object) -> None:
    (OUT / "raw").mkdir(parents=True, exist_ok=True)
    (OUT / "raw" / f"{name}.json").write_text(json.dumps(payload, indent=1), encoding="utf-8")


def fill(rows: list[dict], fields: list[str], date_key: str) -> dict:
    report = {}
    for f in fields:
        dates = sorted(str(r.get(date_key, ""))[:10] for r in rows if r.get(f) not in (None, "", [], 0))
        report[f] = {"filled": len(dates), "of": len(rows), "from": dates[0] if dates else None,
                     "to": dates[-1] if dates else None}
    return report


def main() -> int:
    key = os.environ.get("INTERVALS_API_KEY")
    if not key:
        print("Set INTERVALS_API_KEY first.", file=sys.stderr)
        return 2
    auth = "Basic " + base64.b64encode(f"API_KEY:{key}".encode()).decode()
    today = date.today().isoformat()
    summary: dict = {"run_at": today}

    status, acts = get(f"/athlete/0/activities?oldest=2000-01-01&newest={today}", auth)
    summary["activities_status"] = status
    if status != 200:
        print(json.dumps(summary | {"detail": acts}, indent=1))
        return 1
    save("activities", acts)
    runs = [a for a in acts if "Run" in str(a.get("type", ""))]
    summary["activities"] = {"total": len(acts), "runs": len(runs),
                             "types": Counter(a.get("type") for a in acts).most_common(),
                             "sources": Counter(a.get("source") for a in acts).most_common(),
                             "run_fields": fill(runs, ACTIVITY_FIELDS, "start_date_local")}

    if runs:
        latest = max(runs, key=lambda a: a.get("start_date_local", ""))
        aid = latest["id"]
        detail_calls = {
            "detail": f"/activity/{aid}?intervals=true",
            "streams": f"/activity/{aid}/streams.json",
            "time_at_hr": f"/activity/{aid}/time-at-hr",
            "best_efforts": f"/activity/{aid}/best-efforts?stream=distance&distance=5000",
            "fit_file": f"/activity/{aid}/fit-file",
            "original_file": f"/activity/{aid}/file",
        }
        summary["latest_run"] = {"date": latest.get("start_date_local", "")[:10]}
        for name, path in detail_calls.items():
            status, body = get(path, auth)
            entry: dict = {"status": status}
            if name == "detail" and isinstance(body, dict):
                entry["non_null_keys"] = sorted(k for k, v in body.items() if v not in (None, "", []))
                entry["intervals"] = len(body.get("icu_intervals") or [])
            elif name == "streams" and isinstance(body, list):
                entry["types"] = sorted(s.get("type") for s in body)
            elif isinstance(body, dict) and "bytes" in body:
                entry |= body
            summary["latest_run"][name] = entry
            if isinstance(body, (dict, list)) and "bytes" not in body:
                save(f"run_{name}", body)

    status, well = get(f"/athlete/0/wellness?oldest=2000-01-01&newest={today}", auth)
    summary["wellness_status"] = status
    if status == 200:
        save("wellness", well)
        summary["wellness"] = {"days": len(well), "fields": fill(well, WELLNESS_FIELDS, "id")}

    status, curves = get("/athlete/0/pace-curves.json?type=Run&curves=all", auth)
    summary["pace_curves_status"] = status
    if status == 200:
        save("pace_curves", curves)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    print(json.dumps(summary, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
