"""Structured JSON-lines logging on stderr (T046; constitution II(c)).

One JSON object per line, with ``ts``, ``level``, ``run_id``, ``stage``, ``provider`` and
``event``, plus ``error_class`` and ``code`` for failures. Logs from unattended runs end up in
GitHub Actions logs, so everything is scrubbed before it is written:

- secret values from the environment (``INTERVALS_API_KEY``, the R2 keys, API tokens), including
  the Basic-auth form of the intervals.icu key, and any ``Authorization`` header value;
- email addresses;
- provider activity IDs (intervals.icu ``i12345678``-style IDs and long numeric IDs such as
  Garmin's), which must never leave the private zone (data-model §3);
- the values of keys that hold secrets or provider IDs, whatever their content.

``run_id`` here is the pipeline run (the GitHub Actions run), not a public run ID.
"""

import base64
import json
import os
import re
import sys
import uuid
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, TextIO

from awingest.errors import IngestError

REDACTED = "[redacted]"

SECRET_ENV = (
    "INTERVALS_API_KEY",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_API_TOKEN",
    "GITHUB_TOKEN",
)

# Compared after lower-casing and dropping "_" and "-", so "provider_id" and "providerId" match.
_REDACT_KEYS = {
    "authorization",
    "apikey",
    "intervalsapikey",
    "password",
    "secret",
    "secretaccesskey",
    "accesskeyid",
    "token",
    "cookie",
    "setcookie",
    "email",
    "providerid",
    "activityid",
    "externalid",
    "icuid",
    "garminid",
    "stravaid",
}

_PATTERNS = (
    (re.compile(r"(?i)(authorization[\"']?\s*[:=]\s*[\"']?)[^\"',}\n]+"), rf"\g<1>{REDACTED}"),
    (re.compile(r"(?i)\b(basic|bearer)\s+[A-Za-z0-9+/=._~-]{8,}"), rf"\g<1> {REDACTED}"),
    (re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"), "[email]"),
    (re.compile(r"(?<![\w-])i\d{5,}\b"), "[activity-id]"),
    (re.compile(r"(?<![\w.-])\d{9,}\b"), "[activity-id]"),
)


def _secret_values() -> list[str]:
    values = []
    for name in SECRET_ENV:
        value = os.environ.get(name, "")
        if len(value) >= 4:
            values.append(value)
    key = os.environ.get("INTERVALS_API_KEY", "")
    if key:
        values.append(base64.b64encode(f"API_KEY:{key}".encode()).decode())
    # Longest first, so a value containing another is replaced whole.
    return sorted(values, key=len, reverse=True)


def scrub(text: str, secrets: list[str] | None = None) -> str:
    """Remove secrets, emails and provider IDs from a string."""
    for value in _secret_values() if secrets is None else secrets:
        text = text.replace(value, REDACTED)
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def _sensitive_key(key: str) -> bool:
    return re.sub(r"[_-]", "", key.lower()) in _REDACT_KEYS


def _clean(value: Any, secrets: list[str]) -> Any:
    if isinstance(value, str):
        return scrub(value, secrets)
    if isinstance(value, Mapping):
        return {
            scrub(str(k), secrets): REDACTED if _sensitive_key(str(k)) else _clean(v, secrets)
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_clean(v, secrets) for v in value]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return scrub(str(value), secrets)


def default_run_id() -> str:
    """The GitHub Actions run (with its attempt), or a random local ID."""
    run = os.environ.get("GITHUB_RUN_ID")
    if run:
        return f"{run}-{os.environ.get('GITHUB_RUN_ATTEMPT', '1')}"
    return f"local-{uuid.uuid4().hex[:12]}"


class Logger:
    """Writes scrubbed JSON lines for one pipeline stage."""

    def __init__(
        self,
        stage: str,
        *,
        provider: str | None = None,
        run_id: str | None = None,
        stream: TextIO | None = None,
    ) -> None:
        self.stage = stage
        self.provider = provider
        self.run_id = run_id or default_run_id()
        self._stream = stream

    def bind(self, *, stage: str | None = None, provider: str | None = None) -> "Logger":
        """The same run, with a different stage or provider."""
        return Logger(
            stage or self.stage,
            provider=provider if provider is not None else self.provider,
            run_id=self.run_id,
            stream=self._stream,
        )

    def log(self, level: str, event: str, **fields: Any) -> None:
        record: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "level": level,
            "run_id": self.run_id,
            "stage": self.stage,
            "provider": self.provider,
            "event": event,
        }
        # The standard fields are the pipeline's own; everything the caller passes is scrubbed.
        extra = _clean({k: v for k, v in fields.items() if k not in record}, _secret_values())
        stream = self._stream or sys.stderr
        stream.write(json.dumps(record | extra, default=str) + "\n")
        stream.flush()

    def info(self, event: str, **fields: Any) -> None:
        self.log("info", event, **fields)

    def warning(self, event: str, **fields: Any) -> None:
        self.log("warning", event, **fields)

    def error(self, event: str, *, exc: BaseException | None = None, **fields: Any) -> None:
        """Log a failure. Classified errors add their ``code``; any message is scrubbed."""
        if exc is not None:
            fields.setdefault("error_class", type(exc).__name__)
            fields.setdefault("code", exc.code if isinstance(exc, IngestError) else "unexpected")
            fields.setdefault("message", str(exc))
        self.log("error", event, **fields)
