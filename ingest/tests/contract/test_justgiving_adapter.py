"""The JustGiving adapter (specs/002-fundraising/contracts/provider-adapter.md, Tests), against
synthetic fixtures in the live shape."""

import http.server
import io
import json
import threading
import urllib.request
from pathlib import Path
from typing import ClassVar

import pytest
from conftest import JUSTGIVING_FIXTURES, TEST_JUSTGIVING_KEY

from awingest.alerts import failure_class
from awingest.logging import Logger, scrub
from awingest.providers.base import FundraisingProvider, RateLimited, Transient
from awingest.providers.http import USER_AGENT, urllib_transport
from awingest.providers.justgiving.client import BASE_URL
from awingest.providers.justgiving.errors import (
    AccessDenied,
    FiguresUnpublished,
    JustGivingChanged,
    KeyRejected,
    PageNotActive,
    PageNotFound,
    QuotaExhausted,
    SuspectFigures,
)
from awingest.providers.justgiving.parse import parse_page

PAGE_URL = "https://www.justgiving.com/page/example-runner-2027"
API_URL = f"{BASE_URL}/page/example-runner-2027"


def page(**changes) -> dict:
    return json.loads((JUSTGIVING_FIXTURES / "page.json").read_text(encoding="utf-8")) | changes


def body(**changes) -> bytes:
    return json.dumps(page(**changes)).encode()


def without(key: str) -> bytes:
    doc = page()
    del doc[key]
    return json.dumps(doc).encode()


# --- Shape ---


def test_the_fixture_has_the_live_shape():
    doc = page()
    assert len(doc) == 48
    assert "TargetAmount" not in doc
    assert isinstance(doc["grandTotalRaisedExcludingGiftAid"], str)


def test_the_provider_implements_the_protocol(justgiving):
    provider: FundraisingProvider = justgiving
    assert provider.name == "justgiving"


@pytest.mark.parametrize(
    ("raised", "pence"),
    [("500", 50000), ("1335.00", 133500), ("0", 0), ("12.5", 1250), ("0.01", 1)],
)
def test_money_strings_become_pence(raised, pence):
    assert parse_page(body(grandTotalRaisedExcludingGiftAid=raised)).raised_pence == pence


def test_a_normal_page():
    snapshot = parse_page((JUSTGIVING_FIXTURES / "page-pence.json").read_bytes())
    assert (snapshot.raised_pence, snapshot.target_pence, snapshot.supporters) == (
        133500,
        200000,
        42,
    )
    assert snapshot.page_status == "Active"


def test_a_closed_page_still_parses():
    snapshot = parse_page((JUSTGIVING_FIXTURES / "page-closed.json").read_bytes())
    assert snapshot.page_status == "Expired"


def test_target_amount_alone_does_not_count_as_a_target():
    doc = page(TargetAmount=500.0)
    del doc["fundraisingTarget"]
    with pytest.raises(JustGivingChanged, match="fundraisingTarget"):
        parse_page(json.dumps(doc).encode())


def test_digits_past_the_pence_must_be_zero():
    assert parse_page(body(grandTotalRaisedExcludingGiftAid="12.3400")).raised_pence == 1234
    with pytest.raises(JustGivingChanged, match="past the pence"):
        parse_page(body(grandTotalRaisedExcludingGiftAid="12.345"))
    with pytest.raises(JustGivingChanged, match="past the pence"):
        parse_page(body(grandTotalRaisedExcludingGiftAid="1." + "0" * 40 + "1"))


# --- Failed reads: never a zero ---


@pytest.mark.parametrize("value", ["", None, 500, 12.5, "£5", "1,335.00", "-1", "NaN", "1e3", " 5"])
def test_a_bad_total_is_a_failed_read(value):
    with pytest.raises(JustGivingChanged):
        parse_page(body(grandTotalRaisedExcludingGiftAid=value))


@pytest.mark.parametrize("value", [0, 500, "£5", "1,335.00", "-1", "NaN", "1e3"])
def test_a_bad_target_is_a_failed_read(value):
    with pytest.raises(JustGivingChanged):
        parse_page(body(fundraisingTarget=value))


@pytest.mark.parametrize("value", ["", None, 3, "3.0", "-1", "three"])
def test_a_bad_supporter_count_is_a_failed_read(value):
    with pytest.raises(JustGivingChanged):
        parse_page(body(donationCount=value))


@pytest.mark.parametrize(
    "key", ["grandTotalRaisedExcludingGiftAid", "fundraisingTarget", "donationCount"]
)
def test_a_missing_key_is_a_failed_read(key):
    with pytest.raises(JustGivingChanged, match=key):
        parse_page(without(key))


