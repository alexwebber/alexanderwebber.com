"""Writes the synthetic intervals.icu fixtures in this folder (T077). Re-run after changing it:

    uv run python tests/fixtures/intervals/make_fixtures.py

Shaped from the Spike 0 payloads (field names and structure only); **every value is invented**.
The privacy tests look for the sentinels: ``SENTINEL`` in free text, the ``i9000000x`` activity
IDs, the ``garmin_sentinel_`` external IDs, start times and the latitudes/longitudes near
``SENTINEL_LAT``/``SENTINEL_LON``.
"""

import json
import math
from pathlib import Path

HERE = Path(__file__).parent
STEP_S = 10
SENTINEL_LAT = 51.1234567
SENTINEL_LON = -0.7654321

# name, id, type, start_date_local, distance km, pace s/km, extras
ACTIVITIES = [
    ("run-dynamics", "i90000001", "Run", "2026-10-11T07:15:00", 10.2, 300, {"dynamics": True}),
    ("run-basic", "i90000002", "Run", "2026-01-15T18:00:00", 6.4, 330, {}),
    (
        "treadmill",
        "i90000003",
        "VirtualRun",
        "2026-03-02T06:30:00",
        5.0,
        320,
        {"indoor": True, "calibrated": 0.96},
    ),
    ("race", "i90000004", "Run", "2026-04-05T09:00:00", 21.0975, 285, {"race": True}),
    ("trail", "i90000005", "TrailRun", "2026-06-20T08:45:00", 12.3, 390, {"hilly": True}),
    ("trainer-run", "i90000006", "Run", "2026-02-10T12:00:00", 4.0, 340, {"trainer": True}),
]
NON_RUN = ("weights", "i90000007", "WeightTraining", "2026-10-12T17:30:00")


