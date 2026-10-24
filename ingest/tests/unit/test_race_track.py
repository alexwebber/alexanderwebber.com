"""Race tracks (T126 for T125; FR-014, FR-054, FR-058): only races get one, never treadmill runs,
``hide_map`` and un-designation remove it, trimming works, and tracks fit the schema's 1,000
points. Coordinates here are synthetic (open sea in the Gulf of Guinea), never a real route."""

import math

from builders import activity

from awingest.process.overrides import RaceLink
from awingest.process.race_track import (
    MAX_POINTS,
    build_track,
    douglas_peucker,
    simplify,
    track_ref,
    trim,
    wants_track,
)
from awingest.providers.base import Sample
from awingest.schemas import PACKAGE_REPO, SchemaSet

RUN = "2026-04-05-k3f7"
SCHEMAS = SchemaSet(PACKAGE_REPO / "schemas")
LAT0, LON0 = 0.5, 0.5
M_PER_DEG = math.pi / 180 * 6_371_000


def gps_samples(metres: float, step_m: float = 3.0, wiggle_m: float = 4.0) -> tuple[Sample, ...]:
    """A 1 Hz-like track heading north-east, with a small zig-zag so it doesn't simplify away."""
    out = []
    n = int(metres / step_m)
    for i in range(n + 1):
        d = i * step_m
        side = wiggle_m * math.sin(i / 3)
        north, east = d * 0.7 + side, d * 0.7 - side
        out.append(
            Sample(
                t_s=i * 1.0,
                dist_m=d,
                speed_mps=3.5,
                elev_m=20 + 5 * math.sin(d / 900),
                lat=LAT0 + north / M_PER_DEG,
                lon=LON0 + east / (M_PER_DEG * math.cos(math.radians(LAT0))),
            )
        )
    return tuple(out)


def race(**fields):
    return activity(is_race_flag=True, samples=gps_samples(5000), **fields)


def test_training_runs_never_get_a_track():
    assert wants_track(activity(), is_race=False, race=None) is False
    assert wants_track(race(), is_race=False, race=None) is False


def test_a_race_gets_a_schema_valid_track_with_its_bbox():
    run = race()
    assert wants_track(run, is_race=True, race=None) is True
    track = build_track(run, run_id=RUN)
    assert SCHEMAS.issues("published/race-track", track) == []
    lats = [p[0] for p in track["points"]]
    lons = [p[1] for p in track["points"]]
    assert track["bbox"] == [min(lats), min(lons), max(lats), max(lons)]
    assert track["points"][0][2] == 0 and track["points"][-1][2] == 4998.0
    assert (track["id"], track["trim_ends_m"], track["source"]) == (RUN, 0, "intervals")
    assert track_ref(RUN) == f"race-tracks/{RUN}"


def test_treadmill_runs_never_get_a_track_even_when_designated_a_race():
    treadmill = activity(type="indoor", treadmill=True, samples=gps_samples(3000))
    assert wants_track(treadmill, is_race=True, race=RaceLink(slug="x", designate="race")) is False
    indoor = activity(type="indoor", samples=gps_samples(3000))
    assert wants_track(indoor, is_race=True, race=None) is False


def test_hide_map_means_no_track():
    assert wants_track(race(), is_race=True, race=RaceLink(slug="x", hide_map=True)) is False
    assert wants_track(race(), is_race=True, race=RaceLink(slug="x")) is True


def test_trimming_drops_the_ends_and_keeps_the_race_distances():
    track = build_track(race(), run_id=RUN, trim_ends_m=200)
    assert track["trim_ends_m"] == 200
    dists = [p[2] for p in track["points"]]
    assert dists[0] >= 200 and dists[-1] <= 4998 - 200
    assert dists[0] < 210 and dists[-1] > 4998 - 210  # nothing more than asked for
    full = build_track(race(), run_id=RUN)
    assert track["bbox"] != full["bbox"]


def test_trimming_everything_or_no_gps_means_no_track():
    assert build_track(race(), run_id=RUN, trim_ends_m=2600) is None
    assert build_track(activity(is_race_flag=True), run_id=RUN) is None  # samples without fixes
    assert trim([], 100) == []


def test_a_one_hertz_marathon_simplifies_to_at_most_1000_points():
    marathon = activity(is_race_flag=True, samples=gps_samples(42195, step_m=3.2))
    assert len(marathon.samples) > 13_000
    track = build_track(marathon, run_id=RUN)
    assert 2 <= len(track["points"]) <= MAX_POINTS
    assert SCHEMAS.issues("published/race-track", track) == []
    assert track["points"][0][2] == 0 and track["points"][-1][2] >= 42190


def test_douglas_peucker_keeps_corners_and_drops_straight_points():
    # An L: east 100 m, then north 100 m, sampled every 10 m.
    xy = [(x, 0.0) for x in range(0, 101, 10)] + [(100.0, y) for y in range(10, 101, 10)]
    assert douglas_peucker(xy, 0.5) == [0, 10, 20]
    points = [(float(i), 0.0, float(i), None) for i in range(5)]
    assert simplify(points, max_points=2) == [points[0], points[-1]]


def test_missing_elevation_is_published_as_null():
    samples = tuple(
        Sample(t_s=s.t_s, dist_m=s.dist_m, lat=s.lat, lon=s.lon) for s in gps_samples(500)
    )
    track = build_track(activity(is_race_flag=True, samples=samples), run_id=RUN)
    assert all(p[3] is None for p in track["points"])
    assert SCHEMAS.issues("published/race-track", track) == []
