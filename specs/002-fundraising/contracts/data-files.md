# Contract: Fundraising Data Files and Validation

Extends Running's [data-files contract](../../001-running-section/contracts/data-files.md). JSON
Schema 2020-12 in `schemas/` is authoritative. Field rules: [data-model.md](../data-model.md).

## Layout

```text
data/running/published/fundraising/<campaign-id>.json   schemas/published/fundraising-campaign.schema.json
data/running/owner/campaigns.yaml                       schemas/owner/campaigns.schema.json
data/running/owner/stories/<campaign-id>.yaml           schemas/owner/campaign-story.schema.json
```

**Where these are registered** (each rejects unknown files or schemas today):

| Place | Change |
|---|---|
| `src/sections/running/data/store/schemas.ts` | Three names in `RUNNING_SCHEMAS`; gen-types then makes `Campaign`, `CampaignStory`, `CampaignFigures` |
| `src/sections/running/data/store/files.ts` | `schemaForFile`, `RunningData`, `store()`, `LIST_NOUNS['owner/campaigns'] = 'campaign'`, `locate()` |
| `src/sections/running/data/store/running-store.ts`, `json-file-store.ts` | `getCampaignFigures(): Promise<CampaignFigures[]>`; `OwnerData.campaigns`, `OwnerData.stories` |
| `ingest/src/awingest/publish/manifest.py` | `LAYOUT` |
| `schemas/fixtures/` | Valid and invalid fixtures, read by both languages |

## Cross-cutting rules

Running's rules apply. In addition:

- The published schema is `additionalProperties: false` everywhere. A schema test asserts that no
  key matching `donor|donation|gift_?aid|message|owner|consumer|page_?id|page_?guid` can validate in it,
  and that a `date` with a time of day can't.
- `points[].date` is a plain date, not a datetime.
- Amounts are integers in pence, so there's never a floating-point total.
- `campaigns.schema.json` has no target property, with an `x-error` for a `target` key saying that the
  target is read from JustGiving (FR-021).

## Referential checks (`validateRunning`)

Messages follow Running's `file / entry / field` format (FR-024, FR-070), for example:

```text
data/running/owner/campaigns.yaml  campaign "brighton-2027"  field charity.name: "Martlets" differs from section.yaml focus_race.charity.name "Martlets hospice"; the hero and the card would name different charities
data/running/owner/stories/brighton-2027.yaml  field approved.text_sha256: the text has changed since it was approved; the owner must approve it again
```

| Check | Severity |
|---|---|
| Campaign `id` unique | Error |
| `race_id` unique across campaigns | Error |
| `page_url` unique | Error |
| `race_id` is an `upcoming-races.yaml` id or a `races/` slug | Error |
| `charity.name` equals `focus_race.charity.name`, for the focus race's campaign | Error |
| Story file name equals `campaign`, and that campaign exists | Error |
| `approved.date` not in the future | Error |
| `approved.text_sha256` equals the sha256 of `text` | Error, in the loader (`files.ts`), so the store and a plain build refuse it too |
| `approved` missing | Error (schema), message: "needs the owner's approval before it can be published" |
| Published file's `campaign_id` equals its file name | Error |
| `points` sorted, one per date, none in the future | Error |
| A published file with no campaign | Warning: its history is kept and not shown |
| A `finished` campaign with no published file | Warning: it would never appear |

The owner-file scan for provider IDs (`validate.ts`) covers the new files unchanged. The charity number
is 6 digits, below its 9-digit rule.

## The privacy scan (`scripts/scan-privacy.ts`, SC-004)

The scan can't recognise an arbitrary person's name, so it isn't the main protection. Four layers
prove SC-004, in order:

1. **The adapter's allow-list**, with a sentinel property test ([provider-adapter.md](provider-adapter.md)).
2. **No raw storage**, so nothing exists to leak later.
3. **The published schema**, which can't hold anything else, in Python and in TypeScript.
4. **`scan-privacy`, across `data/` and `dist/`**, on every gate run, with two new rules:

| Rule | Pattern | Applies to |
|---|---|---|
| Donor, Gift Aid or JustGiving account key | Keys matching `donor\w*`, `donations?`, `donation_?amount`, `gift_?aid\w*`, `totalEstimatedGiftAid`, `owner_?guid`, `page_?guid`, `campaign_?guid`, `consumer_?id`, `page_?id`, `event_?id` | `data/` except `owner/stories/`, as JSON or YAML keys; `dist/` except bundled library code, as quoted keys only |
| A Gift Aid figure on a page | `£` and digits within 40 characters of "Gift Aid", in either order | `dist/`, except bundled library code |

The narrower matching on pages and stories matters: the shared `key()` helper also matches a bare
word before a colon, so a sentence such as "Donations: ..." would fail the gate. Like the other rules,
findings give file, line and column, never the matched value. "Gift Aid" as a word stays allowed, so
an approved story could mention it.

**Test**: fixtures for each rule in `tests/unit/scan-privacy.test.ts`, and a planted key in a temporary
published file to prove the gate fails. A new published shape goes through the full gate before its PR
(AGENT_TIPS, *Privacy and data pipelines*).
