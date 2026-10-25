"""The ``RawArchive`` contract (T078; contracts/storage.md), run against every implementation.

``LocalArchive`` and ``R2Archive`` on moto always run. Real R2 runs too when
``AWINGEST_TEST_R2_LIVE=1`` and the ``R2_*`` variables are set; it works under a unique
``test/`` prefix, removes what it wrote, and skips the 5,000-object listing.
"""

import os
import uuid
from collections.abc import Iterator

import boto3
import pytest
from botocore.exceptions import EndpointConnectionError
from moto import mock_aws

from awingest.archive.base import (
    ABSENT,
    ArchiveConflict,
    ArchiveUnavailable,
    RawArchive,
    etag_of,
)
from awingest.archive.local import LocalArchive
from awingest.archive.r2 import ENV, R2Archive

LIVE = os.environ.get("AWINGEST_TEST_R2_LIVE") == "1" and all(os.environ.get(v) for v in ENV)
BACKENDS = ["local", "moto"] + (["r2-live"] if LIVE else [])


class Archive:
    """An archive under test, with every key placed under ``ns``."""

    def __init__(self, kind: str, archive: RawArchive, ns: str) -> None:
        self.kind = kind
        self.archive = archive
        self.ns = ns

    def k(self, key: str) -> str:
        return f"{self.ns}{key}"


@pytest.fixture(params=BACKENDS)
def store(request, tmp_path) -> Iterator[Archive]:
    ns = f"test/{uuid.uuid4().hex[:12]}/"
    if request.param == "local":
        yield Archive("local", LocalArchive(tmp_path / "archive"), ns)
    elif request.param == "moto":
        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="test-bucket")
            yield Archive("moto", R2Archive(client, "test-bucket"), ns)
    else:
        archive = R2Archive.from_env()
        yield Archive("r2-live", archive, ns)
        for obj in list(archive.list(ns)):
            archive.delete(obj.key)


def test_round_trip(store):
    a, k = store.archive, store.k
    assert a.get(k("raw/x.json")) is None
    assert not a.exists(k("raw/x.json"))
    etag = a.put(k("raw/x.json"), b'{"a":1}')
    assert etag == etag_of(b'{"a":1}')
    assert a.get(k("raw/x.json")) == b'{"a":1}'
    assert a.exists(k("raw/x.json"))
    a.put(k("raw/x.json"), b'{"a":2}')
    assert a.get(k("raw/x.json")) == b'{"a":2}'


def test_binary_and_empty_objects_round_trip(store):
    a, k = store.archive, store.k
    data = bytes(range(256)) * 4
    a.put(k("raw/activity.fit"), data)
    a.put(k("raw/empty.json"), b"")
    assert a.get(k("raw/activity.fit")) == data
    assert a.get(k("raw/empty.json")) == b""


def test_list_returns_matching_objects_in_key_order_with_etags(store):
    a, k = store.archive, store.k
    for key, data in [("b/2", b"bb"), ("a/1", b"a"), ("b/1", b"b"), ("c", b"ccc")]:
        a.put(k(key), data)
    assert [o.key for o in a.list(k(""))] == [k("a/1"), k("b/1"), k("b/2"), k("c")]
    b = list(a.list(k("b/")))
    assert [(o.key, o.etag, o.size) for o in b] == [
        (k("b/1"), etag_of(b"b"), 1),
        (k("b/2"), etag_of(b"bb"), 2),
    ]
    assert list(a.list(k("nothing/"))) == []


def test_a_put_of_identical_bytes_is_idempotent(store):
    a, k = store.archive, store.k
    first = a.put(k("state/cursor.json"), b"v1")
    assert a.put(k("state/cursor.json"), b"v1") == first
    # A retried conditional put whose first attempt succeeded: the ETag it holds is stale, but
    # the bytes are already there, so it succeeds.
    a.put(k("state/cursor.json"), b"v2", if_match=first)
    assert a.put(k("state/cursor.json"), b"v2", if_match=first) == etag_of(b"v2")


