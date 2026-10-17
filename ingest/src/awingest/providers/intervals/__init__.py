"""The intervals.icu provider (contracts/provider-adapter.md): an official Garmin sync partner,
reached with the owner's personal API key. ``IntervalsProvider`` implements ``Provider``."""

from collections.abc import Callable, Iterable, Iterator
from contextlib import contextmanager
from datetime import date
from typing import Self

from awingest.providers.base import (
    APPROVED_HEALTH_METRICS,
    ActivityRef,
    NormalisedActivity,
    NormalisedHealthReading,
    RawBundle,
    RawHealthDay,
)
from awingest.providers.intervals import endpoints, normalise
from awingest.providers.intervals.client import IntervalsClient


class IntervalsProvider:
    name = "intervals"
    metrics = APPROVED_HEALTH_METRICS

    def __init__(self, client_factory: Callable[[], IntervalsClient] = IntervalsClient.from_env):
        self._client_factory = client_factory
        self._client: IntervalsClient | None = None

    @contextmanager
    def session(self) -> Iterator[Self]:
        self._client = self._client_factory()
        try:
            yield self
        finally:
            self._client = None

    @property
    def client(self) -> IntervalsClient:
        if self._client is None:
            raise RuntimeError("open a session() before calling the provider")
        return self._client

    def list_activities(self, oldest: date, newest: date) -> Iterable[ActivityRef]:
        return list(endpoints.list_activities(self.client, oldest, newest))

    def fetch_activity(self, ref: ActivityRef) -> RawBundle:
        return endpoints.fetch_activity(self.client, ref)

    def fetch_health(self, oldest: date, newest: date) -> Iterable[RawHealthDay]:
        return list(endpoints.fetch_health(self.client, oldest, newest))

    def normalise_activity(self, bundle: RawBundle) -> NormalisedActivity:
        return normalise.normalise_activity(bundle)

    def normalise_health(self, raw: RawHealthDay) -> list[NormalisedHealthReading]:
        return normalise.normalise_health(raw)
