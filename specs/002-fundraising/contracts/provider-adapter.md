# Contract: Fundraising Provider Adapter

Principle IV and FR-007: only `ingest/src/awingest/providers/justgiving/` knows how JustGiving
provides its figures. It follows Running's [provider contract](../../001-running-section/contracts/provider-adapter.md)
except where stated.

## Interface (`providers/base.py`)

```text
class FundraisingProvider(Protocol):
    name: str                                               # "justgiving"
    def read_page(self, page_url: str) -> FundraisingSnapshot
        # One call. Raises only ProviderError subclasses. Nothing but the snapshot leaves.

@dataclass(frozen=True)
class FundraisingSnapshot:
    raised_pence: int
    target_pence: int | None
    supporters: int
    page_status: str
```

`read_page` is both fetch and normalise, because no raw payload is kept. The parsing is a pure
function, `parse_page(body: bytes) -> FundraisingSnapshot`, so fixtures test it without HTTP.

Layout: `providers/justgiving/__init__.py`, `client.py` (the HTTP request and error mapping),
`parse.py` (the allow-list). Shared HTTP helpers (`Response`, `Transport`, the urllib transport and
`Retry-After` parsing) move from `providers/intervals/client.py` to `providers/http.py`.

## JustGiving specifics

- **URL**: `https://api.sky.blackbaud.com/jg/consumer/app/consumer/v1/fundraising/pages/{prefix}/{short_name}`,
  built from `page_url` (`https://www.justgiving.com/page/<short_name>`, prefix `page`). This is the
  adapter's **only** path template. The API's donation operations are never called (FR-011).
- **Auth**: header `Bb-Api-Subscription-Key` from env `JUSTGIVING_SUBSCRIPTION_KEY`. No OAuth. The key
  appears in no log, error, repr or stored object.
- **User-Agent**: the project's, as in the intervals.icu client.
- **Realm**: env `JUSTGIVING_REALM`, if set, is sent as the `JustGiving-Realm` header. Used locally for
  staging checks. Never set in a workflow.
- **Timeout** 20 s. One retry, 2 s later, on a network error or 5xx. One wait on a 429 whose
  `Retry-After` is 60 s or less. At most 1 call a second across campaigns.
- **Redirects aren't followed.** `urllib` copies request headers to a redirect's target, which would
  carry the key, so a 3xx comes back as a status and is a failed read.

## Fields read (the allow-list)

| Field | Becomes | Rule |
|---|---|---|
| `grandTotalRaisedExcludingGiftAid` | `raised_pence` | Required. Strict money string |
| `fundraisingTarget` | `target_pence` | Key required. `null`, `""` or any value equal to zero (`"0"`, `"0.00"`) is `None`; otherwise a strict money string |
| `donationCount` | `supporters` | Required. String of digits only |
| `currencyCode` | checked | Must be `GBP` |
| `status` | `page_status` | Required, a non-empty string |

**Strict money string**: a JSON string matching `^\d+(\.\d+)?$`, parsed with `Decimal`; digits past
the pence must be zero. Anything else is a failed read. `TargetAmount`, `totalEstimatedGiftAid`,
`currencySymbol` and every other key are never read. A non-empty `errorMessage` on a 200 is a failed
read.

On a parse failure the log carries the response's sorted key names and which field failed, never a
value.

## Errors

All are `ProviderError` subclasses in `providers/justgiving/errors.py`, with their own `code`, so the
alert quotes JustGiving's text rather than intervals.icu's. `alerts.py` imports this module, so
`failure_class()` can find them.

