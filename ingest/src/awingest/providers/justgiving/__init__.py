"""The JustGiving provider (specs/002-fundraising/contracts/provider-adapter.md): the only code that
knows how JustGiving provides its figures (FR-007). ``JustGivingProvider`` implements
``FundraisingProvider``."""

from awingest.providers.justgiving.client import JustGivingProvider

__all__ = ["JustGivingProvider"]
