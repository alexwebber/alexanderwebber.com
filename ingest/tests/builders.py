"""Builders for normalised activities with synthetic streams (processor tests), synthetic
FIT files (no position data; never a real recording), and a fake GitHub issues API (alert tests)."""

import json
import urllib.parse
from collections.abc import Sequence
from datetime import datetime
from zoneinfo import ZoneInfo

from garmin_fit_sdk import Encoder, Profile

from awingest.providers.base import Dynamics, HrZone, NormalisedActivity, Sample, Split

# The 23 Oct 2026 check values (T159): Garmin's boundaries and session time in each zone.
GARMIN_BOUNDS = (88, 105, 123, 140, 158, 175)
GARMIN_TIMES = (13.502, 2.001, 44.006, 1392.998, 1531.799, 0.0, 0.0)


def garmin_fit(
    bounds: Sequence[int] | None = GARMIN_BOUNDS,
    times: Sequence[float] | None = GARMIN_TIMES,
    *,
    reference: str = "session",
    laps: int = 1,
) -> bytes:
    """A minimal FIT activity file: a file_id, then ``time_in_zone`` messages for each lap and
    for the session (``reference``), as a Garmin watch writes them. ``None`` leaves a field out."""
    mesg = Profile["mesg_num"]
    encoder = Encoder()
    encoder.on_mesg(
        mesg["FILE_ID"],
        {"type": "activity", "manufacturer": "garmin", "time_created": 1_100_000_000},
    )
    zone: dict = {"hr_calc_type": "percent_max_hr", "max_heart_rate": 175}
    if bounds is not None:
        zone["hr_zone_high_boundary"] = list(bounds)
    if times is not None:
        zone["time_in_hr_zone"] = list(times)
    for i in range(laps):
        lap = {"reference_mesg": "lap", "reference_index": i, "time_in_hr_zone": [1.0] * 7}
        encoder.on_mesg(mesg["TIME_IN_ZONE"], lap | {"hr_zone_high_boundary": list(GARMIN_BOUNDS)})
    encoder.on_mesg(
        mesg["TIME_IN_ZONE"], {"reference_mesg": reference, "reference_index": 0} | zone
    )
    return encoder.close()


def garmin_zones(seconds: Sequence[float] = (600, 1800, 0, 0, 0)) -> tuple[HrZone, ...]:
    names = ("Warm Up", "Easy", "Aerobic", "Threshold", "Maximum")
    return tuple(
        HrZone(
            zone=k + 1,
            name=names[k],
            low_bpm=GARMIN_BOUNDS[k],
            high_bpm=GARMIN_BOUNDS[k + 1],
            seconds=seconds[k],
        )
        for k in range(5)
    )


LONDON = ZoneInfo("Europe/London")


def samples(segments: list[tuple[float, float]], step_s: float = 1.0, **extra) -> list[Sample]:
    """Samples every ``step_s`` seconds over ``[(metres, pace_s_per_km), ...]`` at even pace
    within each segment. ``extra`` sets constant values (e.g. ``hr=150``)."""
    out = [Sample(t_s=0.0, dist_m=0.0, speed_mps=1000 / segments[0][1], **extra)]
    t = d = 0.0
    for metres, pace in segments:
        speed = 1000 / pace
        end = d + metres
        while d < end - 1e-9:
            dt = min(step_s, (end - d) / speed)
            t += dt
            d = min(end, d + speed * dt)
            out.append(Sample(t_s=round(t, 6), dist_m=d, speed_mps=speed, **extra))
    return out


def activity(
    segments: list[tuple[float, float]] | None = None,
    *,
    start: datetime = datetime(2026, 10, 11, 7, 15, tzinfo=LONDON),
    step_s: float = 5.0,
    **fields,
) -> NormalisedActivity:
    points = tuple(samples(segments or [(8200, 300)], step_s, hr=150.0, cadence=170.0))
    distance = points[-1].dist_m
    elapsed = points[-1].t_s
    values = {
        "provider_id": "i90000042",
        "source": "intervals",
        "start_local": start,
        "type": "road",
        "treadmill": False,
        "is_race_flag": False,
        "distance_m": distance,
        "moving_s": elapsed,
        "elapsed_s": elapsed,
        "elevation_gain_m": 40.0,
        "elevation_loss_m": 38.0,
        "avg_hr": 150.0,
        "max_hr": 171.0,
        "avg_cadence": 170.0,
        "avg_stride_m": 1.12,
        "avg_power_w": 540.0,
        "training_load": 77.0,
        "dynamics": Dynamics(
            gct_ms=245.0, gct_balance_pct=50.2, vert_osc_mm=88.0, vert_ratio_pct=7.9
        ),
        "title_raw": "SENTINEL Hastings Running",
        "description_raw": "SENTINEL loop past the pier",
        "splits": (Split(km=1, distance_m=1000, time_s=300, avg_hr=150, elev_delta_m=2.0),),
        "hr_zones": garmin_zones(),
        "samples": points,
    }
    return NormalisedActivity(**(values | fields))


def _iso(when: datetime) -> str:
    return when.isoformat().replace("+00:00", "Z")


class FakeGitHub:
    """Just enough of the issues API: labels, issues, comments."""

    def __init__(self, now: datetime):
        self.labels: set[str] = set()
        self.issues: list[dict] = []
        self.comments: dict[int, list[dict]] = {}
        self.requests = []
        self.now = now
        self.fail_with: int | None = None

    def __call__(self, request):
        self.requests.append(request)
        if self.fail_with:
            return self.fail_with, b'{"message":"nope"}'
        url = urllib.parse.urlsplit(request.full_url)
        path = url.path.removeprefix("/repos/owner/repo")
        query = dict(urllib.parse.parse_qsl(url.query))
        body = json.loads(request.data) if request.data else None
        method = request.get_method()
        if path.startswith("/labels/"):
            return (200, b"{}") if path.split("/")[2] in self.labels else (404, b"{}")
        if path == "/labels" and method == "POST":
            self.labels.add(body["name"])
            return 201, json.dumps(body).encode()
        if path == "/issues" and method == "GET":
            found = [
                i for i in self.issues
                if i["state"] == query["state"] and query["labels"] in i["labels"]
            ]  # fmt: skip
            return 200, json.dumps(found).encode()
        if path == "/issues" and method == "POST":
            issue = {
                "number": len(self.issues) + 1,
                "title": body["title"],
                "body": body["body"],
                "labels": body["labels"],
                "state": "open",
                "created_at": _iso(self.now),
            }
            self.issues.append(issue)
            return 201, json.dumps(issue).encode()
        number = int(path.split("/")[2])
        if path.endswith("/comments") and method == "GET":
            since = datetime.fromisoformat(query["since"])
            found = [
                c for c in self.comments.get(number, [])
                if datetime.fromisoformat(c["created_at"]) >= since
            ]  # fmt: skip
            return 200, json.dumps(found).encode()
        if path.endswith("/comments"):
            comment = {"body": body["body"], "created_at": _iso(self.now)}
            self.comments.setdefault(number, []).append(comment)
            return 201, json.dumps(comment).encode()
        if method == "PATCH":
            issue = self.issues[number - 1]
            issue.update(state=body["state"], state_reason=body["state_reason"])
            return 200, json.dumps(issue).encode()
        return 404, b"{}"