| HTTP or case | Class (parent) | `code` | Exit | Likely cause | Action |
|---|---|---|---|---|---|
| 401, no key set, or a key with a character a header can't carry | `KeyRejected` (`AuthRejected`) | `justgiving_key_rejected` | 10 | The subscription key is missing, lapsed or regenerated, was stored with a stray character (a BOM or newline), or belongs to the wrong product. A **Standard APIs** key gets 401 here; it must be a **JustGiving APIs** subscription | The agent asks the owner to copy the primary or secondary key from their SKY API developer account (*Subscriptions*, product **JustGiving APIs**) into the local secrets file, then runs `gh secret set JUSTGIVING_SUBSCRIPTION_KEY --body <value>` (a PowerShell pipe adds a BOM). If the local key still works, it only re-sets the secret. No retry loop |
| 403 with `Retry-After` | `QuotaExhausted` (`RateLimited`) | `justgiving_quota` | 11 | The daily quota is used up (1,000 calls across all JustGiving APIs) | Wait: back-off is automatic. If it recurs, the agent looks for what else uses the key |
| 403 without it | `AccessDenied` (`ProviderForbidden`) | `justgiving_forbidden` | 12 | The key is valid but this API or page is refused | The agent compares a local call and checks the subscription |
| 404 | `PageNotFound` (`ProviderError`) | `page_not_found` | 15 | The address in `campaigns.yaml` is mistyped, or the page has closed or expired | The agent checks `page_url` with the owner. If the campaign has ended, it marks it `finished`. Alerted at once (FR-006) |
| 429 | `RateLimited` (shared) | `rate_limited` | 11 | The rate limit (10 calls a second) | Wait |
| Network error, 5xx | `Transient` (shared) | `transient` | 1 | JustGiving or Blackbaud is having trouble | None: retried next run; alerted after 24 h |
| Anything else: a parse failure, wrong currency, other statuses | `JustGivingChanged` (`ProviderChanged`) | `justgiving_changed` | 13 | The response changed shape | The agent checks the API reference and changelog and fixes `providers/justgiving/`. The site stays on the last good figures |

Raised by the read stage rather than the adapter:

| Case | Class | `code` | Likely cause | Action |
|---|---|---|---|---|
| Total and supporters both zero, while the published file has non-zero figures | `SuspectFigures` (`JustGivingChanged`) | `suspect_figures` | A partial failure, or every donation was refunded | The agent compares with the JustGiving page and asks the owner if they really are zero |
| `status` isn't `Active` (the read still succeeds) | `PageNotActive` (`IngestError`) | `page_not_active` | The page has expired or closed | The agent asks the owner whether to mark the campaign finished. Alerted at once |
| Read fine, figures not on the site for over 24 h | `FiguresUnpublished` (`IngestError`) | `figures_unpublished` | The publish stage, gate or commit is failing | The agent reads the failing refresh runs |

## Rules

Running's rules 3 to 7 apply. Rules 1 and 2 are replaced by:

1. **No raw payload is stored, anywhere** (FR-011). `read_page` holds the body in memory, returns a
   snapshot and drops the rest.
2. **Allow-list only.** The snapshot is built field by field. A new response key can't reach the
   state file or the site without a code change.

## Tests

`ingest/tests/contract/test_justgiving_adapter.py`, against synthetic fixtures in
`ingest/tests/fixtures/justgiving/`. They are written by hand in the live shape (string figures, no
`TargetAmount`, the 48 keys) with made-up values. No real response, name or identifier is committed.

- **Shape**: `"500"`, `"1335.00"` and `"0"` parse; `TargetAmount` alone doesn't count as a target.
- **Failed reads**: each of `""`, `null`, a number type, `"£5"`, `"1,335.00"`, `"-1"`, `"NaN"`, `"1e3"`,
  a missing key and non-JSON raises `JustGivingChanged`, never a zero.
- **No target**: `null`, `""`, `"0"` and `"0.00"` give `None`.
- **Errors**: every row above, including 401 quoting **JustGiving APIs** in its action, 403 with and
  without `Retry-After`, and HTML bodies.
- **Requests**: only the one URL is called; the header and User-Agent are set; the realm header is
  present only when set.
- **Privacy, the property test**: a fixture with sentinels in every non-allow-listed field, plus
  injected `donations` entries (donor name, message, amount), `totalEstimatedGiftAid`, `ownerGuid`,
  `consumerId`, `pageId` and `pageGuid`. No sentinel appears in the snapshot's `repr`, the state
  document, the public freshness file, the published file or the logs.
- **Secrets**: the key is in no exception text or `repr`, and `logging.py` scrubs it.
- **Determinism**: the same body always gives the same snapshot.