@pytest.mark.parametrize("key", ["currencyCode", "status"])
def test_the_checked_keys_are_required(key):
    with pytest.raises(JustGivingChanged, match=key):
        parse_page(without(key))


@pytest.mark.parametrize("raw", [b"not json", b"<html></html>", b"", b"\xff\xfe"])
def test_a_body_that_is_not_json_is_a_failed_read(raw):
    with pytest.raises(JustGivingChanged, match="not JSON"):
        parse_page(raw)


@pytest.mark.parametrize("raw", [b"[]", b"null", b"3", b'"page"'])
def test_a_body_that_is_not_an_object_is_a_failed_read(raw):
    with pytest.raises(JustGivingChanged, match="not a JSON object"):
        parse_page(raw)


def test_a_non_empty_error_message_on_a_200_is_a_failed_read():
    with pytest.raises(JustGivingChanged, match="errorMessage"):
        parse_page(body(errorMessage="Something went wrong"))
    assert parse_page(body(errorMessage="")).raised_pence == 0
    assert parse_page(body(errorMessage=None)).raised_pence == 0


@pytest.mark.parametrize("value", ["USD", "gbp", "", None])
def test_any_other_currency_is_a_failed_read(value):
    with pytest.raises(JustGivingChanged, match="currencyCode"):
        parse_page(body(currencyCode=value))


@pytest.mark.parametrize("value", ["", None, 1])
def test_a_status_must_be_a_non_empty_string(value):
    with pytest.raises(JustGivingChanged, match="status"):
        parse_page(body(status=value))


def test_a_parse_failure_gives_key_names_and_the_field_never_a_value():
    secret = "SENTINEL-value-in-a-bad-field"
    with pytest.raises(JustGivingChanged) as caught:
        parse_page(body(grandTotalRaisedExcludingGiftAid=secret))
    text = str(caught.value)
    assert secret not in text and "Sam Example" not in text
    assert "grandTotalRaisedExcludingGiftAid" in text and "ownerGuid" in text
    keys = text.split("response keys: ")[1].split(", ")
    assert keys == sorted(keys) and len(keys) == 48


# --- No target ---


@pytest.mark.parametrize("value", [None, "", "0", "0.00"])
def test_no_target(value):
    assert parse_page(body(fundraisingTarget=value)).target_pence is None


def test_the_no_target_fixture():
    snapshot = parse_page((JUSTGIVING_FIXTURES / "page-no-target.json").read_bytes())
    assert snapshot.target_pence is None


# --- Errors ---


def test_401_quotes_the_right_product(justgiving, justgiving_api):
    justgiving_api.respond(401, b'{"message":"invalid subscription key"}')
    with pytest.raises(KeyRejected) as caught:
        justgiving.read_page(PAGE_URL)
    assert caught.value.code == "justgiving_key_rejected" and caught.value.exit_code == 10
    assert "**JustGiving APIs**" in KeyRejected.action
    assert "**Standard APIs**" in KeyRejected.likely_cause
    assert len(justgiving_api.requests) == 1  # no retry loop


def test_a_missing_key_raises_when_reading_not_when_constructing(
    justgiving_api, monkeypatch, clock
):
    from awingest.providers.justgiving import JustGivingProvider

    monkeypatch.delenv("JUSTGIVING_SUBSCRIPTION_KEY", raising=False)
    provider = JustGivingProvider(transport=justgiving_api, sleep=clock.sleep)
    with pytest.raises(KeyRejected):
        provider.read_page(PAGE_URL)
    assert justgiving_api.requests == []


@pytest.mark.parametrize(
    "stored",
    ["﻿dummykey", "dummykey\n", "dummykey\r\n", "dummy key", "dummykéy"],
    ids=["bom", "lf", "crlf", "space", "accent"],
)
def test_a_key_stored_with_a_stray_character_is_a_bad_key_not_a_retry(
    justgiving_api, monkeypatch, clock, stored
):
    from awingest.providers.justgiving import JustGivingProvider

    monkeypatch.setenv("JUSTGIVING_SUBSCRIPTION_KEY", stored)
    provider = JustGivingProvider(transport=justgiving_api, sleep=clock.sleep)
    with pytest.raises(KeyRejected) as caught:
        provider.read_page(PAGE_URL)
    assert "dummy" not in str(caught.value)
    assert justgiving_api.requests == []


