"""The allow-list: a page response becomes a ``FundraisingSnapshot``, field by field, and nothing
else is read (FR-010, FR-011). Pure, so fixtures test it without HTTP.

A figure that can't be read is a failed read, never a zero (FR-003), and the failure carries the
response's sorted key names and the field that failed, never a value: it reaches a public log.
"""

import json
import re
from decimal import Decimal, localcontext
from typing import Any

from awingest.providers.base import FundraisingSnapshot
from awingest.providers.justgiving.errors import JustGivingChanged

_MONEY = re.compile(r"[0-9]+(\.[0-9]+)?")
_COUNT = re.compile(r"[0-9]+")


def _failed(doc: dict[str, Any], name: str, problem: str) -> JustGivingChanged:
    keys = ", ".join(sorted(doc))
    return JustGivingChanged(f"field {name} {problem}; response keys: {keys}")


def _pence(doc: dict[str, Any], name: str, value: Any) -> int:
    """Strict money string to pence, in ``Decimal`` (never ``float``)."""
    if not isinstance(value, str) or not _MONEY.fullmatch(value):
        raise _failed(doc, name, "is not a money string")
    with localcontext() as context:
        context.prec = len(value) + 2  # exact, however long the string
        pence = Decimal(value) * 100
    if pence != pence.to_integral_value():
        raise _failed(doc, name, "has digits past the pence")
    return int(pence)


def _required(doc: dict[str, Any], name: str) -> Any:
    if name not in doc:
        raise _failed(doc, name, "is missing")
    return doc[name]


def parse_page(body: bytes) -> FundraisingSnapshot:
    try:
        doc = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise JustGivingChanged("the response is not JSON") from None
    if not isinstance(doc, dict):
        raise JustGivingChanged("the response is not a JSON object")
    if doc.get("errorMessage"):
        raise _failed(doc, "errorMessage", "is set on a successful response")

    if _required(doc, "currencyCode") != "GBP":
        raise _failed(doc, "currencyCode", "is not GBP")
    total = "grandTotalRaisedExcludingGiftAid"
    raised = _pence(doc, total, _required(doc, total))

    target_value = _required(doc, "fundraisingTarget")
    target = None if target_value in (None, "") else _pence(doc, "fundraisingTarget", target_value)

    count = _required(doc, "donationCount")
    if not isinstance(count, str) or not _COUNT.fullmatch(count):
        raise _failed(doc, "donationCount", "is not a string of digits")

    status = _required(doc, "status")
    if not isinstance(status, str) or not status:
        raise _failed(doc, "status", "is not a non-empty string")

    return FundraisingSnapshot(
        raised_pence=raised,
        target_pence=target or None,  # a target of zero pence means no target
        supporters=int(count),
        page_status=status,
    )
