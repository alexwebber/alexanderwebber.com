# Data Model: Fundraising

**Feature**: 002-fundraising | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md) |
Extends: [001 data model](../001-running-section/data-model.md)

Running's three zones apply. The difference is the raw zone: fundraising keeps **no raw payloads**
(FR-011, research.md R5), only an allow-listed snapshot.

| Zone | Where | Written by | Contains |
|---|---|---|---|
| **Private state** | R2 `state/fundraising.json` | `fundraising-read` | Per campaign: the latest allow-listed figures and the read status. No response bodies, no account identifiers |
| **Public state** | R2 `public/fundraising-freshness.json` | `fundraising-read` | Per campaign: `last_read_at`, and `generated_at`. Served by the Worker |
| **Published** | Git `data/running/published/fundraising/<id>.json` | `fundraising-publish` (gated bot) | One file per campaign: daily figures and `last_read_at` |
| **Owner** | Git `data/running/owner/campaigns.yaml`, `stories/<id>.yaml` | Owner or agent, by PR | Campaigns and approved stories |

Derived values (current or past, phase, progress, chart points) are computed at build time and never
stored.

---

## 1. Adapter output (in memory)

**FundraisingSnapshot** (`providers/base.py`): the only thing that leaves the adapter.

| Field | Type | Rule |
|---|---|---|
| `raised_pence` | int >= 0 | From `grandTotalRaisedExcludingGiftAid`, parsed strictly (research.md R7) |
| `target_pence` | int > 0, or `None` | From `fundraisingTarget`; `null`, `""` or any value equal to zero (`"0"`, `"0.00"`) means no target; a missing key is a failed read |
| `supporters` | int >= 0 | From `donationCount` |
| `page_status` | str | From `status`. Private: never published |

Frozen, built field by field. Nothing else from the response survives the adapter.

---

## 2. Private state: `state/fundraising.json`

Keyed by campaign ID. Each entry is shaped like a `state/fetch-status.json` source, so
`source_status()`, `rate_limited_until()` and `record_failure()` apply.

```json
{
  "brighton-2027": {
    "last_attempt_at": "2026-11-10T09:17:03Z",
    "last_success_at": "2026-11-10T09:17:03Z",
    "outcome": "ok",
    "error_class": null,
    "code": null,
    "message": null,
    "consecutive_failures": 0,
    "rate_limited_until": null,
    "page_status": "Active",
    "latest": {
      "read_at": "2026-11-10T09:17:03Z",
      "raised_pence": 125000,
      "target_pence": 200000,
      "supporters": 37
    }
  }
}
```

- **`latest`** changes only on a successful read, so a failed read can't blank or zero anything
  (FR-003).
- **`last_success_at`** means the last time JustGiving's figures were seen to equal the site's: a
  read that matched the published figures, or the published file's own `last_read_at`, whichever is
  later (research.md R6). The name matches the status entries the alert code already reads.
