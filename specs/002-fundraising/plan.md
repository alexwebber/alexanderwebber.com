# Implementation Plan: Fundraising

**Branch**: `002-fundraising-plan` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-fundraising/spec.md`

## Summary

Add fundraising to the Running section, as a campaign linked to a race, starting with Brighton
Marathon for Martlets. The site shows the total against the target and the supporter count, on a
landing card and at `/running/fundraising/`, with a Donate link to JustGiving.

Figures come from JustGiving's official API (Blackbaud SKY API, "JustGiving Consumer Public"), proven
live with the owner's key on 2026-10-31. Reading the website is ruled out by JustGiving's terms. The
feature extends the existing refresh rather than adding a pipeline:

1. **read**: a new step in the `fetch` job, the only place holding the JustGiving key, writes an
   allow-listed snapshot to R2. No raw response is stored anywhere, because FR-011 forbids storing donor
   data and the figures can always be read again.
2. **publish**: a new step in the `publish` job writes one JSON file per campaign to git, with one point
   per day, and the existing gate, bot commit and deploy carry it to the site.
3. **render**: the card and page are built from those files, with a freshness route and script for the
   last-read time, separate from Running's.

Both new steps are `continue-on-error` and share no state with Running, so a failed read on either side
can't reach the other (FR-003). The gate is shared, and a failed `process` stops fundraising's publish step
(research.md R4). An unchanged read makes no commit. There are no new dependencies and no recurring
cost.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (Astro 7.4.2, Node >= 22.23.4) for the site and Worker; Python
>= 3.12 for ingest. Unchanged from Running.

**Primary Dependencies**: none added ([research.md](research.md) R15). The client uses the standard
library (`urllib.request`, `decimal`), as the intervals.icu client does. It reuses `ProgressBar`,
`LineChart`, `ChartFigure` and `ogEndpoint`.

**Storage**: private R2 `state/fundraising.json` (snapshot and read status), R2
`public/fundraising-freshness.json` (the Worker's last-read times), git
`data/running/published/fundraising/<id>.json`, and owner YAML `campaigns.yaml` and
`stories/<id>.yaml`. All go through the existing `RawArchive`, `PublishedWriter` and `RunningStore`.
See [data-model.md](data-model.md).

**Testing**: pytest contract tests against hand-written fixtures in the live shape, Vitest for the
domain, validation, Worker and a static workflow check, Playwright and axe over preview routes, the
extended stale drill, and Lighthouse. A staging check for what only real donations can prove
([quickstart.md](quickstart.md) §4).

**Target Platform**: as Running: Cloudflare Workers static assets plus the one Worker, and GitHub
Actions.

**Project Type**: an extension of the existing web application. No new project.

**Performance Goals**: landing and fundraising pages at 90 or more on mobile Lighthouse (SC-010);
a donation shown within 3 hours in 95% of cases and within 30 minutes of a manual refresh (SC-002).

**Constraints**: client JS at most 10 KB per page (the new script is under 1 KB, on two pages); each page
at most 150 KB of HTML, CSS and JS; no third-party request on any page; WCAG 2.2 AA; the free API tier
of 1,000 calls a day, of which a campaign uses about 12; the JustGiving key in one workflow step only.

**Scale/Scope**: one active campaign at a time, a handful over the years. One point per day at most, so
a year of a campaign is under 366 rows, and usually far fewer.

**Recurring costs**: **$0**. SKY API Free tier; R2 and Workers remain far inside their free tiers (a few
more small objects, one more route); GitHub Actions is free for this public repo. No paid service is
needed.

**Unknowns**: none left as NEEDS CLARIFICATION. What only real donations can settle (number format, and
`donationCount` against the page's supporters) has a defined test and a safe failure ([research.md](research.md)
R8).

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

| Principle or bar | Assessment | Evidence in design |
|---|---|---|
| I. Move fast, spike first | PASS | The live API call on 2026-10-31 served as the spike. No further spike is needed |
| II(a) Contract tests at graduation | PASS | Adapter, read and publish rules, schemas, referential checks, Worker route, workflow isolation |
| II(b) Eval suite for AI decisions | N/A, by spec assumption | Nothing on the live site drafts text. The story is a one-off drafted in a session and approved by the owner. The CV & Blog spec needs the suite; if the owner agrees, this pair can be its first example |
| II(c) Error handling and logging | PASS | Classified failures, each with cause and action; JSON-lines logs; the new secret added to the scrubber; on a parse failure, key names only |
| III. Own your data | PASS, one note | Ingest, store, render; no visitor request touches JustGiving; Donate is a plain link. The published file keeps one point a day, because the chart is by day; earlier figures from the same day stay in git history (research.md R11) |
| IV. Pluggable providers and storage | PASS | `FundraisingProvider` protocol, one adapter folder; existing storage abstractions; a provider failure only causes staleness. The adapter contract's Rule 1 (raw archived verbatim) is replaced for this provider by "no raw stored", for FR-011 |
| V. Serverless, gracefully degrading | PASS | **The rule on live-ish values applies directly**: figures are cached in git and fall back to the last known. No new server. Reads ride the 2-hourly refresh and manual trigger. Every view shows its own last-read time, with a stale notice at 12 hours, and renders without JS |
| VI. Privacy by default | PASS | New public figures approved in the spec. Allow-list adapter, no raw storage, strict schema, scan rules, sentinel test. Secret in one step. Figure changes stay in public git history, accepted by the owner (research.md R11). Nothing from JustGiving but three figures reaches git. Repo stays publishable: story text enters only after approval |
| VII. Modular sections | PASS | Inside Running (FR-064): its data tree, store, validation, routes, components. `src/shared/` gains nothing. Schemas sit in top-level `schemas/`, the accepted bend from 2026-10-04 |
| VIII. Authentic voice | PASS | The story is published only with a recorded approval tied to its text by a hash, enforced in the gate. Facts come from the owner or stored data. `VOICE.md` is created at approval. Family passages are written by the people they belong to |
| Mobile-first and fast | PASS (budget set) | Budgets above. The freshness script changes text only when the build's value is out of date |
| Accessible | PASS (verification planned) | Bar with text value, chart with summary and table, keyboard-reachable, axe across all states |
| SEO and social previews | PASS | Own title, description and share image for the page; the landing image is unchanged |
| Graceful degradation | PASS | See V. Figures, Donate, summary and table are all in the built HTML |
| Visualisations first | PASS | Progress bar and chart lead; text supports |
| Tech constraints | PASS | Astro on Cloudflare; Python ingest on Actions; recurring cost noted ($0) |
| Build gate from day one | PASS | New schema, referential and privacy rules run in the existing gate. An invalid campaign or unapproved story stops the update |
| Broader CI deferred | PASS | Existing path-filtered `tests.yml`; its Vitest filter gains `.github/workflows` for the workflow check |

**Gate result: PASS, no violations.** Complexity Tracking lists the choices worth the owner's eye.

### Post-design re-check (after Phase 1)

Re-checked against [data-model.md](data-model.md) and [contracts/](contracts/): all rows still PASS.
Design tightened three points. The published file became daily, because a per-change history would
reveal individual donations by subtraction (FR-010). `/speckit-analyze` later found that git history records
each change anyway, and the owner accepted that (research.md R11). The live last-read time moves only once the
site shows those figures, so a failed publish can't claim fresh data (SC-005). And story approval is tied
to the text by a hash, so an edit after approval stops the gate (SC-007).

## Design answers

Each has a recommendation, and the fuller reasoning is in [research.md](research.md).

1. **Where the read fits** (R4). Recommended: a step in the existing `fetch` job, before the intervals.icu
   fetch, and a step in the `publish` job after `process`, both `continue-on-error`. The key is in one
   step's `env:` only, and `fetch` runs no npm code. `continue-on-error` is essential, not cosmetic: a red
   run would make `decide` publish on every later run, and would look like a running failure. Reading first
   means a stalled running fetch can't stop it. The `decide` step gains one reason: "fundraising figures
   changed".
2. **Raw data** (R5). Recommended: no raw archive. An allow-listed snapshot is built in the adapter and
   the rest is dropped. Reprocessing brings nothing here, and FR-011 is stricter than Running's rule.
3. **Idle reads and commits** (R6). Recommended: the same two layers as Running, each with its own file.
   The Worker serves `public/fundraising-freshness.json` at a new route, and it moves on any matching read
   without a commit. The published file's `last_read_at` moves when figures change, or when a publish
   runs anyway and it is 6 hours old. So an unchanged read in an idle run commits nothing, and an idle day
   gets at most one commit, at the 00:17 catch-all; the bot already commits 3 to 6 times a day. The rules
   are per campaign and separate from running data (FR-004 to FR-006). `last_read_at` means "last seen to
   match what the site shows", so a failed publish goes stale rather than claiming fresh data.
4. **Data model and files** (R12). Recommended: `campaigns.yaml` (a list), `stories/<id>.yaml`, and
   `published/fundraising/<id>.json`. The charity number lives in the campaign's owner entry. Pence are
   integers. `validateRunning` checks FR-024's charity agreement and a campaign's link to a known race.
   All of it stays inside Running.
5. **Provider boundary** (R10, [contracts/provider-adapter.md](contracts/provider-adapter.md)). Recommended:
   `providers/justgiving/`, parallel to `providers/intervals/`, with shared HTTP helpers moved to
   `providers/http.py`. Subclasses of the existing errors carry JustGiving's own texts, because the base
   classes name intervals.icu. 401 names the **JustGiving APIs** product; 403 with `Retry-After` is the
   daily quota; 404 is "page can't be found"; 429 backs off.
6. **Alerts** (R10). Recommended: one issue per campaign, label `fundraising-failing-<id>`, on the shared
   open, comment and close logic, from a separate step without the JustGiving key. A missing or inactive
   page alerts at once; anything else after 24 hours.
7. **UI** ([contracts/routes.md](contracts/routes.md)). Recommended: `FundraisingCard` fills the hero's
   `fundraising` slot and shares `styles/goal-card.css` through a new selector. `FundraisingPage` holds the
   current campaign, story, `LineChart` with table, and past campaigns. The menu entry and routes are added
   only when a campaign has figures. After-race and finished states are in the card's table. The story's
   approval is checked in the gate. `/fundraising-preview/<state>/` under `SHELL_PREVIEW=1` shows the 13
   states that can't exist yet.
8. **Privacy scan and gate** ([contracts/data-files.md](contracts/data-files.md)). Recommended: four
   layers, because a scan can't recognise a person's name: the allow-list with a sentinel test, no raw
   storage, the strict schema, and two new `scan-privacy` rules covering donor, Gift Aid and account keys
   (`totalEstimatedGiftAid`, `ownerGuid`, `consumerId`, `pageId`, `pageGuid`) and Gift Aid figures on pages.
9. **Testing** ([quickstart.md](quickstart.md)). Recommended: fixtures hand-written in the live shape
   (strings, no `TargetAmount`), a local staging check, one deliberate mistyped-page call, and an extended
   `stale.spec.ts` drill for SC-003, including each freshness failing alone.
10. **Performance and cost**. Budgets are in Technical Context. Expected cost $0 on the free tier.

## Project Structure

### Documentation (this feature)

```text
specs/002-fundraising/
├── spec.md              # amended by this plan
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit-tasks), not created here
```

### Source Code (changes to the repository)

```text
schemas/
├── owner/campaigns.schema.json, campaign-story.schema.json          # new
├── published/fundraising-campaign.schema.json                       # new
└── fixtures/...                                                     # new valid and invalid fixtures
ingest/src/awingest/
├── cli.py                                # fundraising-read, -publish, -alert
├── alerts.py                             # shared issue logic; GitHubIssues takes a label
├── logging.py                            # scrub the new key
├── state.py                              # FUNDRAISING_STATE, FUNDRAISING_FRESHNESS keys
├── fundraising/                          # new
│   ├── campaigns.py                      #   reads and validates campaigns.yaml
│   ├── read.py                           #   the read stage
│   ├── publish.py                        #   the writing rules
│   └── alerts.py                         #   per-campaign assessment
├── providers/
│   ├── base.py                           # FundraisingProvider, FundraisingSnapshot
│   ├── http.py                           # new: helpers moved from intervals/client.py
│   └── justgiving/{__init__,client,parse,errors}.py     # new: the only JustGiving-aware code
└── publish/manifest.py                   # LAYOUT gains fundraising/
src/worker/
├── freshness.ts                          # dispatches the new route
├── fundraising-freshness.ts              # new
└── respond.ts                            # new: shared by both routes, so neither imports the other
src/sections/running/
├── integration.ts                        # the conditional fundraising area
├── validate.ts                           # the referential checks
├── data/
│   ├── fundraising.ts                    # new: loadFundraising(today, store)
│   ├── landing.ts                        # adds the current campaign
│   └── store/                            # schemas, files, RunningStore, JsonFileStore
├── domain/fundraising.ts                 # new: pure: pounds, progress, phase, chart points
├── components/
│   ├── FundraisingCard.astro             # new
│   ├── FundraisingFigures.astro          # new: shared by card and page
│   ├── FundraisingUpdated.astro          # new: last-read line, notice, script
│   ├── FundraisingPage.astro             # new
│   ├── CampaignStory.astro               # new
│   ├── PastCampaigns.astro               # new
│   └── Hero.astro                        # drops its charity line when the slot is filled
├── pages/{index,fundraising}.astro       # fills the slot; new page
├── og/fundraising.png.ts                 # new
└── styles/{goal-card,theme}.css          # shared selector; stale-notice styles moved
scripts/
├── scan-privacy.ts                       # two rules
├── approve-story.ts                      # new: writes approved.date and text_sha256
└── lighthouse-budget.mjs                 # the new page type
data/running/owner/
├── campaigns.yaml                        # new, Brighton
├── section.yaml                          # charity name becomes Martlets
└── stories/                              # empty until a story is approved
tests/
├── fixtures/fundraising-preview/         # new
├── e2e/{fundraising,fundraising-none,stale}.spec.ts   # new; the drill extended
├── a11y/fundraising.spec.ts              # new
├── contract/refresh-workflow.test.ts     # new
└── unit/                                 # domain, validation, Worker, card states
ingest/tests/
├── contract/test_justgiving_adapter.py   # new
├── unit/test_fundraising.py              # new
└── fixtures/justgiving/                  # new, synthetic
.github/workflows/refresh.yml             # three steps, one decide reason
.github/workflows/tests.yml               # the Vitest filter covers workflows
astro.config.mjs                          # the preview routes
```

**Structure Decision**: no new project or section. Fundraising is part of the Running section, and its
ingest code joins `awingest`, with the same split between provider, stage and storage.

### Graduation plan (Principle I and II)

| Unit | Graduation bar delivered with it |
|---|---|
| JustGiving adapter | Design note ([contracts/provider-adapter.md](contracts/provider-adapter.md)), contract tests with sentinels, error mapping, logging |
| Read and publish stages | Rule-by-rule tests with a fixed clock, failure isolation tests, the static workflow check |
| Freshness route | Contract, re-shaping and failure tests, as for `/running/api/freshness` |
| Fundraising UI | e2e, axe and performance budgets across all preview states; the stale drill; an adversarial self-review |

### Delivery order (input to /speckit-tasks)

Each slice can be its own PR. The owner reviews the visible ones on the live site.

1. **Data and reading**: schemas, adapter, read stage, alerts, workflow steps, `publish` stage, Brighton in
   `campaigns.yaml`. Nothing shows on the site yet, because no UI reads the file, but real reads and the
   history start.
2. **Staging check** (needs the owner) and the first adjustments to the parser.
3. **US1, landing card**, with the freshness route, script and previews.
4. **US2, fundraising page**, chart, share image, menu entry, and past campaigns.
5. **US3, story**: the schema, gate check, section and `approve-story.ts`. The real story joins whenever
   it's approved, in its own PR.
6. **US4, after race and later campaigns**: the remaining card states, proven on previews.
7. **Polish**: the SC-003 and SC-006 drills, privacy-scan proof, Lighthouse, an adversarial review.

## Owner steps

What the plan needs from the owner, folded into reviews:

| When | Step |
|---|---|
| Delivery slice 2 | Create staging test pages and donations, guided (about 15 minutes) |
| When Martlets replies | Logo and conditions. A small follow-up; nothing waits for it |
| When the reviewers reply | The approved story, pasted into JustGiving too, then `VOICE.md` |
| Each UI PR | Phone and desktop review on the live site or in previews |
| June 2027 | The agent asks whether to mark Brighton finished, before the page expires on 3 July 2027 |

## Owner decisions

Settled by the owner on 2026-10-31, each on the recommendation.

1. **The chart shows one total per day, and figure changes stay in public git history.** Each change the
   2-hourly read finds becomes a bot commit, so a commit's diff can show a single donation by subtraction,
   as watching JustGiving's own public total can. The owner accepted this rather than commit once a day
   (a redesign, with figures up to a day old without JS) or publish less often (which misses SC-002).
   Commits hold the total, target and supporter count only (research.md R11).
2. **`section.yaml`'s charity name changes from "Martlets hospice" to "Martlets"**, so FR-024's agreement
   holds and the card reads "For Martlets". The hero's text and the landing description change slightly.
3. **The card goes live as soon as it's built**, at "£0 raised of £500" and "No supporters yet", because a
   Donate button is the point and the story isn't needed for it. Until the story is approved, Donate leads
   to the JustGiving page with its holding text.
4. **The hero drops its "For Martlets" line while the card is showing**, because the card directly below
   says the same. The line returns when no card is shown.

## Complexity Tracking

> No constitution violations. Items below are deliberate choices the owner may want to review.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A second freshness route and file | Keeps Running and fundraising unable to fail each other (FR-003) | Sharing `public/freshness.json`: the current writer erases nested entries, and its parser answers 503 unless `intervals` is valid (research.md R6) |
| "Last read" moves only once figures match the site | SC-005: the time shown must describe the figures shown | Moving it on every read: a failed publish would show old figures as just updated |
| 6-hour rule for the committed `last_read_at` | Bot builds never bake in a false stale notice, and idle runs stay commit-free | A commit on every read: 12 a day. Only at the daily catch-all: afternoon builds would show a false notice |
| Story approval carries a text hash | A date alone survives a later edit (SC-007) | A flag or date only: a changed sentence would still count as approved |
| Conditional area in `integration.ts` | SC-006: the page must not exist before figures do | An empty page, or a routing trick with an empty `getStaticPaths` |
| One GitHub label per campaign | `open_issue()` stays a label lookup, and each campaign has its own issue | One label with title matching: more code for the same result |
