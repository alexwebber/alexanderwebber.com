"""The JustGiving client (specs/002-fundraising/research.md R1): Blackbaud SKY API, *JustGiving
Consumer Public*. The website itself is never read: its terms ban scripted extraction.

The one path below is the adapter's only path template, so the API's donation operations can't be
reached (FR-011). The key is read at the moment of the call, so a missing key is recorded per
campaign and the alert can open, and it stays in the one request's headers: it is in no log, error,
``repr`` or stored object. Redirects aren't followed, because ``urllib`` would copy the key's header
to wherever one leads. The body is dropped once the snapshot is built.
"""

import os
import re
import time
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime

from awingest.providers.base import FundraisingSnapshot, RateLimited, Transient
from awingest.providers.http import USER_AGENT, Transport, retry_after, urllib_transport
from awingest.providers.justgiving.errors import (
    AccessDenied,
    JustGivingChanged,
    KeyRejected,
    PageNotFound,
    QuotaExhausted,
)
from awingest.providers.justgiving.parse import parse_page

BASE_URL = "https://api.sky.blackbaud.com/jg/consumer/app/consumer/v1/fundraising/pages"
PAGE_URL = re.compile(r"https://www\.justgiving\.com/(page)/([a-z0-9-]+)")
KEY_ENV = "JUSTGIVING_SUBSCRIPTION_KEY"
KEY_SHAPE = re.compile(r"[\x21-\x7e]+")  # a stored BOM or newline is a bad key, not a retry
REALM_ENV = "JUSTGIVING_REALM"  # local staging checks only; never set in a workflow
TIMEOUT_S = 20
RETRY_WAIT_S = 2.0
LONGEST_WAIT_S = 60
LABEL = "GET fundraising page"


class JustGivingProvider:
    """Implements ``FundraisingProvider``."""

    name = "justgiving"

    def __init__(
        self,
        *,
        transport: Transport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._transport = transport or urllib_transport(TIMEOUT_S, follow_redirects=False)
        self._sleep = sleep
        self._now = now

    def _get(self, url: str, headers: dict[str, str]) -> bytes:
        retried = waited = False
        while True:
            try:
                status, resp_headers, body = self._transport(
                    urllib.request.Request(url, headers=headers, method="GET")
                )
            except Transient:
                if retried:
                    raise
                retried = True
                self._sleep(RETRY_WAIT_S)
                continue
            except Exception as exc:  # noqa: BLE001 - a transport must never leak its errors
                raise Transient(f"{LABEL}: {type(exc).__name__}") from None
            if 200 <= status < 300:
                return body
            if status == 401:
                raise KeyRejected(f"{LABEL} returned 401")
            header = resp_headers.get("retry-after")
            if status == 403:
                if header is None:
                    raise AccessDenied(f"{LABEL} returned 403")
                raise QuotaExhausted(
                    f"{LABEL} returned 403 with Retry-After",
                    retry_after=retry_after(header, self._now()),
                )
            if status == 404:
                raise PageNotFound(f"{LABEL} returned 404")
            if status == 429:
                wait = retry_after(header, self._now())
                if wait is not None and wait <= LONGEST_WAIT_S and not waited:
                    waited = True
                    self._sleep(wait)
                    continue
                raise RateLimited(f"{LABEL} returned 429", retry_after=wait)
            if status >= 500:
                if retried:
                    raise Transient(f"{LABEL} returned {status}")
                retried = True
                self._sleep(RETRY_WAIT_S)
                continue
            raise JustGivingChanged(f"{LABEL} returned {status}")

    def read_page(self, page_url: str) -> FundraisingSnapshot:
        key = os.environ.get(KEY_ENV, "")
        if not key:
            raise KeyRejected(f"{KEY_ENV} is not set")
        if KEY_SHAPE.fullmatch(key) is None:
            raise KeyRejected(f"{KEY_ENV} holds a character a header can't carry")
        match = PAGE_URL.fullmatch(page_url)
        if match is None:
            raise PageNotFound("page_url is not a JustGiving page address")
        prefix, short_name = match.groups()
        headers = {
            "Bb-Api-Subscription-Key": key,
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }
        realm = os.environ.get(REALM_ENV)
        if realm:
            headers["JustGiving-Realm"] = realm
        return parse_page(self._get(f"{BASE_URL}/{prefix}/{short_name}", headers))
