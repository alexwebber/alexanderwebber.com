"""The intervals.icu HTTP client (T051; contracts/provider-adapter.md, Rules 3, 5 and 6).

Standard-library ``urllib`` against ``https://intervals.icu/api/v1``, with HTTP Basic auth (user
``API_KEY``, password ``INTERVALS_API_KEY``) for the key's own athlete (``0``). The quirks of this
provider live here and nowhere else:

- **Every request sends the descriptive User-Agent.** Cloudflare in front of intervals.icu answers
  Python's default ``Python-urllib/x.y`` with a 403 HTML challenge (Spike 0).
- **403 with an HTML body is a bot block** (``ProviderForbidden``); 401, or 403 with any other
  body, is ``AuthRejected``.
- **Pacing**: at least ``min_interval`` seconds, plus jitter, between calls.

Paths are given as templates (``/activity/{id}``) and formatted here, so error messages name the
endpoint, never an activity ID, and the key is only ever in the ``Authorization`` header. No HTTP
or library exception escapes: everything maps to the failure taxonomy in ``providers/base.py``.
"""

import base64
import email.utils
import http.client
import json
import os
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version
from typing import Any

from awingest.providers.base import (
    AuthRejected,
    ProviderChanged,
    ProviderForbidden,
    RateLimited,
    Transient,
)

BASE_URL = "https://intervals.icu/api/v1"
ATHLETE = "0"  # the API key's own athlete
KEY_ENV = "INTERVALS_API_KEY"
TIMEOUT_S = 60


def _version() -> str:
    try:
        return version("awingest")
    except PackageNotFoundError:
        return "0"


USER_AGENT = f"alexanderwebber.com-ingest/{_version()} (+https://alexanderwebber.com)"

# A response as the transport returns it: status, headers (lower-cased names), body.
Response = tuple[int, Mapping[str, str], bytes]
Transport = Callable[[urllib.request.Request], Response]


class ResourceMissing(ProviderChanged):
    """A 404. Callers that treat a part as optional (a FIT file, HR time) catch this; anywhere
    else it means the API moved, so it stays a ``ProviderChanged``."""


def _urllib_transport(request: urllib.request.Request) -> Response:
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, headers, resp.read()
    except urllib.error.HTTPError as exc:
        headers = {k.lower(): v for k, v in (exc.headers or {}).items()}
        try:
            body = exc.read()
        except OSError:
            body = b""
        return exc.code, headers, body
    except (OSError, http.client.HTTPException) as exc:  # URLError, timeouts, resets
        reason = getattr(exc, "reason", exc)
        raise Transient(f"network error: {type(reason).__name__}") from None


def _retry_after(value: str | None, now: datetime) -> float | None:
    """Seconds from a ``Retry-After`` header (delta-seconds or an HTTP date)."""
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return float(value)
    try:
        when = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    return max(0.0, (when - now).total_seconds())


def _is_html(headers: Mapping[str, str], body: bytes) -> bool:
    if "html" in headers.get("content-type", "").lower():
        return True
    return body.lstrip()[:1] == b"<"


class IntervalsClient:
    """One authenticated, paced connection to the intervals.icu API."""

    def __init__(
        self,
        api_key: str,
        *,
        transport: Transport | None = None,
        min_interval: float = 1.0,
        max_jitter: float = 0.5,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
        jitter: Callable[[], float] = random.random,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
        retries: int = 2,
    ) -> None:
        if not api_key:
            raise AuthRejected(f"{KEY_ENV} is not set")
        token = base64.b64encode(f"API_KEY:{api_key}".encode()).decode()
        self._auth = f"Basic {token}"
        self._transport = transport or _urllib_transport
        self._min_interval = min_interval
        self._max_jitter = max_jitter
        self._sleep = sleep
        self._monotonic = monotonic
        self._jitter = jitter
        self._now = now
        self._retries = retries
        self._last_call: float | None = None
        self.calls = 0

    @classmethod
    def from_env(cls, **kwargs: Any) -> "IntervalsClient":
        return cls(os.environ.get(KEY_ENV, ""), **kwargs)

    def __repr__(self) -> str:
        return "IntervalsClient(<key hidden>)"

    def _pace(self) -> None:
        if self._last_call is not None:
            wait = self._min_interval + self._jitter() * self._max_jitter
            wait -= self._monotonic() - self._last_call
            if wait > 0:
                self._sleep(wait)
        self._last_call = self._monotonic()

    def _request(self, template: str, params: Mapping[str, str], query: Mapping[str, str]) -> bytes:
        path = template.format(**{k: urllib.parse.quote(v, safe="") for k, v in params.items()})
        url = BASE_URL + path
        if query:
            url += "?" + urllib.parse.urlencode(query)
        headers = {"Authorization": self._auth, "User-Agent": USER_AGENT, "Accept": "*/*"}
        label = f"GET {template}"
        attempt = 0
        while True:
            self._pace()
            self.calls += 1
            try:
                status, resp_headers, body = self._transport(
                    urllib.request.Request(url, headers=headers, method="GET")
                )
            except Transient:
                if attempt < self._retries:
                    attempt += 1
                    self._sleep(2.0**attempt)
                    continue
                raise
            except Exception as exc:  # noqa: BLE001 - a transport must never leak its errors
                raise Transient(f"{label}: {type(exc).__name__}") from None
            if 200 <= status < 300:
                return body
            if status == 401:
                raise AuthRejected(f"{label} returned 401")
            if status == 403:
                if _is_html(resp_headers, body):
                    raise ProviderForbidden(f"{label} returned 403 with an HTML body")
                raise AuthRejected(f"{label} returned 403")
            if status == 404:
                raise ResourceMissing(f"{label} returned 404")
            if status == 429:
                retry_after = _retry_after(resp_headers.get("retry-after"), self._now())
                # A short wait is cheaper than failing the run; anything longer is recorded
                # as rate_limited_until by the fetch stage and waited out between runs.
                if retry_after is not None and retry_after <= 60 and attempt < self._retries:
                    attempt += 1
                    self._sleep(retry_after)
                    continue
                raise RateLimited(f"{label} returned 429", retry_after=retry_after)
            if status >= 500 and attempt < self._retries:
                attempt += 1
                self._sleep(2.0**attempt)
                continue
            if status >= 500:
                raise Transient(f"{label} returned {status}")
            raise ProviderChanged(f"{label} returned {status}")

    def get_json(
        self, template: str, query: Mapping[str, str] | None = None, **params: str
    ) -> tuple[Any, bytes]:
        """The parsed JSON and the raw bytes (archived verbatim)."""
        body = self._request(template, params, query or {})
        try:
            return json.loads(body), body
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ProviderChanged(f"GET {template} returned a body that is not JSON") from None

    def get_bytes(
        self, template: str, query: Mapping[str, str] | None = None, **params: str
    ) -> bytes:
        return self._request(template, params, query or {})
