---
description: "Agent tips for external providers and file formats: intervals.icu FIT endpoints, garmin-fit-sdk, proving a response with a live call, urllib redirects and headers, credential shape checks, Decimal precision and strict Python regexes. Read before writing or changing a provider adapter or parser."
---

# Agent tips: Providers and file formats

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **intervals.icu: `/activity/{id}/file` is the original upload; `/activity/{id}/fit-file` is a
  FIT file intervals.icu generates** and drops Garmin-only messages such as `time_in_zone`
  (216). Archive the original, and check which endpoint a "FIT" download really is before
  relying on device-specific messages.
- **Decode FIT files with Garmin's `garmin-fit-sdk`.** `fitparse` (last release 2020) reads
  newer messages as `unknown_<n>` with no fields.
- **Prove a provider's response with a live call before planning.** An API reference showed a
  numeric `TargetAmount` that the real response didn't have, and every figure was a string. One
  call, printing only allow-listed fields and never the key, corrected the contract.
- **`urllib` copies custom headers to redirect targets.** A client with its key in a custom
  header needs a no-redirect handler.
- **Check a credential's shape before the request.** A key stored with a BOM failed to encode as
  a header, and the catch-all around the transport made that a retryable error. The alert then
  said no action was needed, for a fault no retry could clear.
- **Python `Decimal` arithmetic rounds at context precision.** A long string with a stray digit
  past the pence passed `* 100` until precision was set from the input's length.
- **In Python `str` regexes, `\d` matches Unicode digits and `$` allows a trailing newline.** Use
  `[0-9]` and `fullmatch` for strict parsing.