def test_if_match_detects_a_concurrent_change(store):
    a, k = store.archive, store.k
    e1 = a.put(k("state/run-ids.json"), b"{}")
    e2 = a.put(k("state/run-ids.json"), b'{"x":1}', if_match=e1)
    with pytest.raises(ArchiveConflict):
        a.put(k("state/run-ids.json"), b'{"y":1}', if_match=e1)
    assert a.get(k("state/run-ids.json")) == b'{"x":1}'
    assert a.put(k("state/run-ids.json"), b'{"y":1}', if_match=e2) == etag_of(b'{"y":1}')


def test_if_match_absent_creates_only_once(store):
    a, k = store.archive, store.k
    a.put(k("state/run-ids.json"), b"{}", if_match=ABSENT)
    assert a.put(k("state/run-ids.json"), b"{}", if_match=ABSENT) == etag_of(b"{}")
    with pytest.raises(ArchiveConflict):
        a.put(k("state/run-ids.json"), b'{"x":1}', if_match=ABSENT)
    with pytest.raises(ArchiveConflict):
        a.put(k("state/new.json"), b"{}", if_match=etag_of(b"something"))
    assert a.get(k("state/new.json")) is None


@pytest.mark.parametrize(
    "key",
    [
        "",
        "/a",
        "a/",
        "a//b",
        "..",
        "../x",
        "a/../b",
        "a/./b",
        ".hidden",
        "a/.tmp",
        "a b",
        "ä",
        "a\\b",
    ],
)
def test_invalid_keys_are_rejected(store, key):
    a = store.archive
    for call in (lambda: a.get(key), lambda: a.put(key, b"x"), lambda: a.exists(key)):
        with pytest.raises(ValueError):
            call()
    with pytest.raises(ValueError):
        a.delete(key)


def test_invalid_list_prefixes_are_rejected(store):
    with pytest.raises(ValueError):
        list(store.archive.list("../"))


def test_delete_removes_and_tolerates_missing(store):
    a, k = store.archive, store.k
    a.put(k("x"), b"1")
    a.delete(k("x"))
    a.delete(k("x"))
    assert a.get(k("x")) is None


def test_a_failed_write_leaves_the_old_object_intact(store, monkeypatch):
    a, k = store.archive, store.k
    a.put(k("state/cursor.json"), b"old")
    if store.kind == "local":

        def failing_replace(src, dst):
            raise OSError(28, "No space left on device")

        monkeypatch.setattr("awingest.archive.local.os.replace", failing_replace)
    else:

        def failing_put(**kwargs):
            raise EndpointConnectionError(endpoint_url="https://r2.invalid")

        monkeypatch.setattr(a._client, "put_object", failing_put)
    with pytest.raises(ArchiveUnavailable):
        a.put(k("state/cursor.json"), b"new")
    monkeypatch.undo()
    assert a.get(k("state/cursor.json")) == b"old"
    assert [o.key for o in a.list(k(""))] == [k("state/cursor.json")]
    if store.kind == "local":
        leftovers = [p.name for p in a.root.rglob("*") if p.name.startswith(".")]
        assert leftovers == []


def test_listing_crosses_a_page(store):
    # S3 and R2 return at most 1,000 keys a page, so 1,001 objects need a second page.
    if store.kind == "r2-live":
        pytest.skip("1,001 writes to real R2 cost time and Class A operations")
    a, k = store.archive, store.k
    for i in range(1001):
        a.put(k(f"raw/intervals/activities/{i:05d}/summary.json"), b"{}")
    keys = [o.key for o in a.list(k("raw/intervals/activities/"))]
    assert len(keys) == 1001
    assert keys == sorted(keys)


def test_r2_errors_map_to_archive_unavailable(monkeypatch):
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        archive = R2Archive(client, "no-such-bucket")
        with pytest.raises(ArchiveUnavailable, match="NoSuchBucket"):
            archive.put("x", b"1")
        with pytest.raises(ArchiveUnavailable):
            list(archive.list())


def test_r2_from_env_names_missing_settings_without_values(monkeypatch):
    monkeypatch.setenv("R2_ACCOUNT_ID", "acct")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "very-secret-value")
    monkeypatch.delenv("R2_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("R2_BUCKET", raising=False)
    with pytest.raises(ArchiveUnavailable) as err:
        R2Archive.from_env()
    assert "R2_ACCESS_KEY_ID" in str(err.value) and "R2_BUCKET" in str(err.value)
    assert "very-secret-value" not in str(err.value)
