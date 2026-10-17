"""Shared pytest fixtures for the ingest tests."""

import json
import re
import urllib.parse
import urllib.request
from collections.abc import Callable
from pathlib import Path

import pytest

from awingest.providers.intervals import IntervalsProvider
from awingest.providers.intervals.client import IntervalsClient, Response

INTERVALS_FIXTURES = Path(__file__).parent / "fixtures" / "intervals"
TEST_KEY = "test-intervals-key-5f3a9c"


def _load(name: str):
    return json.loads((INTERVALS_FIXTURES / name).read_text(encoding="utf-8"))


def error_response(name: str) -> Response:
    spec = _load(f"errors/{name}.json")
    return spec["status"], spec["headers"], spec["body"].encode()


class FakeIntervalsApi:
    """A stand-in for the intervals.icu API, serving the synthetic fixtures (T077).

    It is the client's transport, so it sees every request exactly as sent. ``fail`` queues an
    error response for paths containing a fragment; ``rows`` and ``wellness`` can be edited to
    simulate changes in intervals.icu between runs.
    """

    def __init__(self) -> None:
        self.requests: list[urllib.request.Request] = []
        self.rows: list[dict] = _load("activities.json")
        self.wellness: list[dict] = _load("wellness.json")
        self.names = {
            row["id"]: path.parent.name
            for path in INTERVALS_FIXTURES.glob("activities/*/detail.json")
            for row in [_load(str(path.relative_to(INTERVALS_FIXTURES)))]
        }
        self._failures: list[tuple[str, Response, list[int]]] = []

    def fail(self, fragment: str, response: Response | str, times: int = 1) -> None:
        if isinstance(response, str):
            response = error_response(response)
        self._failures.append((fragment, response, [times]))

    def paths(self) -> list[str]:
        return [
            urllib.parse.urlsplit(r.full_url).path.removeprefix("/api/v1") for r in self.requests
        ]

    def __call__(self, request: urllib.request.Request) -> Response:
        self.requests.append(request)
        url = urllib.parse.urlsplit(request.full_url)
        path = url.path.removeprefix("/api/v1")
        query = dict(urllib.parse.parse_qsl(url.query))
        for fragment, response, left in self._failures:
            if fragment in path and left[0] > 0:
                left[0] -= 1
                return response
        ok = {"content-type": "application/json"}
        if path == "/athlete/0/activities":
            rows = [
                r
                for r in self.rows
                if query["oldest"] <= r["start_date_local"][:10] <= query["newest"]
            ]
            return 200, ok, json.dumps(rows).encode()
        if path == "/athlete/0/wellness":
            days = [d for d in self.wellness if query["oldest"] <= d["id"] <= query["newest"]]
            return 200, ok, json.dumps(days).encode()
        match = re.fullmatch(r"/activity/([^/]+)(/.*)?", path)
        if match and match.group(1) in self.names:
            folder = INTERVALS_FIXTURES / "activities" / self.names[match.group(1)]
            part = {
                None: "detail.json",
                "/streams.json": "streams.json",
                "/time-at-hr": "time-at-hr.json",
            }.get(match.group(2))
            if part and (folder / part).exists():
                if part == "detail.json":
                    # The detail reflects edits made to the list row.
                    detail = _load(str((folder / part).relative_to(INTERVALS_FIXTURES)))
                    row = next((r for r in self.rows if r["id"] == match.group(1)), {})
                    return 200, ok, json.dumps(detail | row).encode()
                return 200, ok, (folder / part).read_bytes()
            if match.group(2) == "/fit-file" and (folder / "time-at-hr.json").exists():
                fit = (INTERVALS_FIXTURES / "activity.fit").read_bytes()
                return 200, {"content-type": "application/octet-stream"}, fit
        return 404, ok, b'{"status":404,"error":"Not Found"}'


class FakeClock:
    """Monotonic time that only moves when the client sleeps."""

    def __init__(self) -> None:
        self.t = 1000.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.t += seconds


@pytest.fixture
def api() -> FakeIntervalsApi:
    return FakeIntervalsApi()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def make_client(api: FakeIntervalsApi, clock: FakeClock) -> Callable[..., IntervalsClient]:
    def make(**kwargs) -> IntervalsClient:
        options = {
            "transport": api,
            "sleep": clock.sleep,
            "monotonic": clock.monotonic,
            "jitter": lambda: 0.5,
        }
        return IntervalsClient(TEST_KEY, **(options | kwargs))

    return make


@pytest.fixture
def provider(make_client) -> IntervalsProvider:
    return IntervalsProvider(make_client)
