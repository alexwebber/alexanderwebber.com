"""Writes the synthetic JustGiving page responses in this folder. Run it to regenerate them:

    uv run python tests/fixtures/justgiving/make_fixtures.py

They are written by hand in the live shape (T025): 48 top-level keys, figures as strings, no
``TargetAmount``. Every value is invented; no real response, name or identifier is committed.
``page-sentinels.json`` has a sentinel in every field the adapter must not read, plus injected
donation records, for the privacy tests.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent

# Read by the adapter. Everything else must never leave it.
ALLOW_LISTED = {
    "currencyCode",
    "donationCount",
    "fundraisingTarget",
    "grandTotalRaisedExcludingGiftAid",
    "status",
}

PAGE = {
    "activityCharityCreated": False,
    "activityId": "0000000",
    "activityType": "Example",
    "attribution": "",
    "branding": {"thermometerFillColor": "000000", "thermometerTextColor": "ffffff"},
    "campaignGuid": "00000000-0000-4000-8000-000000000001",
    "charity": {"id": 1, "name": "Example Hospice Group", "registrationNumber": "000000"},
    "companyAppealId": 0,
    "consumerId": 1000001,
    "currencyCode": "GBP",
    "currencySymbol": "?",
    "domain": "www.example.org",
    "donationCount": "0",
    "eventCategory": "Example",
    "eventDate": "/Date(1800000000000)/",
    "eventId": 1000002,
    "eventName": "Example Marathon",
    "expiryDate": "/Date(1810000000000)/",
    "fundraisingTarget": "500",
    "grandTotalRaisedExcludingGiftAid": "0",
    "image": {"caption": "", "url": "https://images.example.org/cover.jpg"},
    "imageCount": "1",
    "inMemoriam": False,
    "media": {"images": [], "videos": []},
    "organisation": None,
    "owner": "Sam Example",
    "ownerGuid": "00000000-0000-4000-8000-000000000002",
    "ownerProfileImageUrls": {"small": "https://images.example.org/owner.jpg"},
    "pageCreatedDate": "/Date(1790000000000)/",
    "pageGuid": "00000000-0000-4000-8000-000000000003",
    "pageId": "1000003",
    "pageShortName": "example-runner-2027",
    "pageSummary": "Example page summary.",
    "pageSummaryWhat": None,
    "pageSummaryWhy": None,
    "rememberedPersonSummary": None,
    "showEventDate": "true",
    "showExpiryDate": "true",
    "smsCode": None,
    "status": "Active",
    "story": "<p>Example story text.</p>",
    "teams": [],
    "title": "Example fundraising page",
    "totalEstimatedGiftAid": "0",
    "totalRaisedOffline": "0",
    "totalRaisedOnline": "0",
    "totalRaisedPercentageOfFundraisingTarget": "0",
    "totalRaisedSms": "0",
}
assert len(PAGE) == 48


def write(name: str, doc: dict) -> None:
    text = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
    (HERE / name).write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    write("page.json", PAGE)
    write(
        "page-pence.json",
        PAGE
        | {
            "donationCount": "42",
            "fundraisingTarget": "2000.00",
            "grandTotalRaisedExcludingGiftAid": "1335.00",
            "totalEstimatedGiftAid": "250.25",
            "totalRaisedOnline": "1335.00",
        },
    )
    write("page-no-target.json", PAGE | {"fundraisingTarget": None})
    write("page-closed.json", PAGE | {"status": "Expired"})

    sentinels = {
        key: value if key in ALLOW_LISTED else f"SENTINEL-{key}" for key, value in PAGE.items()
    }
    sentinels |= {
        "donationCount": "2",
        "grandTotalRaisedExcludingGiftAid": "30.00",
        "charity": {"name": "SENTINEL-charity-name", "registrationNumber": "SENTINEL-charity-no"},
        "owner": {"name": "SENTINEL-owner-name", "email": "sentinel-owner@example.org"},
        "donations": [
            {
                "donorDisplayName": "SENTINEL-donor-name",
                "message": "SENTINEL-donor-message",
                "amount": "SENTINEL-donor-amount",
            }
        ],
    }
    write("page-sentinels.json", sentinels)


if __name__ == "__main__":
    main()
