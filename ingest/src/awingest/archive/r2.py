"""``R2Archive``: the raw archive in the private Cloudflare R2 bucket, via its S3 API (T049).

Conditional writes use S3's ``If-Match`` and ``If-None-Match: *``. A precondition failure (or
a 404 for an ``If-Match`` on a missing object) is checked against the stored object: identical bytes mean an earlier attempt already succeeded
(idempotent re-put), anything else is an ``ArchiveConflict``. Every boto3 error maps to
``ArchiveUnavailable``; the messages carry the S3 error code, never credentials.
"""

import os
from collections.abc import Iterator
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from awingest.archive.base import (
    ABSENT,
    ArchiveConflict,
    ArchiveUnavailable,
    ObjectInfo,
    etag_of,
    validate_key,
    validate_prefix,
)

ENV = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
_NOT_FOUND = {"NoSuchKey", "404", "NotFound"}
_PRECONDITION = {"PreconditionFailed", "412", "ConditionalRequestConflict", "409"}


def _code(exc: ClientError) -> str:
    return str(exc.response.get("Error", {}).get("Code", "unknown"))


def _unavailable(action: str, key: str, exc: Exception) -> ArchiveUnavailable:
    detail = _code(exc) if isinstance(exc, ClientError) else type(exc).__name__
    return ArchiveUnavailable(f"R2 {action} {key or '(bucket)'} failed: {detail}")


class R2Archive:
    def __init__(self, client: Any, bucket: str) -> None:
        self._client = client
        self.bucket = bucket

    @classmethod
    def from_env(cls) -> "R2Archive":
        missing = [name for name in ENV if not os.environ.get(name)]
        if missing:
            raise ArchiveUnavailable(
                f"R2 settings missing from the environment: {', '.join(missing)}"
            )
        client = boto3.client(
            "s3",
            endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
            config=Config(
                retries={"max_attempts": 4, "mode": "standard"},
                connect_timeout=10,
                read_timeout=60,
                # R2 doesn't need the newer default checksums; send them only where required.
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )
        return cls(client, os.environ["R2_BUCKET"])

    def get(self, key: str) -> bytes | None:
        validate_key(key)
        try:
            return self._client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as exc:
            if _code(exc) in _NOT_FOUND:
                return None
            raise _unavailable("get", key, exc) from exc
        except BotoCoreError as exc:
            raise _unavailable("get", key, exc) from exc

    def _etag(self, key: str) -> str | None:
        try:
            return self._client.head_object(Bucket=self.bucket, Key=key)["ETag"].strip('"')
        except ClientError as exc:
            if _code(exc) in _NOT_FOUND:
                return None
            raise _unavailable("head", key, exc) from exc
        except BotoCoreError as exc:
            raise _unavailable("head", key, exc) from exc

    def put(self, key: str, data: bytes, *, if_match: str | None = None) -> str:
        validate_key(key)
        new_etag = etag_of(data)
        args: dict[str, Any] = {"Bucket": self.bucket, "Key": key, "Body": data}
        if if_match == ABSENT:
            args["IfNoneMatch"] = "*"
        elif if_match is not None:
            args["IfMatch"] = f'"{if_match}"'
        try:
            self._client.put_object(**args)
        except ClientError as exc:
            # A failed If-Match on a missing object is a 404 (NoSuchKey), not a 412.
            missing = if_match not in (None, ABSENT) and _code(exc) in _NOT_FOUND
            if _code(exc) not in _PRECONDITION and not missing:
                raise _unavailable("put", key, exc) from exc
            if self._etag(key) == new_etag:
                return new_etag
            raise ArchiveConflict(f"{key} changed since it was read") from exc
        except BotoCoreError as exc:
            raise _unavailable("put", key, exc) from exc
        return new_etag

    def list(self, prefix: str = "") -> Iterator[ObjectInfo]:
        validate_prefix(prefix)
        try:
            pages = self._client.get_paginator("list_objects_v2").paginate(
                Bucket=self.bucket, Prefix=prefix
            )
            for page in pages:
                for obj in page.get("Contents", []):
                    yield ObjectInfo(key=obj["Key"], etag=obj["ETag"].strip('"'), size=obj["Size"])
        except ClientError as exc:
            raise _unavailable("list", prefix, exc) from exc
        except BotoCoreError as exc:
            raise _unavailable("list", prefix, exc) from exc

    def exists(self, key: str) -> bool:
        validate_key(key)
        return self._etag(key) is not None

    def delete(self, key: str) -> None:
        validate_key(key)
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            raise _unavailable("delete", key, exc) from exc
        except BotoCoreError as exc:
            raise _unavailable("delete", key, exc) from exc