def streams(distance_km: float, pace: float, extras: dict) -> list[dict]:
    """Synthetic streams. Cadence is strides per minute, as intervals.icu stores it."""
    total_s = int(distance_km * pace)
    times = list(range(0, total_s + 1, STEP_S))
    if times[-1] != total_s:
        times.append(total_s)
    speed = 1000 / pace
    dist, d = [], 0.0
    for i, t in enumerate(times):
        if i:
            dt = t - times[i - 1]
            d += dt * speed * (1 + 0.06 * math.sin(t / 97))
        dist.append(round(d, 1))
    # A calibrated treadmill run: the stream ends short of the corrected summary distance.
    scale = distance_km * 1000 * extras.get("calibrated", 1.0) / dist[-1]
    dist = [round(x * scale, 1) for x in dist]
    out = [
        {"type": "time", "data": times},
        {"type": "distance", "data": dist},
        {
            "type": "velocity_smooth",
            "data": [round(speed * (1 + 0.06 * math.sin(t / 97)), 3) for t in times],
        },
        {
            "type": "heartrate",
            "data": [None if i == 3 else 120 + min(40, t // 30) for i, t in enumerate(times)],
        },
        {"type": "cadence", "data": [80 + (t // 60) % 3 for t in times]},
        {"type": "respiration", "data": [30 for _ in times]},  # private; never normalised
    ]
    if not extras.get("indoor"):
        amp = 40 if extras.get("hilly") else 6
        out.append(
            {
                "type": "altitude",
                "data": [round(30 + amp * math.sin(t / 400), 1) for t in times],
            }
        )
        if not extras.get("trainer"):
            out.append(
                {
                    "type": "latlng",
                    "data": [round(SENTINEL_LAT + i * 0.00031, 7) for i in range(len(times))],
                    "data2": [round(SENTINEL_LON + i * 0.00017, 7) for i in range(len(times))],
                }
            )
    if extras.get("dynamics"):
        out.append({"type": "watts", "data": [250 + (t // 50) % 20 for t in times]})
        out.append(
            {
                "type": "stance_time_balance",
                "data": [49.6 + (i % 3) * 0.2 for i in range(len(times))],
            }
        )
    return out


def detail(
    name: str, aid: str, kind: str, start: str, km: float, pace: float, extras: dict
) -> dict:
    moving = int(km * pace)
    record = {
        "id": aid,
        "start_date_local": start,
        "type": kind,
        "name": f"SENTINEL {name} title",
        "description": "SENTINEL description: from 12 Example Road",
        "source": "GARMIN_CONNECT",
        "external_id": f"garmin_sentinel_{918273645 + int(aid[1:]) % 100}",
        "distance": round(km * 1000, 1),
        "moving_time": moving,
        "elapsed_time": moving + 42,
        "total_elevation_gain": 0
        if extras.get("indoor")
        else (310.5 if extras.get("hilly") else 41.0),
        "total_elevation_loss": 0
        if extras.get("indoor")
        else (305.0 if extras.get("hilly") else 39.5),
        "average_heartrate": 148,
        "max_heartrate": 171,
        "average_cadence": 81.5,  # strides/min (163 steps/min)
        "average_stride": 1.18,
        "icu_training_load": 64,
        "icu_hr_zone_times": [300, 900, 1200, 400, 60, 0, 0],
        "race": bool(extras.get("race")),
        "trainer": bool(extras.get("indoor") or extras.get("trainer")),
        "device_watts": bool(extras.get("dynamics")),
        "icu_average_watts": None,
        "average_stance_time": None,
        "average_vertical_oscillation": None,
        "average_vertical_ratio": None,
        "timezone": "Europe/London",
        "icu_intervals": [],
    }
    if extras.get("dynamics"):
        record |= {
            "average_stance_time": 241.5,
            "average_vertical_oscillation": 86.4,
            "average_vertical_ratio": 7.3,
            "average_step_length": 1.18,
        }
    if name == "run-basic":
        # Missing metrics arrive as null or 0 and must come out as None.
        record |= {"average_stride": None, "max_heartrate": 0, "icu_average_watts": 0}
    return record


def list_row(full: dict) -> dict:
    keep = [
        "id",
        "start_date_local",
        "type",
        "name",
        "description",
        "source",
        "external_id",
        "distance",
        "moving_time",
        "elapsed_time",
        "total_elevation_gain",
        "total_elevation_loss",
        "average_heartrate",
        "max_heartrate",
        "average_cadence",
        "average_stride",
        "icu_training_load",
        "race",
        "trainer",
        "device_watts",
        "timezone",
    ]
    return {k: full[k] for k in keep} | {"icu_average_watts": None}


def wellness() -> list[dict]:
    days = []
    for i in range(1, 8):
        day = f"2026-10-0{i}"
        days.append(
            {
                "id": day,
                "weight": round(95.2 - i * 0.1, 1),
                "bodyFat": 19.5 - i * 0.05,
                "restingHR": 52 + i % 2,
                "hrv": 61 + i,
                "hrvSDNN": None,
                "vo2max": 51.0,
                "ctl": 48.2 + i,
                "atl": 55.0 + i,
                "rampRate": 1.1,
                "sleepSecs": 26000 + i,
                "sleepScore": 80,
                "sleepQuality": 2,
                "steps": 12000 + i,
                "spO2": 96.0,
                "stress": None,
                "readiness": None,
                "comments": "SENTINEL wellness comment",
                "updated": f"{day}T07:00:00.000+00:00",
            }
        )
    # Weight and VO2 max not recorded (0 / null): no reading for those metrics.
    days[2] |= {"weight": 0, "bodyFat": None, "vo2max": None}
    # A day with only non-approved keys: nothing to archive, so it is dropped.
    days.append({"id": "2026-10-08", "sleepSecs": 27000, "steps": 9000, "spO2": 97.0})
    return days


ERRORS = {
    "401": {
        "status": 401,
        "headers": {"content-type": "application/json"},
        "body": '{"status":401,"error":"Unauthorized"}',
    },
    "403-json": {
        "status": 403,
        "headers": {"content-type": "application/json;charset=UTF-8"},
        "body": '{"status":403,"error":"Access denied"}',
    },
    "403-html": {
        "status": 403,
        "headers": {"content-type": "text/html; charset=UTF-8"},
        "body": "<!DOCTYPE html><html><head><title>Just a moment...</title></head>"
        "<body>Cloudflare challenge</body></html>",
    },
    "429": {
        "status": 429,
        "headers": {"content-type": "application/json", "retry-after": "120"},
        "body": '{"status":429,"error":"Too Many Requests"}',
    },
    "503": {"status": 503, "headers": {"content-type": "text/plain"}, "body": "unavailable"},
}


def write(path: Path, value: object, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, separators=(",", ":")) if compact else json.dumps(value, indent=2)
    path.write_text(text + "\n", encoding="utf-8")


def main() -> None:
    rows = []
    for name, aid, kind, start, km, pace, extras in ACTIVITIES:
        full = detail(name, aid, kind, start, km, pace, extras)
        write(HERE / "activities" / name / "detail.json", full)
        write(HERE / "activities" / name / "streams.json", streams(km, pace, extras), compact=True)
        if name != "run-basic":  # run-basic has no HR-time or FIT file: both answer 404
            write(
                HERE / "activities" / name / "time-at-hr.json",
                {"min_bpm": 100, "secs": [5, 10, 20]},
            )
        rows.append(list_row(full))
    name, aid, kind, start = NON_RUN
    rows.append(
        {
            "id": aid,
            "start_date_local": start,
            "type": kind,
            "name": "SENTINEL gym",
            "distance": None,
            "moving_time": 2400,
            "elapsed_time": 2500,
        }
    )
    write(HERE / "activities" / name / "detail.json", rows[-1])
    write(HERE / "activities.json", rows)
    write(HERE / "wellness.json", wellness())
    for code, response in ERRORS.items():
        write(HERE / "errors" / f"{code}.json", response)
    (HERE / "activity.fit").write_bytes(b"\x0e\x10\x00\x00\x00\x00\x00\x00.FITsynthetic-fit-bytes")


if __name__ == "__main__":
    main()