def test_403_with_retry_after_is_the_daily_quota(justgiving, justgiving_api):
    justgiving_api.respond(403, b"{}", {"retry-after": "3600"})
    with pytest.raises(QuotaExhausted) as caught:
        justgiving.read_page(PAGE_URL)
    assert caught.value.retry_after == 3600
    assert caught.value.code == "justgiving_quota" and caught.value.exit_code == 11
    assert isinstance(caught.value, RateLimited)


def test_403_without_retry_after_is_access_denied(justgiving, justgiving_api):
    justgiving_api.respond(403, b"<html>Forbidden</html>")
    with pytest.raises(AccessDenied) as caught:
        justgiving.read_page(PAGE_URL)
    assert caught.value.code == "justgiving_forbidden" and caught.value.exit_code == 12


def test_404_is_page_not_found(justgiving, justgiving_api):
    justgiving_api.respond(404, b"{}")
    with pytest.raises(PageNotFound) as caught:
        justgiving.read_page(PAGE_URL)
    assert caught.value.code == "page_not_found" and caught.value.exit_code == 15


def test_a_short_429_is_waited_out_once(justgiving, justgiving_api, clock):
    justgiving_api.respond(429, b"", {"retry-after": "5"})
    assert justgiving.read_page(PAGE_URL).page_status == "Active"
    assert clock.sleeps == [5.0] and len(justgiving_api.requests) == 2


def test_a_second_429_is_not_waited_for(justgiving, justgiving_api, clock):
    justgiving_api.respond(429, b"", {"retry-after": "5"})
    justgiving_api.respond(429, b"", {"retry-after": "5"})
    with pytest.raises(RateLimited) as caught:
        justgiving.read_page(PAGE_URL)
    assert caught.value.code == "rate_limited" and caught.value.retry_after == 5
    assert clock.sleeps == [5.0]


@pytest.mark.parametrize("headers", [{"retry-after": "61"}, {}])
def test_a_long_or_unknown_429_is_not_waited_for(justgiving, justgiving_api, clock, headers):
    justgiving_api.respond(429, b"", headers)
    with pytest.raises(RateLimited):
        justgiving.read_page(PAGE_URL)
    assert clock.sleeps == []


def test_a_5xx_is_retried_once_two_seconds_later(justgiving, justgiving_api, clock):
    justgiving_api.respond(503)
    assert justgiving.read_page(PAGE_URL).page_status == "Active"
    assert clock.sleeps == [2.0]


def test_a_second_5xx_is_transient(justgiving, justgiving_api, clock):
    justgiving_api.respond(500)
    justgiving_api.respond(502)
    with pytest.raises(Transient) as caught:
        justgiving.read_page(PAGE_URL)
    assert caught.value.code == "transient" and caught.value.exit_code == 1
    assert clock.sleeps == [2.0] and len(justgiving_api.requests) == 2


def test_a_network_error_is_retried_once(justgiving, justgiving_api, clock):
    justgiving_api.fail_with(Transient("network error: TimeoutError"))
    assert justgiving.read_page(PAGE_URL).page_status == "Active"
    assert clock.sleeps == [2.0]


def test_two_network_errors_are_transient(justgiving, justgiving_api):
    justgiving_api.fail_with(Transient("network error: TimeoutError"))
    justgiving_api.fail_with(Transient("network error: TimeoutError"))
    with pytest.raises(Transient):
        justgiving.read_page(PAGE_URL)


def test_a_transport_never_leaks_its_errors(justgiving, justgiving_api):
    justgiving_api.fail_with(ValueError("carrying a value"))
    with pytest.raises(Transient) as caught:
        justgiving.read_page(PAGE_URL)
    assert "carrying a value" not in str(caught.value)


@pytest.mark.parametrize("status", [302, 400, 418])
def test_other_statuses_mean_the_api_changed(justgiving, justgiving_api, status):
    justgiving_api.respond(status, b"{}")
    with pytest.raises(JustGivingChanged) as caught:
        justgiving.read_page(PAGE_URL)
    assert caught.value.code == "justgiving_changed" and caught.value.exit_code == 13


def test_an_html_200_is_a_failed_read(justgiving, justgiving_api):
    justgiving_api.respond(200, b"<html>Please wait</html>", {"content-type": "text/html"})
    with pytest.raises(JustGivingChanged):
        justgiving.read_page(PAGE_URL)


def test_an_address_of_another_shape_is_not_requested(justgiving, justgiving_api):
    with pytest.raises(PageNotFound):
        justgiving.read_page("https://www.justgiving.com/fundraising/example")
    assert justgiving_api.requests == []


