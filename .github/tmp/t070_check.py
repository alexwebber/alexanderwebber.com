"""TEMPORARY (T070): aggregates of the R2 archive after the fetch-only run. Prints key names,
counts and booleans only, never a value from a private object."""

import json
from collections import Counter

from awingest.archive.r2 import R2Archive
from awingest.providers.intervals.endpoints import APPROVED_WELLNESS_KEYS

archive = R2Archive.from_env()
client, bucket = archive._client, archive.bucket  # noqa: SLF001
keys = []
for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket):
    keys += [o["Key"] for o in page.get("Contents", [])]

prefixes = Counter()
parts = Counter()
for key in keys:
    bits = key.split("/")
    prefixes["/".join(bits[:3]) if key.startswith("raw/") else key] += 1
    if key.startswith("raw/intervals/activities/"):
        parts[bits[-1]] += 1
print("objects by prefix:", dict(sorted(prefixes.items())))
print("activity parts:", dict(sorted(parts.items())))

wellness_keys = Counter()
for key in keys:
    if key.startswith("raw/intervals/wellness/"):
        body = json.loads(client.get_object(Bucket=bucket, Key=key)["Body"].read())
        wellness_keys.update(body.keys())  # key names only (not Counter.update(body))
print("wellness key names:", sorted(wellness_keys))
print("wellness keys all approved:", set(wellness_keys) <= {*APPROVED_WELLNESS_KEYS, "id"})  # id = the date

for key in ("state/fetch-status.json", "state/cursor.json"):
    if key in keys:
        doc = json.loads(client.get_object(Bucket=bucket, Key=key)["Body"].read())
        shape = {k: sorted(v.keys()) if isinstance(v, dict) else type(v).__name__ for k, v in doc.items()}
        print(key, "shape:", shape)
        if key == "state/fetch-status.json":
            entry = doc.get("intervals", {})
            print("  outcome:", entry.get("last_outcome", entry.get("outcome")), "| failures:", entry.get("consecutive_failures"))
    else:
        print(key, "missing")
if "public/freshness.json" in keys:  # public by design
    print("freshness:", client.get_object(Bucket=bucket, Key="public/freshness.json")["Body"].read().decode())
else:
    print("public/freshness.json missing")
