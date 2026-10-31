"""HTTP helpers shared by the provider clients: the project's User-Agent, the transport type and
its ``urllib`` implementation, and ``Retry-After`` parsing."""

import email.utils
import http.client
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version

from awingest.providers.base import Transient


def _version() -> str:
    try:
        return version("awingest")
    except PackageNotFoundError:
        return "0"


USER_AGENT = f"alexanderwebber.com-ingest/{_version()} (+https://alexanderwebber.com)"

# A response as the transport returns it: status, headers (lower-cased names), body.
Response = tuple[int, Mapping[str, str], bytes]
Transport = Callable[[urllib.request.Request], Response]


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs) -> None:
        return None


def urllib_transport(timeout: float, *, follow_redirects: bool = True) -> Transport:
    """A ``Transport`` over ``urllib`` with this timeout. ``urllib`` copies request headers to a
    redirect's target, so a client that sends its key in a custom header turns redirects off:
    the 3xx then comes back as a response for the client to classify."""
    opener = urllib.request.build_opener(*(() if follow_redirects else (_NoRedirect,)))

    def transport(request: urllib.request.Request) -> Response:
        try:
            with opener.open(request, timeout=timeout) as resp:
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

    return transport


def retry_after(value: str | None, now: datetime) -> float | None:
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
