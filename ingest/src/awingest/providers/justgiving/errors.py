"""JustGiving's failure classes (specs/002-fundraising/contracts/provider-adapter.md, Errors).

Each has its own stable ``code`` and its own ``likely_cause`` and ``action``, because the base
classes' texts name intervals.icu. The last three are raised or reported by the fundraising stages,
not the adapter; they live here so one import registers every code for ``failure_class()``.
"""

from awingest.errors import IngestError
from awingest.providers.base import (
    AuthRejected,
    ProviderChanged,
    ProviderError,
    ProviderForbidden,
    RateLimited,
)


class KeyRejected(AuthRejected):
    code = "justgiving_key_rejected"
    likely_cause = (
        "The subscription key is missing, lapsed or regenerated, or belongs to the wrong product. "
        "A **Standard APIs** key gets 401 here; it must be a **JustGiving APIs** subscription."
    )
    action = (
        "The agent asks the owner to copy the primary or secondary key from their SKY API "
        "developer account (*Subscriptions*, product **JustGiving APIs**) into the local secrets "
        "file, then pipes it into `gh secret set JUSTGIVING_SUBSCRIPTION_KEY`. No retry loop."
    )


class QuotaExhausted(RateLimited):
    code = "justgiving_quota"
    likely_cause = "The daily quota is used up (1,000 calls across all JustGiving APIs)."
    action = (
        "Wait: back-off is automatic. If it recurs, the agent looks for what else uses the key."
    )


class AccessDenied(ProviderForbidden):
    code = "justgiving_forbidden"
    likely_cause = "The key is valid but this API or page is refused."
    action = "The agent compares a local call and checks the subscription."


class PageNotFound(ProviderError):
    code = "page_not_found"
    exit_code = 15
    likely_cause = "The address in `campaigns.yaml` is mistyped, or the page has closed or expired."
    action = (
        "The agent checks `page_url` with the owner. If the campaign has ended, it marks it "
        "`finished`."
    )


class JustGivingChanged(ProviderChanged):
    code = "justgiving_changed"
    likely_cause = "JustGiving's response changed shape."
    action = (
        "The agent checks the API reference and changelog and fixes `providers/justgiving/`. The "
        "site stays on the last good figures."
    )


class SuspectFigures(JustGivingChanged):
    code = "suspect_figures"
    likely_cause = "A partial failure at JustGiving, or every donation was refunded."
    action = (
        "The agent compares with the JustGiving page and asks the owner if they really are zero."
    )


class PageNotActive(IngestError):
    code = "page_not_active"
    likely_cause = "The JustGiving page has expired or closed."
    action = "The agent asks the owner whether to mark the campaign finished."


class FiguresUnpublished(IngestError):
    code = "figures_unpublished"
    likely_cause = "The publish stage, gate or commit is failing."
    action = "The agent reads the failing refresh runs."
