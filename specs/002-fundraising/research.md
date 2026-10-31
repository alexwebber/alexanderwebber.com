# Research: Fundraising

**Feature**: 002-fundraising | **Date**: 2026-10-31 | **Plan**: [plan.md](plan.md)

Evidence comes from a live call with the owner's own key on 2026-10-31, JustGiving's and
Blackbaud's published documents, and the code on `main`. Nothing here is left as NEEDS
CLARIFICATION. The two points only real donations can settle are listed under R8, with the test
that settles each.

---

## R0. How to read the page's figures

**Decision**: Blackbaud SKY API, product **JustGiving APIs**, API **JustGiving Consumer Public**
(<https://developer.blackbaud.com/skyapi/products/justgiving/consumer>, reference
<https://developer.sky.blackbaud.com/api#api=jg-consumer>). It is described as "display public
fundraising information" and "authorized by your application alone", and JustGiving's own
developer site lists "Showcase your latest fundraising efforts using page data in real time" as a
use. The owner created the account on 2026-10-31.

| Option | Verdict | Why |
|---|---|---|
| Blackbaud SKY API, JustGiving Consumer Public | **Chosen** | Official, documented, free tier, proven live with a key alone, and it is the platform JustGiving is moving to |
| Reading the public page's HTML | Rejected | JustGiving's terms (<https://www.justgiving.com/info/terms-of-service>, "Prohibition on data extraction and distribution") say users agree not to use any tool, program, script, bots, robots, spiders or scrapers to "copy ..., mirror, frame, index, scrape, mine or otherwise gather or extract any of the content or data from the Website". That covers the owner's own page. It was technically possible: the figures are server-rendered (the earlier note that the target isn't in the raw HTML was wrong) |
| The page's undocumented GraphQL endpoint | Rejected | Undocumented, and the same terms clause applies |
| The old JustGiving API (`api.justgiving.com`, 3scale, App ID) | Rejected | Ends on 30 June 2027 |
| A JustGiving widget or iframe on the site | Rejected | A visitor's page would depend on a third party (Principle III, FR-001), with no history and no control over staleness |
| Hand-entered totals | Rejected | The owner chose automatic figures; a manual fallback stays out of scope (spec assumption) |

**The 30 June 2027 cut-off doesn't apply to this route.** It ends the old 3scale platform. The SKY
endpoints are where that move leads, so the adapter starts on the new platform. The spec's edge
case, FR-007 and Dependencies are amended to say so; FR-007's single-boundary rule stays.

---

## R1. The request (proven live, 2026-10-31)

```text
GET https://api.sky.blackbaud.com/jg/consumer/app/consumer/v1/fundraising/pages/page/alexanderwebber-brighton-2027
Bb-Api-Subscription-Key: <JUSTGIVING_SUBSCRIPTION_KEY>
User-Agent: alexanderwebber.com-ingest/<version> (+https://alexanderwebber.com)
```

- **Operation**: "Get a fundraising page or claim record by prefix and name", formerly
  `GetFundraisingPageDetailsV2`. The path is `/{prefix}/{pageShortName}`, prefix `page`.
- **Auth**: the subscription key header only. No OAuth, no Blackbaud token, no application
  registration. It answered 200 with the key alone.
- **The key's product matters.** The subscription is to **JustGiving APIs**, not **Standard
  APIs**. A Standard APIs key gets 401 "invalid subscription key" from these endpoints. The alert's
  action text names the right product (R10).
- **Two keys exist** (primary and secondary). Blackbaud recommends, but doesn't require, rotation
  about every 90 days, and keys have no stated expiry. The second key allows a change with no
  downtime. The key is set as the `JUSTGIVING_SUBSCRIPTION_KEY` repo secret and the owner's user
  environment variable.
- **Staging**: the optional header `JustGiving-Realm: staging` selects JustGiving's staging
  environment (same URL and key, separate data, a test payment card).
- **Tier**: Free, 10 calls a second and 1,000 calls a day across all JustGiving APIs (Consumer
  Public, Consumer User and Data together). Over the rate limit gives 429; over the daily quota
  gives 403 until it resets; both carry `Retry-After`. One read per refresh per active campaign is
  about 12 calls a day.
- **Relayed errors**: the reference says a status raised for the resource itself, "such as a page
  that does not exist", is relayed from JustGiving exactly as reported, with its body. So 404 is
  expected for a mistyped page, but it hasn't been seen live; quickstart scenario 3 makes one
  deliberate call to confirm it.
- **Caching**: the response has `Cache-Control: public, max-age=60`, which doesn't matter at this
  cadence.

**Never called**: the API also offers "Get a fundraising page's donations", by ID, prefix and
reference, which return donor details. The adapter has one path template and no way to reach them
(FR-011).

---

## R2. What the live response looks like

The response differs from the reference, so the adapter follows the live shape. It has 48
top-level keys.

| Field | Live value on 2026-10-31 | Use |
|---|---|---|
| `grandTotalRaisedExcludingGiftAid` | `"0"` | **The total** (FR-012). A string |
| `fundraisingTarget` | `"500"` | **The target**. A string. The reference's example also shows a numeric `TargetAmount`, which is **absent from the live response**, so it's never read |
| `donationCount` | `"0"` | **Supporters** (see R8). A string |
| `currencyCode` | `"GBP"` | Checked: anything else is a failed read |
| `status` | `"Active"` | Recorded privately and alerted on (R9) |
| `totalRaisedOnline`, `totalRaisedOffline`, `totalRaisedSms` | `"0"` | Not used; a staging check that they sum to the total |
| `totalRaisedPercentageOfFundraisingTarget` | `"0"` | Not used: the site computes it from the pence (FR-032) |
| `totalEstimatedGiftAid` | `"0"` | **Never read or stored** (FR-010) |
| `currencySymbol` | mis-encoded | Ignored |
| `charity` | object: `id`, `name` "Southern Hospice Group", `registrationNumber` "256789", and more | Not read: the owner's file holds the charity (R12) |
| `expiryDate` | `/Date(1814659199999)/` | Not read (R9) |
| `eventDate` | `/Date(1806796800000)/`, 4 April 2027 | Not read: the race comes from the owner's files |
| `owner`, `ownerGuid`, `consumerId`, `pageId`, `pageGuid`, `campaignGuid`, `eventId`, `ownerProfileImageUrls`, `story`, `image`, `media`, `branding` | present | **Never read or stored** |

The response has no donor data.

---

## R3. Terms

- **JustGiving website terms**: rule out scraping (R0).
- **SKY API Terms of Use** (last updated 18 March 2022), read in full:
  - The licence is personal, "solely for your individual use", and no clause bars individuals.
  - No non-commercial limit was found.
  - The privacy-policy clause is a condition of *distribution* of Applications. This site
    distributes no application and collects no visitor data.
  - No attribution requirement for displayed API data was found; the attribution clause covers
    derived sample code.
  - They give no right to use Blackbaud's trademarks, so the site shows no such logos. Plain text
    such as "Donate on JustGiving" only names the destination.
- **Acceptance**: the owner accepted these terms on 2026-10-31 and took the indemnity decision
  knowingly.

This answers the spec assumption *JustGiving's terms*, which is amended to say so.

---

## R4. Where the read fits in the pipeline

**Decision**: two new CLI commands in two steps, one in each existing job, each with
`continue-on-error: true`, and no state shared with Running.

| Stage | New step | Job | Does |
|---|---|---|---|
| read | `awingest fundraising-read` | `fetch`, before the intervals.icu fetch, `main` only, 3-minute limit | JustGiving -> allow-listed snapshot in R2 |
| publish | `awingest fundraising-publish` | `publish`, after `process`, before `publish-check` | R2 snapshot -> `data/running/published/fundraising/<id>.json` |
| alert | `awingest fundraising-alert` | `fetch`, after the existing `Alert` step | Opens, updates and closes each campaign's issue |

Why this holds up against FR-003, in both directions:

- **The key reaches one step.** `JUSTGIVING_SUBSCRIPTION_KEY` is in that step's `env:` only. The
  `fetch` job runs no npm code, and the `publish` job, which runs npm through the gate, never sees
  the key.
- **A fundraising failure can't turn running off.** `continue-on-error` keeps the job's result
  green, and this matters more than it looks: the `decide` step only skips an idle publish when the
  previous run ended `success`. A red run from a JustGiving outage would make every later run
  publish, and would look like a running failure.
- **A running failure can't turn fundraising off.** The read comes before the intervals.icu fetch,
  so a 25-minute stall or a failed fetch doesn't stop it. The `publish` job already runs after a
  failed fetch, so changed figures still publish.
- **No shared state.** Running's `state/fetch-status.json` and `public/freshness.json` aren't
  touched. Fundraising has `state/fundraising.json` and `public/fundraising-freshness.json`, so
  corrupt fundraising state can't stop a running fetch.
- **Separate processes.** `fundraising-publish` is its own command with its own `PublishedWriter`,
  which writes nothing unless the whole result is valid, so an import error or crash can't take
  `process` with it.

**One limit**: if `process` itself fails (R2 unreachable, an invalid owner file), the `publish` job
stops before fundraising publishes. Those aren't provider read failures: R2 being down stops both
stages anyway, and an invalid owner file must stop the update (FR-024). FR-003 is about reads.

| Alternative | Why rejected |
|---|---|
| A separate `fundraising` job | Stronger on paper, but `decide` needs the summary, and the secret is no safer: the `fetch` job runs only our locked Python. More wiring for no gain |
| A separate workflow on its own schedule | FR-002 asks for no separate schedule, and it would race the bot's commits to `main` |
| Inside `awingest fetch` and `process` | Shares failure paths, exit codes and status documents with Running, which is what FR-003 forbids |
| Passing the snapshot between jobs as an artifact | State has to survive between runs anyway (the last snapshot, failures, back-off), so R2 is needed regardless |

**Decide step**: it reads the read step's summary, and a read whose figures differ from the
published file makes the run publish. See [contracts/pipeline.md](contracts/pipeline.md).

---

## R5. Raw data

**Decision**: no raw archive. The adapter builds a snapshot field by field in memory, and the rest
of the response is dropped there.

Running archives raw payloads so that a parser fix can reprocess history. That benefit doesn't
exist here: each read is three whole figures, and JustGiving can always be read again. The cost
would be real: storing a response holds the owner's account identifiers, and nothing guarantees it
will never hold donor data. FR-011 is stricter than Running ("not stored at all ... publicly or
privately"), and not storing the response is the only way to meet that against future changes on
JustGiving's side.

It is a deliberate exception to the provider contract's Rule 1 ("raw is archived verbatim"), of the
same kind as its Rule 2 (wellness keys dropped before archiving). When a response can't be parsed,
the adapter logs only the response's sorted **key names**, so the failure can still be diagnosed
from a public Actions log.

---

## R6. Idle reads, last-read time and commits

**The problem**: FR-004 needs a last-read time that moves on unchanged reads, and FR-008 and
Running's "idle runs change nothing" rule mean an unchanged read mustn't commit. A fundraising
total can also sit still for weeks, unlike running data, which changes daily. Running's answer
doesn't transfer as it stands: `refresh.json` is rewritten only when data changes, so a build-time
time for fundraising would drift until every no-JS page falsely showed the stale notice.

**Decision**: the same two layers as Running, with two additions.

1. **Live layer, R2 and the Worker.** Reads update `public/fundraising-freshness.json`, served by a
   new route, `GET /running/api/fundraising-freshness`. A small script on the two pages that show a
   campaign takes the later of the live and build times. It is separate from
   `/running/api/freshness`, so neither can fail the other. Sharing that file was rejected for a
   concrete reason: `write_freshness()` rebuilds it from entries with a `last_success_at` and drops
   anything else, and `parseFreshness()` answers 503 unless `intervals` is valid, so a nested
   fundraising entry would be erased by the next running fetch, and a running fault would take
   fundraising's time down with it.
2. **Build layer, the published file.** `last_read_at` in the campaign's file is the fallback for
   no-JS visitors and a failed endpoint. It moves:
   - when the figures change;
   - when the publish stage runs anyway and the committed value is at least **6 hours** old.

   An unchanged read in an idle run skips the publish job, so it makes no commit. The 00:17 UTC
   catch-all always publishes, so a truly idle day gets at most one commit. In practice it adds
   none: the bot already commits 3 to 6 times a day (25 to 31 Oct 2026). The 6-hour rule means a
   bot build never carries a time old enough to bake in a false stale notice, and a real outage
   still shows the notice from the next build.
3. **The live time only moves once the site shows those figures.** This is the first addition. If
   the time moved on every read, a changed read followed by a failed gate or a rejected push would
   say "updated just now" over old figures, which SC-005 forbids. So `last_read_at` means *the last
   time JustGiving's figures were seen to equal the figures the site shows*. A read that finds
   different figures leaves the live time alone and triggers a publish. The published file then
   carries the new figures and their read time, and the next read confirms them. If publishing
   keeps failing, the page goes stale and the alert opens: an honest failure, with no extra code
   path.
4. **Repeated changes don't look like a failure.** On a busy day every read may differ, but each
   publish moves the committed `last_read_at`, and the read step carries that value forward, so the
   alert doesn't fire.

**Accepted edge**: a build from a merged code PR (`gate.yml`) has no fresh read, so more than 12
hours after the last publish its HTML can carry the notice until the script hides it. It needs a
quiet half-day and a code merge, and it corrects itself for anyone with JS.

---

## R7. Money

**Decision**: strict parsing into integer pence, in the adapter.

- A figure must be a string of digits with an optional decimal part, `^\d+(\.\d+)?$`, and any digits
  past the pence must be zero. `"500"`, `"1335.00"` and `"0"` pass. A number type, `""`, `null`,
  `"£5"`, `"1,335.00"`, `"-1"`, `"NaN"` and `"1e3"` are all failed reads, never zero (FR-003).
- It is parsed with `decimal.Decimal`, never `float`, and stored as `*_pence`.
- The total and supporter count are required. `fundraisingTarget` must be present, and `null`, `""`
  or `"0"` means the page has no target (the spec's edge case). A key missing entirely is a failed
  read, because the alternative is a real target vanishing if the API changes.
- **Thousands separators**: whether they appear is unknown, because the page has no donations. The
  reference's example (`"1335.00"`, `"20000.00"`) shows none. Until a real figure says otherwise,
  a comma fails the read, safely, and alerts.
- **Display**: rounded down to the whole pound (FR-063). The percentage is rounded down too:
  £1,250 of £2,000 is 62%, not 63%, and an unreached target can never show 100% (FR-032). The site
  passes `ProgressBar` the floored fraction, because the component rounds (`Math.round(0.625 *
  100)` is 63) and its `aria-valuenow` would otherwise disagree with the words.
- **A drop to zero**: if the total and supporter count are both zero while the published file holds
  non-zero figures, it's treated as a failed read (`suspect_figures`), because string-typed
  defaults make "all zeros" a likely shape for a partial failure. A real refund of every donation
  would alert, and the agent checks it with the owner.

---

## R8. What only real donations can prove

The page has no donations, so two things are open. The plan doesn't assume either.

| Open point | Risk | Test | If it goes the other way |
|---|---|---|---|
| Number format with pence and thousands | Unknown shapes | Staging (quickstart scenario 4): donations totalling over £1,000 | Widen the parser. Until then a read fails safely |
| Does `donationCount` equal the "supporters" figure on the page? The website's own data held both `donationCount` and `aggregatedDonationsCount`; the API offers only `donationCount` | A repeat donor might be counted differently | Staging: two donations from one donor, then compare the page with the API. Then again at the first real donation | Label the figure "donations" (spec assumption *Supporters*) |

The staging check also covers: a page with no target (what `fundraisingTarget` holds), that online,
offline and SMS totals sum to the grand total, and a mistyped page's status. It needs a staging
JustGiving page, which is an owner action (see the plan's *Owner steps*). If staging can't be used,
the first real donation settles both open points, and the parser still fails safely.

---

## R9. Page expiry

`expiryDate` decodes to **3 July 2027, 23:59:59 UTC**, exactly 90 days after race day. FR-023 keeps
reading until the owner marks a campaign finished, so reads could pass that date. What the API does
then isn't known: figures may still come back with another `status`, or the page may answer 404.

**Decision**: the adapter doesn't parse the date. It handles what happens rather than predicting it:

- **Figures still come back**: reads continue, so late totals are kept.
- **`status` isn't `Active`**: the read still succeeds, and a `page_not_active` alert opens at once
  with the action "ask the owner whether to mark the campaign finished". `status` is kept in
  private state only.
- **404**: `page_not_found` opens the same alert at once, even if the page used to work. Figures
  stay, and the stale notice appears after 12 hours.

The spec's *Campaign end* assumption already has the agent prompt the owner once donations stop.
That prompt must land before 3 July 2027, so a campaign is marked finished before Donate could lead
to a closed page. The agent raises it at a session in June 2027 (plan, *Owner steps*).

---

## R10. Errors and alerts

**Decision**: reuse the taxonomy and the issue flow, with JustGiving's own subclasses, because the
base classes' `likely_cause` and `action` texts name intervals.icu.

- `AuthRejected.action`, for example, tells the owner to regenerate a key in intervals.icu, so each
  class gets a subclass with its own stable `code` and texts. `failure_class()` already finds any
  subclass by `code`, once its module is imported, so `alerts.py` must import the new module (as it
  does for the pipeline).
- Mapping: [contracts/provider-adapter.md](contracts/provider-adapter.md). The key points: 401 names
  the **JustGiving APIs** product; **403 with `Retry-After` is the daily quota**, not an auth
  failure; 403 without it is access denied; 404 is `page_not_found`.
- `state.py`'s `source_status()` and `rate_limited_until()`, and `fetch.py`'s `record_failure()`,
  take a document and a key, so they work on `state/fundraising.json` with the campaign ID as the
  key.
- `run_alert()`'s open, comment and close logic moves into a shared function, and `GitHubIssues`
  takes its label as a constructor argument. `LABEL` is hard-coded in four places today.
- **One issue per campaign**, through a label per campaign, `fundraising-failing-<id>`, so
  `open_issue()` needs no matching logic. Campaign IDs are limited to 30 characters to stay within
  GitHub's 50-character label limit.
- **Immediate conditions**: FR-006 alerts at once for a page that can't be found, so `page_not_found`
  and `page_not_active` skip the 24-hour wait. Everything else uses the existing `STALE_AFTER`.
- `logging.py`'s `SECRET_ENV` and `_REDACT_KEYS` must gain the new key's names, or the scrubber
  won't know it.

---

## R11. Privacy of the history

**Finding**: FR-010 forbids publishing individual donation amounts, but consecutive points of a
fine-grained history would publish them by subtraction: total +£20 and supporters +1 between two
reads is a £20 donation at a known time. JustGiving lets donors hide their amount, so this could
expose something a donor chose to keep private.

**Decision**: the published history has **one point per UK day**, with a date and no time of day.
A later change the same day replaces that day's point. The chart is by day anyway, so nothing is
lost, and a day with several donations shows only their sum. FR-008 and the spec's *History
granularity* assumption are amended.

**What remains**: on a day with exactly one donation the amount can still be worked out. Nothing can
remove that while a total is public, and JustGiving's own page total allows the same subtraction.
Whether that's acceptable is the owner's call, so it is raised as a question in the plan.

---

## R12. Campaign data: where each thing lives

| Item | Where | Why |
|---|---|---|
| Campaigns | `data/running/owner/campaigns.yaml` | A list file like `goals.yaml`, so adding one edits one file (FR-020, SC-009) |
| Charity name, website, registered name and number | The campaign's entry | The owner's own words, not read from the API. The number appears only on the fundraising page (owner, 2026-10-31) |
| JustGiving page | `page_url`, the full address | The owner pastes one value. The schema limits it to `https://www.justgiving.com/page/<name>`. The adapter derives prefix and name from it, and the Donate link uses it as it is |
| Target | Nowhere in owner files (FR-021) | Read from the page |
| Story | `data/running/owner/stories/<campaign-id>.yaml` | Long text kept out of the list file, and its absence means no section |
| Figures | `data/running/published/fundraising/<campaign-id>.json` | One file per campaign; no manifest entry is needed, because the input is compared by value, not by hash |

**Section boundaries (Principle VII, FR-064)**: everything sits inside Running: its data tree, its
store, `validateRunning`, its routes and its components. The schemas join `schemas/` beside
Running's (accepted on 2026-10-04). `src/shared/` gains nothing.

**FR-024 needs one small data fix.** `section.yaml` says `Martlets hospice`, while the spec's
acceptance scenarios and the owner's wording say "For Martlets". The check compares exact names, so
the campaign and `section.yaml` must both say `Martlets`, which changes the hero's text and the
landing description slightly. Raised in the plan as an owner confirmation.

---

## R13. Showing the page only once figures exist

**Decision**: `integration.ts` adds the Fundraising area, with its routes, only if a campaign in
`campaigns.yaml` has a published file. `runningAreas` stays the one registry, so the nav, the landing
links and the sitemap all follow.

| Alternative | Why rejected |
|---|---|
| A rest-parameter route whose `getStaticPaths` returns nothing | Works, but hides a plain page behind a routing trick, and the nav would still need the same check |
| Always build the page, and show a message when empty | SC-006: the page must not exist |

The check reads the campaign list and tests for files, rather than loading the whole data tree a
second time, so it stays cheap at 5,000 runs.

---

## R14. The story's approval

**Decision**: approval is recorded with the text and checked in the gate.

```yaml
approved:
  date: 2026-11-20
  text_sha256: <hash of the text field>
```

A date alone would survive a later edit, so a changed sentence would publish as "approved". With the
hash, `validateRunning` stops an edit that wasn't re-approved, which gives SC-007 ("100% of published
story text matches the owner-approved version") a real check. A missing `approved` block fails the
schema with an owner-facing message. The hash covers the parsed text, so line endings don't matter.
The agent writes the block only after the owner's explicit approval, with a small script.

Drafts stay out of the repository altogether (FR-055), so these checks are a backstop for a mistake,
not a draft workflow. `VOICE.md` is written when the story is approved, in a session. No code depends
on it.

Principle II(b)'s eval suite isn't built: the spec's assumption stands, because nothing on the live
site drafts text.

---

## R15. Dependencies

**None added.** The ingest client uses the standard library (`urllib.request`, `decimal`), as the
intervals.icu client does. The chart uses `LineChart`, the bar `ProgressBar`, the share image
`ogEndpoint`, and the story is plain paragraphs, so no Markdown library is needed. The HTTP helpers
in `providers/intervals/client.py` that both clients need (`_urllib_transport`, `_retry_after`) move
to `providers/http.py`.

---

## R16. Existing code that needs care

Found while reading the code; each is easy to trip over during implementation.

| Where | Trap |
|---|---|
| `refresh.yml`, `decide` | A failed fundraising step must not turn the run red (R4) |
| `fetch.py`, `write_freshness()` | Drops entries without `last_success_at`, so fundraising can't share the file (R6) |
| `logging.py` | The new secret must be added, or logs won't scrub it (R10) |
| `alerts.py` | The new error module must be imported, or `failure_class()` can't find its texts (R10) |
| `ProgressBar.astro` | Rounds rather than floors, so pass a floored fraction (R7) |
| `manifest.py` `LAYOUT`, `files.ts` `schemaForFile` | Both reject unknown published files, so both need the new path; so does `RUNNING_SCHEMAS` |
| `styles/goal-card.css` | Add `.fundraising-card` to the shared selectors rather than reuse `.goal-card`, so the card shares the look but stays its own (FR-031) |
| `Hero.astro` | Its `For <charity>` line would repeat the card's. Drop it when the card is in the slot |
| `LastUpdated.astro` | Its `.stale-notice` styles are scoped, so the fundraising block needs them moved to `styles/theme.css` |
| Landing performance | The landing page sat near 90 on the 2-core CI runner on 24 Oct, and its cost was a script that rewrote text on load. The new script changes the text only when the live time is newer than the build's (AGENT_TIPS, *Astro*) |