- **`outcome`**: `ok`, `unpublished` (read fine, the figures aren't on the site yet) or `failed`.
- **`first_unpublished_at`**: set while `outcome` is `unpublished`, cleared on a match. It dates a
  campaign that has never reached the site.

---

## 3. Public state: `public/fundraising-freshness.json`

```json
{ "campaigns": { "brighton-2027": { "last_read_at": "2026-11-10T09:17:03Z" } }, "generated_at": "2026-11-10T09:17:04Z" }
```

Only active campaigns with a `last_success_at`. Written after the state document is saved. The
Worker re-shapes it to these fields (contracts/pipeline.md).

---

## 4. Published: `data/running/published/fundraising/<id>.json`

`schemas/published/fundraising-campaign.schema.json`, title `CampaignFigures`,
`additionalProperties: false` throughout.

```json
{
  "schema_version": 1,
  "campaign_id": "brighton-2027",
  "last_read_at": "2026-11-10T09:17:03Z",
  "points": [
    { "date": "2026-11-09", "raised_pence": 100000, "target_pence": 200000, "supporters": 30 },
    { "date": "2026-11-10", "raised_pence": 125000, "target_pence": 200000, "supporters": 37 }
  ]
}
```

| Field | Rule |
|---|---|
| `campaign_id` | Equals the file name |
| `last_read_at` | `utcTimestamp`. The figures were last seen to match JustGiving at this time. Build-time fallback for FR-004 and FR-005; a finished campaign's "date last read" (FR-023) |
| `points` | At least one, sorted by `date`, unique per day. The last point is the current figures (FR-008) |
| `points[].date` | Europe/London date of the read. **No time of day** (research.md R11) |
| `points[].raised_pence`, `supporters` | Integers >= 0 |
| `points[].target_pence` | Integer > 0; omitted when the page has no target |

**FR-010 and the schema**: only these fields can validate, so a donor name, amount, message, Gift Aid
figure or account identifier can't be written. The file holds a point a day, but git history keeps every
committed version, which the owner accepted ([research.md](research.md) R11).

**Writing rules** (`fundraising-publish`, per active campaign with a `latest`):

| Situation | Result |
|---|---|
| No published file | Create it with one point (first read, FR-022) |
| `latest.read_at` not after `last_read_at` | Nothing: a failed read leaves `latest` as it was |
| Figures differ, same London day as the last point | Replace that point; set `last_read_at` |
| Figures differ, a later day | Append a point; set `last_read_at` |
| Same figures, committed `last_read_at` at least 6 hours old | Set `last_read_at` only |
| Same figures, younger | Nothing |

Setting `last_read_at` means setting it to `latest.read_at`, never the clock, so a failed read can't claim
fresh figures (SC-005). The age in the 6-hour rule is `now` minus the committed value.

"Figures" means raised, target and supporters together, so a target change alone makes a point. A
total that goes down is written as it is (the spec's refund edge case).

A finished campaign is skipped, so its file never changes again. A file is never deleted, even if its
campaign leaves `campaigns.yaml` (FR-008); validation warns about the orphan.

---

## 5. Owner: `data/running/owner/campaigns.yaml`

`schemas/owner/campaigns.schema.json`. A list, title of items `Campaign`, strict like every owner
schema.

```yaml
- id: brighton-2027
  race_id: brighton-2027
  charity:
    name: Martlets
    url: https://www.martlets.org.uk/
    registered:
      name: Southern Hospice Group
      number: "256789"
  page_url: https://www.justgiving.com/page/alexanderwebber-brighton-2027
  # finished: true    # stops reads; shows "Final total" (FR-023)
```

| Field | Rule |
|---|---|
| `id` | Slug, at most 30 characters (it forms a GitHub label) |
| `race_id` | An `id` in `upcoming-races.yaml`, or a `slug` under `races/` |
| `charity.name` | Required. Must equal `section.yaml` `focus_race.charity.name` when `race_id` is the focus race (FR-024) |
| `charity.url` | Optional, `https://` |
| `charity.registered` | Optional. `name` and `number` together: the legal charity. Shown as "Part of <name>, registered charity <number>" when `name` differs from `charity.name`, else "Registered charity <number>". Fundraising page only |
| `page_url` | Required, `^https://www\.justgiving\.com/page/[a-z0-9-]+$`. A typing mistake that keeps this shape is caught by the first read (404, alert) |
| `finished` | Optional boolean, default false |

There is no target field (FR-021): the schema's strictness makes one an error, and the error says the
target comes from JustGiving.

**Referential checks** (`validateRunning`; FR-024 stops the update and names file, entry and field):

- `id` unique; `race_id` unique (two campaigns on one race would both be current); `page_url` unique.
- `race_id` is a known race.
- Charity agreement with the focus race.
- Warning, not an error: a published file with no campaign, and a campaign with `finished: true` but
  no published file (it would never appear).

---

## 6. Owner: `data/running/owner/stories/<campaign-id>.yaml`

`schemas/owner/campaign-story.schema.json`, title `CampaignStory`.

```yaml
campaign: brighton-2027
text: |
  First paragraph of the approved text.

  Second paragraph.
approved:
  date: 2026-11-20
  text_sha256: 3f1c...   # sha256 of the text field above
```

| Field | Rule |
|---|---|
| `campaign` | Equals the file name, and is a campaign ID |
| `text` | Non-empty plain text. Blank lines separate paragraphs. No HTML or Markdown: rendered as `<p>` elements, escaped |
| `approved` | Required, with an `x-error` saying the story needs the owner's approval (FR-052) |
| `approved.date` | A date, not in the future |
| `approved.text_sha256` | Must equal the sha256 of `text` as parsed. A mismatch stops the update: the text changed after approval (SC-007) |

The heading is derived: "Why I'm running for <charity>". This file is the only place story text
lives, and it enters the repository only after the owner approves (FR-055). The same text goes on
JustGiving by hand (FR-054).

---

## 7. Derived at build time

`domain/fundraising.ts`, pure, `today` passed in; `data/fundraising.ts` loads through `RunningStore`
(memoised with `perStoreAndDay`).

- **Campaign with figures**: a campaign whose published file exists. Others appear nowhere (FR-022).
- **Current campaign**: the one whose `race_id` is the focus race, if it has figures. All others with
  figures are **past**, most recent race first (FR-043).
- **Race**: from `upcoming-races.yaml` by `id`, else `races/<slug>/race.yaml` by `slug`. The race state
  comes from `raceState()` and the result from `raceResult()`.
- **Phase**:

  | Phase | When | Card leads with |
  |---|---|---|
  | `before_race` | Race state `upcoming` or `race_day` | "£1,250 raised of £2,000" |
  | `after_race` | Race state `awaiting_result` or `completed` | "Raised £1,250 for Martlets", plus the result if any |
  | `finished` | `finished: true`, whatever the race state | The same, marked "Final total", last-read date, no Donate |

- **Progress** (FR-032): `percent = floor(raised * 100 / target)` in integers. `fraction = percent /
  100`, capped at 1. `reached` when raised equals the target, `beaten` when it's above. No target gives no progress at all.
- **Pounds** (FR-063): `floor(pence / 100)`, with thousands separators.
- **Stale** (FR-005): active campaign, and `now - last_read_at > stale_after_hours`. Never for a
  finished campaign.
- **Chart points** (FR-042): a total holds until it changes, so each change gets a point the day
  before it at the old value, plus a closing point today. Without that a straight line would suggest
  money arrived gradually. The table lists only the real points. `zero` is on, and the target line
  uses the latest target.
- **Chart shown** when the file has at least two points (US2.3).

---

## 8. State transitions

**Campaign**

```text
configured (no figures: invisible)
  -> current or past (figures read; visible)
       current <-> past      switching the focus race (FR-022)
       before_race -> after_race    race day passes, or a result is recorded (FR-033)
  -> finished    the owner sets finished: true (FR-023). Reads stop. Terminal
```

**A single read**

```text
read ok, same figures       -> last_success_at = now; live time moves; no publish
read ok, different figures  -> latest updated; live time held; the run publishes
                               publish -> commit -> deploy -> the next read matches
read failed                 -> latest, last_success_at and published data untouched;
                               failure recorded; alert after 24 h (at once for 404 or inactive)
429 or quota                -> rate_limited_until set; no calls until it passes
```