@pytest.mark.parametrize(
    "cls",
    [
        KeyRejected,
        QuotaExhausted,
        AccessDenied,
        PageNotFound,
        JustGivingChanged,
        SuspectFigures,
        PageNotActive,
        FiguresUnpublished,
    ],
)
def test_every_class_has_its_own_code_and_texts(cls):
    assert failure_class(cls.code) is cls
    assert "intervals" not in (cls.likely_cause + cls.action).lower()


# --- Requests ---


def test_only_the_one_url_is_called_with_the_key_and_user_agent(
    justgiving, justgiving_api, justgiving_key
):
    justgiving.read_page(PAGE_URL)
    assert [r.full_url for r in justgiving_api.requests] == [API_URL]
    request = justgiving_api.requests[0]
    assert request.get_method() == "GET"
    assert request.get_header("Bb-api-subscription-key") == justgiving_key
    assert request.get_header("User-agent") == USER_AGENT
    assert request.get_header("Justgiving-realm") is None


def test_the_realm_header_is_sent_only_when_set(justgiving, justgiving_api, monkeypatch):
    monkeypatch.setenv("JUSTGIVING_REALM", "staging")
    justgiving.read_page(PAGE_URL)
    assert justgiving_api.requests[0].get_header("Justgiving-realm") == "staging"


def test_the_adapter_has_one_path_template_and_no_donation_operation():
    folder = Path(__file__).resolve().parents[2] / "src/awingest/providers/justgiving"
    source = "".join(p.read_text(encoding="utf-8") for p in folder.glob("*.py"))
    assert source.count("/fundraising/pages") == 1
    assert "/donations" not in source and "api.justgiving.com" not in source


class _Redirecting(http.server.BaseHTTPRequestHandler):
    seen: ClassVar[list[str]] = []

    def do_GET(self):
        type(self).seen.append(self.path)
        self.send_response(302)
        self.send_header("Location", "/elsewhere")
        self.end_headers()

    def log_message(self, *args):
        pass


def test_a_redirect_is_not_followed_so_the_key_can_not_go_elsewhere():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Redirecting)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_port}/page"
        transport = urllib_transport(5, follow_redirects=False)
        status, _, _ = transport(urllib.request.Request(url))
    finally:
        server.shutdown()
        server.server_close()
    assert status == 302 and _Redirecting.seen == ["/page"]


# --- Privacy and secrets ---


def test_no_sentinel_reaches_the_snapshot():
    raw = (JUSTGIVING_FIXTURES / "page-sentinels.json").read_bytes()
    snapshot = parse_page(raw)
    assert (snapshot.raised_pence, snapshot.supporters) == (3000, 2)
    assert "SENTINEL" not in repr(snapshot)
    assert "sentinel" not in repr(snapshot).lower()


def test_page_status_stays_out_of_the_repr():
    assert "Active" not in repr(parse_page(body()))


def test_the_key_is_in_no_exception_or_repr(justgiving, justgiving_api, justgiving_key):
    assert justgiving_key not in repr(justgiving)
    assert justgiving_key not in repr(vars(justgiving))
    for status in (401, 403, 404, 418):
        justgiving_api.respond(status, b"{}")
        with pytest.raises(Exception) as caught:
            justgiving.read_page(PAGE_URL)
        assert justgiving_key not in str(caught.value) and justgiving_key not in repr(caught.value)


def test_logging_scrubs_the_key(justgiving_key):
    assert TEST_JUSTGIVING_KEY not in scrub(f"key {justgiving_key} failed")
    stream = io.StringIO()
    Logger("fundraising-read", provider="justgiving", stream=stream).error(
        "read_failed", message=f"key {justgiving_key}", subscriptionKey="x-value", other="kept"
    )
    line = stream.getvalue()
    assert justgiving_key not in line and "x-value" not in line and "kept" in line


@pytest.mark.parametrize(
    "name",
    [
        "JUSTGIVING_SUBSCRIPTION_KEY",
        "subscription_key",
        "subscriptionKey",
        "Bb-Api-Subscription-Key",
    ],
)
def test_logging_redacts_the_keys_by_name(name):
    stream = io.StringIO()
    Logger("fundraising-read", stream=stream).info("event", **{name: "x-value"})
    assert "x-value" not in stream.getvalue()


# --- Determinism ---


def test_the_same_body_gives_the_same_snapshot():
    raw = (JUSTGIVING_FIXTURES / "page-pence.json").read_bytes()
    assert parse_page(raw) == parse_page(raw)
