---

description: "Task list for Fundraising (002-fundraising)"
---

# Tasks: Fundraising

**Input**: Design documents from `/specs/002-fundraising/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (README, provider-adapter,
pipeline, data-files, routes), quickstart.md

**Tests**: Test tasks ARE included. The constitution (Principle II(a)) and plan.md's *Graduation
plan* require solid contract coverage **by graduation**. Tests are written **alongside or straight
after** implementation. Test-first/TDD is NOT required, so test tasks come after the code they cover
in each phase. Suites run locally and on PRs through the path-filtered `tests.yml` jobs. They are
**not** part of the build gate, which stays site build + data-schema validation, with the privacy
scan, image scan and boundary check as validation steps.

**Owner decisions reflected here (2026-10-31, plan.md *Owner decisions*)**:

1. The chart shows one total per day, and figure changes stay in public git history (research.md
   R11; the owner accepted this after `/speckit-analyze`).
2. `section.yaml`'s charity name changes from "Martlets hospice" to "Martlets" (T024).
3. The card goes live as soon as it is built, at "£0 raised of £500" and "No supporters yet", before
   the story if need be.
4. The hero drops its "For Martlets" line while the card is showing (T052).
5. The charity number shows on the fundraising page only: "Part of Southern Hospice Group, registered
   charity 256789" (T068).

**Organization**: Each phase is one PR-sized slice, in plan.md's *Delivery order*, and one session.
Each phase header says what goes live, how the owner views it and whether it needs the owner.
Owner steps are tasks marked **(owner, guided by the agent)**: the agent prepares everything around
them and folds them into reviews the owner is already doing. Date-triggered and reply-triggered
follow-ups are agent tasks in *Standing follow-ups*, written into `PROJECT_MEMORY.md`'s *Next session*
block so nothing depends on the owner remembering.

**Task IDs** are this feature's own. T149 and the like in `PROJECT_MEMORY.md` refer to
`specs/001-running-section/tasks.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story the task belongs to (US1–US4, numbered as in spec.md)
- **(owner, guided by the agent)** marks a task that needs the owner
- **BLOCKED** marks a task that waits on someone else's reply. No other task depends on one

## Path Conventions (from plan.md)

- Site (TypeScript/Astro): `src/sections/running/**`, `src/worker/*.ts`, `astro.config.mjs`.
  `src/shared/` gains nothing (FR-064, Principle VII)
- JSON Schemas (single source of truth): `schemas/owner/`, `schemas/published/`, `schemas/fixtures/`
- Data: `data/running/owner/` (hand-edited YAML), `data/running/published/fundraising/` (bot-written)
- Ingest (Python, uv): `ingest/src/awingest/**`, `ingest/tests/**`
- Tooling scripts: `scripts/`; TS tests: `tests/{unit,contract,e2e,a11y}/`
- Previews: `tests/fixtures/fundraising-preview/`
- Workflows: `.github/workflows/`

## User stories and phases

The phase numbers don't match the story numbers, because two delivery slices come before the first
story. Story numbers and titles are spec.md's own.

| Phase | Delivery slice (plan.md) | User story (spec.md) | Priority | Needs the owner? |
|---|---|---|---|---|
| 1 Setup | Part of slice 1 | None | | No |
| 2 Foundational | 1. Data and reading | None (blocks all) | | No |
| 3 Staging check | 2. Staging check | None | | **Yes**, guided, about 15 minutes |
| 4 | 3. Landing card | US1 Fundraising card on the landing page | P1 | Phone and desktop review |
| 5 | 4. Fundraising page | US2 The fundraising page | P2 | Phone and desktop review |
| 6 | 5. Story | US3 Why I'm running for Martlets | P2 | Preview review. The real story is a follow-up |
| 7 | 6. After race and later campaigns | US4 After race day, and later campaigns | P3 | Preview review |
| 8 Polish | 7. Polish | Cross-cutting | | A short check folded into the review |

## The PR routine (every phase that raises a PR)

Referred to below as **the PR routine**:

1. `git fetch`, branch from `origin/main`, and read the matching `AGENT_TIPS.md` sections first
   (*GitHub Actions*, *Privacy and data pipelines*, *Astro*, *End-to-end testing*, *Share images*,
   *Cloudflare*, *UI and accessibility*, as the phase needs them).
2. Run the suites the phase touches: `cd ingest; uv run ruff check .; uv run pytest`; `npm test`;
   `npx astro check`; and, from PowerShell, a `SHELL_PREVIEW=1` build and `npm run e2e` on **both**
   Playwright projects. A deploy build (no `SHELL_PREVIEW`) follows for the gate commands
   (`validate-data`, `scan-images`, `check-boundaries`, `scan-privacy`).
3. Look at phone-width screenshots of everything visible before raising the PR, and put them in it.
4. The PR body has a *How to view it* section (the phase header's text, with the exact URLs) and
   checkbox questions for anything the owner must confirm.
5. Before saying the PR is ready, `gh pr checks` shows every check green, not just the required ones.
6. After the merge, wait for `main`'s own Gate run to finish, deploy included, and confirm the deploy
   before pointing the owner at the site. If a box was left unanswered, ask at the next session start.
7. Update *Next session* and the decisions log in `PROJECT_MEMORY.md`, add any lesson to *Upstream
   candidates*, log the phase's token cost, and tell the owner it's a good point for a new session.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Very little is needed: the stack, secret and page all exist. These two tasks ride in
Phase 2's PR.

**Goes live**: nothing. **How to view it**: nothing to view. **Needs the owner**: no.

- [X] T001 In `.github/workflows/tests.yml`, add `\.github/workflows` (no trailing slash, because the group's `/` follows it) to the first alternation of the `vitest=$(match '...')` regex, giving `^((src|schemas|scripts|tests/unit|tests/contract|tests/helpers|\.github/workflows)/|...`, so a change to `refresh.yml` runs `tests/contract/refresh-workflow.test.ts` (contracts/pipeline.md). Every other new test location is already covered: `ingest/` and `schemas/` by pytest; `tests/unit/`, `tests/contract/`, `scripts/`, `src/` and `schemas/` by Vitest; `tests/e2e/`, `tests/a11y/`, `tests/fixtures/` and `data/running/owner/` by Playwright
- [X] T002 [P] Confirm the prerequisites in quickstart.md §0 without printing a value: `gh secret list` shows `JUSTGIVING_SUBSCRIPTION_KEY`, the user environment variable of that name is non-empty (test its length only), and `.gitignore` covers `ingest/.archive/`. No file changes

**Checkpoint**: the Vitest filter covers workflows.

---

## Phase 2: Foundational (delivery slice 1: data and reading)

**Purpose**: Schemas, the JustGiving adapter, the read, publish and alert stages, the workflow steps,
Brighton in `campaigns.yaml` and the charity name change. Every user story needs it. Real reads and
the history start here.

**Goes live**: no fundraising UI, because no page reads the new file. The one visible change is the
hero's charity line and the landing description, which now say "Martlets" (owner decision 2).

**How to view it**: https://alexanderwebber.com/running/ on a phone and a desktop: the hero reads "For
Martlets". The figures aren't visible yet; after the merge the agent reports the Actions run where the first
read landed, and the bot's commit of `data/running/published/fundraising/brighton-2027.json`.

**Needs the owner**: no. **Not built yet**: everything visitors see.

**Critical**: No user story work can begin until this phase is complete.

### 2a. Schemas and registration

- [X] T003 [P] Create `schemas/owner/campaigns.schema.json`: draft 2020-12, `$id` `https://alexanderwebber.com/schemas/owner/campaigns.schema.json`, title `Campaigns`, `type: array`, items title `Campaign`, `additionalProperties: false` (a list file, so no `schema_version`), required `id`, `race_id`, `charity`, `page_url`. Fields (data-model.md §5, verbatim): `id` "Slug, at most 30 characters (it forms a GitHub label)" (`$ref` defs `slug` plus `maxLength: 30`); `race_id` slug; `charity` a closed object with `charity.name` "Required", `charity.url` "Optional, `https://`" (defs `url`), and `charity.registered` "Optional. `name` and `number` together: the legal charity" (a closed object requiring both; `number` is a string, e.g. `"256789"`); `page_url` "Required, `^https://www\.justgiving\.com/page/[a-z0-9-]+$`", with an `x-error`; `finished` "Optional boolean, default false". There is no target property: a `target` key must fail with an `x-error` saying that the target is read from JustGiving (FR-021), e.g. `"target": { "not": {}, "x-error": "...", "tsType": "never" }` (FR-020, FR-021)
- [X] T004 [P] Create `schemas/published/fundraising-campaign.schema.json`: draft 2020-12, `$id` `https://alexanderwebber.com/schemas/published/fundraising-campaign.schema.json` (`SchemaSet` reads `$id`, so a missing one breaks every Python stage), title `CampaignFigures`, `additionalProperties: false` throughout, required `schema_version` (defs `publishedSchemaVersion`), `campaign_id` (defs `slug`, `maxLength: 30`), `last_read_at` (defs `utcTimestamp`), `points`. `points`: "At least one, sorted by `date`, unique per day" (`minItems: 1`; sorting and uniqueness are checked in T007 and T008). Each point: `date` (defs `date`, "Europe/London date of the read. **No time of day**"), `raised_pence` and `supporters` "Integers >= 0", `target_pence` "Integer > 0; omitted when the page has no target". Only these fields can validate, so a donor name, amount, message, Gift Aid figure or account identifier can't be written (FR-008, FR-010)
- [X] T005 [P] Add shared fixtures, read by both languages (`tests/contract/schemas.test.ts` requires at least one valid and one invalid per schema, and rejects fixtures of unknown schemas): `schemas/fixtures/owner/campaigns/valid/` (minimal; full with `url`, `registered` and `finished: true`), `schemas/fixtures/owner/campaigns/invalid/` (a `target` key; `page_url` with `http://`, another host, capitals, or a trailing slash; a 31-character `id`; `registered` with only `name`; an unknown key), `schemas/fixtures/published/fundraising-campaign/valid/` (with target; a point without `target_pence`), `schemas/fixtures/published/fundraising-campaign/invalid/` (a `donorName` key; `totalEstimatedGiftAid`; a `date` with a time of day; `target_pence: 0`; a non-integer amount; empty `points`; no `schema_version`). All values made up
- [X] T006 Register the new files with the site (each rejects unknown files or schemas today; contracts/data-files.md *Where these are registered*): in `src/sections/running/data/store/schemas.ts` add `published/fundraising-campaign` and `owner/campaigns` to `RUNNING_SCHEMAS` (`owner/campaign-story` joins in T083, with its fixtures, because the schema test rejects fixtures of unknown schemas); in `src/sections/running/data/store/files.ts` add the `schemaForFile` rules `^published\/fundraising\/[^/]+\.json$` and `^owner\/campaigns\.yaml$`, `RunningData.fundraising: Loaded<CampaignFigures>[]` and `RunningData.campaigns: Loaded<Campaign[]> | undefined`, the matching `store()` cases, `LIST_NOUNS['owner/campaigns'] = 'campaign'`, and `locate()`'s `named` entry `'published/fundraising-campaign': ['campaign figures', 'campaign_id']`; in `src/sections/running/data/store/running-store.ts` export `Campaign` and `CampaignFigures`, add `OwnerData.campaigns: Campaign[]` and `getCampaignFigures(): Promise<CampaignFigures[]>`; implement both in `src/sections/running/data/store/json-file-store.ts`. An absent file means no campaigns or no figures. Add `getCampaignFigures: async () => []` and `campaigns: []` to the six hand-written fakes typed `: RunningStore` in `tests/unit/{goal-cards,health,race-pages,shell-components,landing,training}.test.ts`: `tsconfig.json` includes `tests/`, and `astro check` is part of `npm run build`, so without them the gate turns red and every refresh is blocked
- [X] T007 Add the campaign and figures checks to `validateRunning` in `src/sections/running/validate.ts`, in Running's `file / entry / field` format (FR-024, FR-070 of spec 001). Errors: campaign `id` unique; `race_id` unique across campaigns; `page_url` unique; `race_id` is an `upcoming-races.yaml` id or a `races/` slug; `charity.name` equals `focus_race.charity.name` for the focus race's campaign, with the contract's text `data/running/owner/campaigns.yaml  campaign "brighton-2027"  field charity.name: "Martlets" differs from section.yaml focus_race.charity.name "Martlets hospice"; the hero and the card would name different charities`; a published file's `campaign_id` equals its file name; `points` sorted, one per date, none after `today`. Warnings: "A published file with no campaign" ("its history is kept and not shown"), and "A `finished` campaign with no published file" ("it would never appear"). The owner-file provider-ID scan covers the new file unchanged (the charity number is 6 digits, below its 9-digit rule). Story checks join in T084
- [X] T008 In `ingest/src/awingest/publish/manifest.py`, add `(re.compile(r"^fundraising/[a-z0-9-]+\.json$"), "published/fundraising-campaign")` to `LAYOUT`, and extend `check_published`, before its `manifest is None` return, so `publish-check` reports a `campaign_id` that differs from the file name and `points` that aren't sorted and unique. Values are never quoted (contracts/pipeline.md)

### 2b. The JustGiving adapter (the only JustGiving-aware code, FR-007)

**Reference: JustGiving failure classes** (contracts/provider-adapter.md *Errors*, verbatim; T011 uses
these exact texts).

| Class (parent) | `code` | Exit | `likely_cause` | `action` |
|---|---|---|---|---|
| `KeyRejected` (`AuthRejected`), 401, no key set, or a key with a character a header can't carry | `justgiving_key_rejected` | 10 | The subscription key is missing, lapsed or regenerated, was stored with a stray character (a BOM or newline), or belongs to the wrong product. A **Standard APIs** key gets 401 here; it must be a **JustGiving APIs** subscription | The agent asks the owner to copy the primary or secondary key from their SKY API developer account (*Subscriptions*, product **JustGiving APIs**) into the local secrets file, then runs `gh secret set JUSTGIVING_SUBSCRIPTION_KEY --body <value>` (a PowerShell pipe adds a BOM). If the local key still works, it only re-sets the secret. No retry loop |
| `QuotaExhausted` (`RateLimited`), 403 with `Retry-After` | `justgiving_quota` | 11 | The daily quota is used up (1,000 calls across all JustGiving APIs) | Wait: back-off is automatic. If it recurs, the agent looks for what else uses the key |
| `AccessDenied` (`ProviderForbidden`), 403 without it | `justgiving_forbidden` | 12 | The key is valid but this API or page is refused | The agent compares a local call and checks the subscription |
| `PageNotFound` (`ProviderError`), 404 | `page_not_found` | 15 | The address in `campaigns.yaml` is mistyped, or the page has closed or expired | The agent checks `page_url` with the owner. If the campaign has ended, it marks it `finished`. Alerted at once (FR-006) |
| `JustGivingChanged` (`ProviderChanged`), a parse failure, wrong currency, other statuses | `justgiving_changed` | 13 | The response changed shape | The agent checks the API reference and changelog and fixes `providers/justgiving/`. The site stays on the last good figures |
| `SuspectFigures` (`JustGivingChanged`), read stage | `suspect_figures` | 13 | A partial failure, or every donation was refunded | The agent compares with the JustGiving page and asks the owner if they really are zero |
| `PageNotActive` (`IngestError`), read stage | `page_not_active` | | The page has expired or closed | The agent asks the owner whether to mark the campaign finished. Alerted at once |
| `FiguresUnpublished` (`IngestError`), read stage | `figures_unpublished` | | The publish stage, gate or commit is failing | The agent reads the failing refresh runs |

429 stays the shared `RateLimited` (`rate_limited`, exit 11), and a network error or 5xx the shared
`Transient` (`transient`, exit 1).

- [X] T009 Create `ingest/src/awingest/providers/http.py` by moving `Response`, `Transport`, the urllib transport, `_retry_after` (both public now) and `USER_AGENT` out of `ingest/src/awingest/providers/intervals/client.py`. The transport takes its timeout, because intervals.icu uses 60 s and JustGiving 20 s (e.g. `urllib_transport(timeout)` returning a `Transport`). `intervals/client.py` imports them, and `ingest/tests/conftest.py` and `ingest/tests/contract/test_intervals_adapter.py` keep working, so `Response` and `USER_AGENT` stay importable from `intervals/client.py`. Behaviour is unchanged: the existing adapter suite passes without edits
- [X] T010 In `ingest/src/awingest/providers/base.py`, add the frozen dataclass `FundraisingSnapshot` (`raised_pence: int`, `target_pence: int | None`, `supporters: int`, `page_status: str`) and the protocol `FundraisingProvider` (`name: str`; `def read_page(self, page_url: str) -> FundraisingSnapshot`, "One call. Raises only ProviderError subclasses. Nothing but the snapshot leaves."). Data-model.md §1 rules: `raised_pence` "int >= 0", `target_pence` "int > 0, or `None`", `supporters` "int >= 0", `page_status` "Private: never published"
- [X] T011 Create `ingest/src/awingest/providers/justgiving/errors.py` with the eight classes in the reference table above, each with its own stable `code` and JustGiving's own `likely_cause` and `action`, because the base classes' texts name intervals.icu. `QuotaExhausted` keeps `RateLimited`'s `retry_after`. `SuspectFigures`, `PageNotActive` and `FiguresUnpublished` live here too, so one import registers them all for `failure_class()`
- [X] T012 [P] Create `ingest/src/awingest/providers/justgiving/parse.py` with the pure function `parse_page(body: bytes) -> FundraisingSnapshot`. Allow-list, built field by field, and nothing else is read: `grandTotalRaisedExcludingGiftAid` becomes `raised_pence`, "Required. Strict money string" (FR-012); `fundraisingTarget` becomes `target_pence`, "Key required. `null`, `""` or `"0"` is `None`; otherwise a strict money string", and a value that parses to zero pence (e.g. `"0.00"`) is `None` too, because `target_pence` must be > 0; `donationCount` becomes `supporters`, "Required. String of digits only"; `currencyCode` "Must be `GBP`"; `status` becomes `page_status`, "Required, a non-empty string". **Strict money string**: "a JSON string matching `^\d+(\.\d+)?$`, parsed with `Decimal`; digits past the pence must be zero. Anything else is a failed read." Never `float`. `TargetAmount`, `totalEstimatedGiftAid`, `currencySymbol` and every other key are never read. "A non-empty `errorMessage` on a 200 is a failed read." A missing key, non-JSON or a non-object raises `JustGivingChanged`, never a zero (FR-003, FR-011). On a parse failure the exception and log carry the response's sorted key names and which field failed, never a value
- [X] T013 Create `ingest/src/awingest/providers/justgiving/client.py` and `ingest/src/awingest/providers/justgiving/__init__.py` (`JustGivingProvider`, `name = "justgiving"`, implementing `FundraisingProvider`). The adapter's **only** path template: `https://api.sky.blackbaud.com/jg/consumer/app/consumer/v1/fundraising/pages/{prefix}/{short_name}`, built from `page_url` (prefix `page`). The API's donation operations are never called (FR-011). Headers: `Bb-Api-Subscription-Key` from env `JUSTGIVING_SUBSCRIPTION_KEY`; the shared `USER_AGENT`; `JustGiving-Realm` only when env `JUSTGIVING_REALM` is set (local staging checks, never in a workflow). Timeout 20 s; "One retry, 2 s later, on a network error or 5xx. One wait on a 429 whose `Retry-After` is 60 s or less." The limit of one call a second across campaigns is T017's. Mapping: 401 or no key `KeyRejected`; 403 with `Retry-After` `QuotaExhausted`; 403 without `AccessDenied`; 404 `PageNotFound`; 429 `RateLimited`; network or 5xx `Transient`; anything else `JustGivingChanged`. A missing key raises inside `read_page`, not in the constructor, so the read stage records it per campaign and the alert can open. The key appears in no log, error, `repr` or stored object, and the body is dropped once the snapshot is built: nothing raw is stored anywhere (research.md R5). No other module depends on how JustGiving provides its figures (FR-007)
- [X] T014 [P] In `ingest/src/awingest/logging.py`, add `JUSTGIVING_SUBSCRIPTION_KEY` to `SECRET_ENV`, and `justgivingsubscriptionkey`, `subscriptionkey` and `bbapisubscriptionkey` to `_REDACT_KEYS` (research.md R10, R16)

### 2c. The stages

- [X] T015 In `ingest/src/awingest/state.py`, add `FUNDRAISING_STATE = "state/fundraising.json"` and `FUNDRAISING_FRESHNESS = "public/fundraising-freshness.json"`, and correct the module docstring (two public files now). Running's `state/fetch-status.json` and `public/freshness.json` stay untouched by fundraising (FR-003)
- [X] T016 Create `ingest/src/awingest/fundraising/__init__.py` and `ingest/src/awingest/fundraising/campaigns.py`: `load_campaigns(repo_root, schemas)` reads `data/running/owner/campaigns.yaml` with YAML 1.2 rules and the `owner/campaigns` schema, returning frozen `Campaign` values (`id`, `race_id`, `charity_name`, `page_url`, `finished`). A missing file means no campaigns. Problems raise `OwnerDataInvalid` (exit 20) naming file, entry and field: reuse `_read` from `ingest/src/awingest/process/overrides.py`, made public as `read_owner_file`
- [X] T017 Create `ingest/src/awingest/fundraising/read.py` with `run_fundraising_read(provider, archive, *, repo_root, log, now=None, sleep=time.sleep)`. Load `state/fundraising.json` with `StateDoc`, and for each campaign without `finished: true`, in file order, at most one a second, one campaign's failure never stopping another: (1) if `rate_limited_until()` is in force, count `backing_off` and make no call; (2) `read_page`; on any failure `record_failure()` from `ingest/src/awingest/fetch.py` (it already takes a document and a key) and leave `latest`, `last_success_at` and the published file untouched (FR-003); (3) read the published file `data/running/published/fundraising/<id>.json` from the checkout, and if the total and supporters are both zero while its last point is non-zero, treat it as a failed read with `SuspectFigures`; (4) on success write the entry in data-model.md §2's shape, not `record_success()`, which adds `failed_activities`: `last_attempt_at`, `outcome`, `error_class`, `code`, `message`, `consecutive_failures`, `rate_limited_until`, `page_status`, `latest` (`read_at`, `raised_pence`, `target_pence`, `supporters`). "`latest` changes only on a successful read"; (5) "Figures" means raised, target and supporters together. If they match the last point: `outcome: ok`, `last_success_at = now`, clear `first_unpublished_at`. If they differ or there's no file: `outcome: unpublished`, count `changed`, keep or set `first_unpublished_at`, and `last_success_at` becomes the later of its current value and the published file's `last_read_at`, so the live time doesn't move until the site shows those figures (research.md R6, SC-005). Then save the state document and, after it, write `public/fundraising-freshness.json`: `{ "campaigns": { "<id>": { "last_read_at": "<last_success_at>" } }, "generated_at": "..." }`, "Only active campaigns with a `last_success_at`". No campaigns: no calls, exit 0. Summary on stdout, counts only: `{ "outcome": "ok", "campaigns": 1, "read": 1, "changed": 0, "failed": 0, "backing_off": 0, "code": null, "exit_code": 0 }`, where `outcome` is `ok` when every campaign was read, `partial` when some weren't, and `failed` when none could be, and a campaign backing off counts as not read. Exit 0, otherwise the first failure's class exit; a campaign only backing off exits 11, as `run_fetch` does; 14 archive, including a corrupt state document; 20 invalid owner file. Figures never reach a log
- [X] T018 Create `ingest/src/awingest/fundraising/publish.py` with `run_fundraising_publish(archive, *, repo_root, log, now=None)`. For each campaign that isn't finished and has a `latest`, apply data-model.md §4's table through one `PublishedWriter` and `write_json(f"fundraising/{id}.json", doc, "published/fundraising-campaign")`, then one `commit()`, "All or nothing per run": no published file: create it with one point (first read, FR-022); `latest.read_at` not after `last_read_at`: nothing; figures differ, same London day as the last point: replace that point and set `last_read_at`; figures differ, a later day: append a point and set `last_read_at`; same figures, committed `last_read_at` at least 6 hours old: set `last_read_at` only; same figures, younger: nothing. Setting `last_read_at` always means setting it to `latest.read_at`, never the clock, so a failed read can't claim fresh figures (SC-005); the age in the 6-hour rule is `now` minus the committed value. "A target change alone makes a point"; "A total that goes down is written as it is". `target_pence` is omitted when `None`. `date` is the Europe/London date of `read_at` (`london_date()`). A finished campaign is skipped, so its file never changes again, and a file is never deleted, even if its campaign leaves `campaigns.yaml` (FR-008). Exits 0; 14 archive; 20 invalid owner file or published document. The stage reads R2 and doesn't write to it
- [X] T019 Refactor `ingest/src/awingest/alerts.py`: `GitHubIssues` takes its label and label description as constructor arguments (`label=LABEL` by default, and `from_env(label=...)`), replacing the hard-coded uses in `ensure_label`, `open_issue` and `create`; `run_alert()`'s open, comment-once-a-day and close logic moves into a shared function that takes `failing`, the title, the body and the recovery text, and `run_alert()` keeps its behaviour. Add `import awingest.providers.justgiving.errors  # noqa: F401` beside the pipeline import, or `failure_class()` won't find JustGiving's classes (research.md R16). `ingest/tests/contract/test_alerts.py` passes without edits
- [X] T020 Create `ingest/src/awingest/fundraising/alerts.py` with `run_fundraising_alert(archive, issues_for, *, repo_root, log, now=None, run_url=None)`. One issue per campaign, label `fundraising-failing-<campaign-id>`, title `<charity> fundraising figures failing since <date>`, label created on first use. A campaign's issue opens when any holds (contracts/pipeline.md, verbatim): `code` is `page_not_found`, at once, even if the page used to work; `page_status` is set and isn't `Active`, at once; never read successfully and the last attempt failed, at once; `now - last_success_at > 24 h` (`STALE_AFTER`), "This covers failing reads and figures that aren't reaching the site"; no `last_success_at` and `now - first_unpublished_at > 24 h`. The body follows `ingest-failing`: failure class and code, last error (scrubbed), likely cause, action, last good time, consecutive failures, run link. Texts come from `failure_class()`: the entry's `code`, else `page_not_active` when `page_status` is set and isn't `Active`, else `figures_unpublished` when `outcome` is `unpublished`. Closes on recovery with "Recovered at <time>", or when the campaign is marked `finished`; a state entry whose campaign has left `campaigns.yaml` closes the same way. Running's `ingest-failing` issue is unrelated, and either can be open without the other (FR-006)
- [X] T021 In `ingest/src/awingest/cli.py`, add `fundraising-read`, `fundraising-publish` and `fundraising-alert`, each with `with_archive` and `with_repo`, dispatched before the `IntervalsProvider` code path, with `provider="justgiving"` on their `Logger`, JSON-lines logs on stderr and a one-line summary on stdout. `fundraising-alert` exits 0; 1 GitHub API; 14 archive; 20 if `campaigns.yaml` is invalid. No fundraising command constructs `IntervalsProvider`, so a Running fault can't reach it. Update the module docstring
- [X] T022 In `scripts/scan-privacy.ts`, add the two rules of contracts/data-files.md (SC-004). **Donor, Gift Aid or JustGiving account key**, keys matching `donor\w*`, `donations?`, `donation_?amount`, `gift_?aid\w*`, `totalEstimatedGiftAid`, `owner_?guid`, `page_?guid`, `campaign_?guid`, `consumer_?id`, `page_?id`, `event_?id`: on `data/` except `data/running/owner/stories/` through the shared `key()` helper, and on `dist/` except bundled library code as **quoted keys only** (`["'](?:...)["']\s*:`), because `key()` also matches a bare word before a colon, so a sentence such as "Donations: ..." would fail the gate. **A Gift Aid figure on a page**: `£` and digits within 40 characters of "Gift Aid", in either order, on `dist/` except bundled library code, `redact: true`. "Gift Aid" as a word stays allowed. Findings give file, line and column, never the matched value. Update the header comment

### 2d. Workflow and data

- [X] T023 Edit `.github/workflows/refresh.yml` as contracts/pipeline.md gives it, with no new job, trigger or schedule (FR-002). In `fetch`, after `uv sync`, before `Fetch (intervals.icu -> R2)`: step `Read fundraising figures (JustGiving -> R2)`, `id: fundraising`, `if: ${{ github.ref == 'refs/heads/main' }}`, `continue-on-error: true`, `timeout-minutes: 2` (the job's 30 minutes also hold the 25-minute fetch), `shell: bash`, `env` with `JUSTGIVING_SUBSCRIPTION_KEY` and the four `R2_*` secrets, `run: uv run --no-sync awingest fundraising-read --archive r2 | tee "$RUNNER_TEMP/fundraising-summary.json"`. In `fetch`, after `Alert`: a step running `uv run --no-sync awingest fundraising-alert --archive r2`, `if: ${{ always() && github.ref == 'refs/heads/main' }}`, `continue-on-error: true`, `timeout-minutes: 1`, with `GITHUB_TOKEN` and `R2_*`, and no JustGiving key, "so the key and the GitHub token never share a step". In `decide`, a new branch directly after the `daily` one: `elif jq -e '(.changed // 0) > 0' "$RUNNER_TEMP/fundraising-summary.json" >/dev/null 2>&1; then reason='fundraising figures changed'`, which stays false on a missing or empty summary. In `publish`, after `Process`, before `Publish check`: step `Publish fundraising figures (R2 -> data/running/published/fundraising/)`, `working-directory: ingest`, `continue-on-error: true`, `timeout-minutes: 2`, the `R2_*` env, `run: uv run --no-sync awingest fundraising-publish --archive r2`. `continue-on-error` is essential: `decide` skips an idle publish only after a green run, so a red run would publish every time and look like a running failure (research.md R4). `Check changed paths`, `commit` and `deploy` need no change. Update the header comment
- [X] T024 Change `data/running/owner/section.yaml`'s `focus_race.charity.name` to `Martlets`, and create `data/running/owner/campaigns.yaml` in the same commit, because FR-024's check needs both: one entry, `id: brighton-2027`, `race_id: brighton-2027`, `charity: { name: Martlets, url: https://www.martlets.org.uk/, registered: { name: Southern Hospice Group, number: "256789" } }`, `page_url: https://www.justgiving.com/page/alexanderwebber-brighton-2027`, plus a header comment naming the schema and the commented line `# finished: true    # stops reads; shows "Final total" (FR-023)`. Keep comments clear of the scan's keys (e.g. "donations:"). `data/running/owner/stories/` isn't created until a story is approved

### 2e. Tests (straight after the code)

- [X] T025 Add synthetic fixtures in `ingest/tests/fixtures/justgiving/`, written by hand in the live shape (string figures, no `TargetAmount`, the 48 keys, made-up values; research.md R2 names only 26 of them, so first make one throwaway live call that prints only the sorted key names, no values; "No real response, name or identifier is committed"), covering: a normal page, `"1335.00"`, no target, a closed page, and `page-sentinels.json` with sentinels in every non-allow-listed field plus injected `donations` entries (donor name, message, amount), `totalEstimatedGiftAid`, `ownerGuid`, `consumerId`, `pageId` and `pageGuid`. Add a fake JustGiving API to `ingest/tests/conftest.py`
- [X] T026 Create `ingest/tests/contract/test_justgiving_adapter.py`, one test per row of contracts/provider-adapter.md *Tests*: **Shape** (`"500"`, `"1335.00"` and `"0"` parse; `TargetAmount` alone doesn't count as a target); **Failed reads** (each of `""`, `null`, a number type, `"£5"`, `"1,335.00"`, `"-1"`, `"NaN"`, `"1e3"`, a missing key and non-JSON raises `JustGivingChanged`, never a zero); **No target** (`null`, `""`, `"0"` and `"0.00"` give `None`); **Errors** (every class, including 401 quoting **JustGiving APIs** in its action, 403 with and without `Retry-After`, HTML bodies, wrong currency, a non-empty `errorMessage`); **Requests** (only the one URL is called, the header and User-Agent are set, the realm header appears only when set); **Privacy** (no sentinel in the snapshot's `repr`, the state document, the public freshness file, the published file or the logs); **Secrets** (the key is in no exception text or `repr`, and `logging.py` scrubs it); **Determinism** (FR-010, FR-011, FR-012)
- [X] T027 Create `ingest/tests/unit/test_fundraising.py` with the read stage's rule-by-rule tests on a fixed clock: same figures (`last_success_at` moves, no `changed`); different figures (`latest` updated, live time held, `changed: 1`); first read with no file; failed read (`latest`, `last_success_at` and the published file unchanged, FR-003); `suspect_figures`; `page_status` not `Active` (the read still succeeds); two campaigns, one failing; 429 and quota setting `rate_limited_until` and no call until it passes; no campaigns; a finished campaign making no call; a campaign whose race has passed still being read (FR-023, US4.2); corrupt `state/fundraising.json` (exit 14) with `state/fetch-status.json` untouched and `run_fetch` carrying on; a failing provider leaving a `run_fetch` and `run_process` run unaffected, in both directions (FR-003). The freshness file holds only the contract's fields and only active campaigns. The summary holds counts only
- [X] T028 Add the publish stage's tests to `ingest/tests/unit/test_fundraising.py`, one for each row of data-model.md §4's table, including the 6-hour boundary, a total going down, a target change alone, a London day boundary around midnight in BST, one point a day, a page with no target (`target_pence` omitted), a finished campaign skipped, a file kept when its campaign leaves `campaigns.yaml`, all-or-nothing on an invalid document, and `publish-check` accepting the result and rejecting a wrong `campaign_id` and unsorted `points` (FR-008, FR-022)
- [X] T029 Add alert tests to `ingest/tests/contract/test_alerts.py`, against the fake GitHub API: each opening condition in T020 at its threshold, with a fixed clock (24 h, and at once for `page_not_found`, `page_not_active` and a first failed read); one issue per campaign under its own label; the title; body texts naming JustGiving, including 401's **JustGiving APIs**; comment once a day; "Recovered at <time>" and close; close on `finished`; `ingest-failing` and a fundraising issue open together without touching each other; `failure_class()` finding every code in the reference table (FR-006, SC-003)
- [X] T030 [P] Add CLI tests to `ingest/tests/unit/test_cli.py`: each new command's exit codes and one-line summary, `--archive local`, and an invalid `campaigns.yaml` giving exit 20 with file, entry and field
- [X] T031 [P] In `tests/contract/schemas.test.ts`, add the contract's schema test: no key matching `donor|donation|gift_?aid|message|owner|consumer|page_?id|page_?guid` can validate anywhere in `published/fundraising-campaign` (use `withKeyInjected`), and a `date` with a time of day can't. `ingest/tests/contract/test_schemas.py` picks up the shared fixtures by itself
- [X] T032 [P] Create `tests/unit/fundraising-validate.test.ts` for every check in T007 through `tests/helpers/temp-repo.ts`, asserting file, entry, field and severity, plus the exact charity message and the `target` key's message naming JustGiving (FR-021). Extend `tests/contract/store.test.ts` with `getCampaignFigures()` and `OwnerData.campaigns`, including absent files
- [X] T033 [P] In `tests/unit/scan-privacy.test.ts`, add a fixture for each new rule: each key listed in T022 in published JSON and owner YAML; quoted and bare keys on a page (only quoted fails); "Donations: ..." in a sentence passing; a `£` figure within 40 characters of "Gift Aid" either way failing, and "Gift Aid" as a word passing; `data/running/owner/stories/` exempt from the key rule; findings redacting the matched value
- [X] T034 [P] Create `tests/contract/refresh-workflow.test.ts`: parse `.github/workflows/refresh.yml` with `yaml` and fail if `JUSTGIVING_SUBSCRIPTION_KEY` appears anywhere but the read step's `env`, if any of the three fundraising steps loses `continue-on-error`, if the read step moves after the intervals.icu fetch, if the alert step gains the JustGiving key, or if `JUSTGIVING_REALM` is set anywhere (contracts/pipeline.md)

### 2f. Ship the slice

- [X] T035 [P] Update `ingest/README.md` (the read and publish steps, the commands, why no raw response is stored) and `schemas/README.md` (`campaigns` joins the list files)
- [X] T036 Run the PR routine's suites, then quickstart.md §1 and §2: one real read, `cd ingest; uv run awingest fundraising-read --archive local --archive-dir .archive`. Expected: `outcome: ok`, `read: 1`, `changed: 1`, figures 0, 500 and 0 before the first donation, and a search of `.archive/` finding no owner name, story text or identifier. Then, as AGENT_TIPS *Run a new published field through the full gate* says, put a sample `data/running/published/fundraising/brighton-2027.json` in place temporarily, run validate, build and `scan-privacy`, and remove it
- [X] T037 Raise the PR by the PR routine. After it merges and `main`'s Gate run finishes, run quickstart.md §5. The merge changes `data/running/owner/**`, so a push-triggered refresh does the first publish: check that the fundraising step passed, the run published with "owner files changed", the bot committed `data/running/published/fundraising/brighton-2027.json`, and the deploy ran. Then `gh workflow run refresh.yml --ref main` proves the idle case: same figures, no publish, no commit. Confirm from the logs that the key is only in the read step's `env`. `GET /running/api/fundraising-freshness` doesn't exist until T044, so its half of the check is in T063
- [X] T038 After the merge, run `/speckit-house-process-harvest-lessons` in the main conversation, sending the *Upstream candidates* in `PROJECT_MEMORY.md` (over 25 are waiting, and it asks for this after the first implement slice)

**Checkpoint**: reads run on every refresh, the history has started, and nothing in Running depends on
them.

---

## Phase 3: Staging check (delivery slice 2)

**Purpose**: Settle what only real donations can prove (research.md R8): the number format with pence
and thousands, and whether `donationCount` equals the page's supporters. Until then the parser fails
safely.

**Goes live**: nothing, unless the parser needs widening, which is an ingest-only PR.

**How to view it**: nothing to view. The agent reports the results in the session.

**Needs the owner**: **yes**, guided, about 15 minutes. If staging can't be used, skip to Phase 4:
T117 settles both points at the first real donation, and the parser still fails safely.

**Outcome (2026-11-01)**: both points are settled, with no parser change. A new staging page vanished
minutes after it was created, so the check used an existing shared test page instead. The no-target
page couldn't be made, so that case stays untested (quickstart.md §4).

- [X] T039 (owner, guided by the agent) Create what the check needs on JustGiving's staging environment, one step at a time: a page with a target and test-card donations totalling over £1,000, with two from one donor, and a second page with no target (quickstart.md §4). The agent first finds the staging website's address and test card in Blackbaud's docs (rendering them with Playwright's Chromium, as `PROJECT_MEMORY.md` notes), so the owner only follows steps. The two page names go to the agent in the chat, and nothing is committed. Only the results reach `PROJECT_MEMORY.md` (T043). **Done differently 2026-11-01**: the owner's new page didn't persist, so two test-card donations went on an existing shared test page, taking it past £1,000. No no-target page was made
- [X] T040 Run the staging read from a scratch repo root outside the repo (a `schemas/` junction plus a temporary `data/running/owner/campaigns.yaml` holding the staging short names in the normal `https://www.justgiving.com/page/<name>` form): `$env:JUSTGIVING_REALM = 'staging'; cd ingest; uv run awingest fundraising-read --archive local --archive-dir .archive/staging --repo-root <scratch>`. Check the table in quickstart.md §4: figures with pence and thousands give a correct `raised_pence`; `donationCount` equals the supporters on the staging page, with the repeat donor; online, offline and SMS totals sum to the grand total (a throwaway script in the session's scratchpad, printing only those four allow-listed fields, never the key, and saving no raw response); a page with no target holds `null`, `""` or `"0"` in `fundraisingTarget`. **Done 2026-11-01**, through the real client and parser rather than the CLI, with results in quickstart.md §4
- [X] T041 Make the one deliberate mistyped-page call (quickstart.md §3), with the same scratch root and a page address that doesn't exist. Expected: `page_not_found`, exit 15, and state records the failure with no `latest`. If the real status isn't 404, change the mapping in `ingest/src/awingest/providers/justgiving/client.py` and its test (research.md R1). **Passed 2026-11-01**, on staging and live: a real 404, so the mapping stays
- [X] T042 If T040 or T041 disagrees with the parser, widen `ingest/src/awingest/providers/justgiving/parse.py` and `ingest/tests/contract/test_justgiving_adapter.py` (new synthetic fixtures in the real shape, no real values), and raise a small PR by the PR routine. If the online, offline and SMS totals don't sum to the grand total, check which total JustGiving's page shows (FR-012). Skip the PR if nothing changed. **Nothing changed 2026-11-01**: both agreed, and the contract test already covers the real shape (`"1335.00"`)
- [X] T043 Clear `JUSTGIVING_REALM`, remove `ingest/.archive/staging/` and the scratch root, and record the results in `PROJECT_MEMORY.md`, including the supporters answer: if `donationCount` differs from the supporters shown, T045's label reads "donations" (spec assumption *Supporters*), else "supporters". **Done 2026-11-01**: they agree, so T045's label reads "supporters"

**Checkpoint**: the parser matches real figures, or fails safely with an alert.

---

## Phase 4: User Story 1 - Fundraising card on the landing page (Priority: P1), the MVP

**Goal**: Beside the Brighton hero, a visitor sees the total against the target, the bar, the
supporter count, when the figures were last updated and a Donate button.

**Independent Test**: With the real Brighton campaign and its published file, open `/running/` on a
phone: the card shows the total, target, bar, supporters, last-updated time and a working Donate
button, after the hero's headline facts and before the goals. In a build whose focus race has no
campaign, nothing appears in its place.

**Goes live**: the card on `/running/`, at "£0 raised of £500" and "No supporters yet" (owner decision
3); the hero's "For Martlets" line goes while the card shows (owner decision 4);
`/running/api/fundraising-freshness`. Until the story is approved, Donate leads to the JustGiving page
with its holding text.

**How to view it**: https://alexanderwebber.com/running/. On a phone: the card sits under the hero's
facts and above the training build chart and the goals; tap Donate and arrive at the JustGiving page.
On a desktop: the card sits in the hero's first column. The states that can't exist yet (108%, no
target, stale) are phone and desktop screenshots in the PR, from `/fundraising-preview/<state>/`.

**Needs the owner**: a phone and desktop review (T062).

**Not built yet**: the fundraising page, chart and menu item (so the card has no link to a page yet),
the story, the after-race forms, the charity's logo.

### Implementation for User Story 1

- [ ] T044 [US1] Create `src/worker/fundraising-freshness.ts`, reading `public/fundraising-freshness.json` through the existing `FRESHNESS` binding, and dispatch `/running/api/fundraising-freshness` from `src/worker/freshness.ts` (`run_worker_first: ["/running/api/*"]` already covers it). `200 application/json`, `Cache-Control: public, max-age=300`, body `{"campaigns":{"brighton-2027":{"last_read_at":"..."}},"generated_at":"..."}`. Re-shaped, like `/running/api/freshness`: "only campaign IDs matching the slug pattern and second-precision UTC timestamps pass; anything else is dropped". "Missing or malformed: `503`, `no-store`. `HEAD` is answered; other methods get 405." `/running/api/freshness` doesn't change. Move `respond` and `timestamp` to a new `src/worker/respond.ts`, so neither module imports the other and the entry module's exports don't grow (AGENT_TIPS *Cloudflare*). Correct the comment over `r2_buckets` in `wrangler.jsonc`, which says the Worker reads only `public/freshness.json` (FR-004)
- [ ] T045 [US1] Create `src/sections/running/domain/fundraising.ts`, pure, as data-model.md §7: `poundsText(pence)`, "`floor(pence / 100)`, with thousands separators" (`£1,250`, FR-063); `campaignProgress(raised, target)`, "`percent = floor(raised * 100 / target)` in integers. `fraction = percent / 100`, capped at 1", with `reached` when raised equals the target and `beaten` when it's above, and no progress at all without a target; `barValueText()`, e.g. "£1,250 of £2,000, 62%" (FR-061); `isStale(lastReadAt, now, staleAfterHours)`, "`now - last_read_at > stale_after_hours`" (FR-005); `supportersText(n)`, "37 supporters", "1 supporter", "No supporters yet", with the word from one constant, set by T043's result. Pass `ProgressBar` the floored fraction, because the component rounds (`Math.round(0.625 * 100)` is 63) and its `aria-valuenow` would otherwise disagree with the words (research.md R7)
- [ ] T046 [US1] Create `src/sections/running/data/fundraising.ts`: `loadFundraising(today, store)`, memoised with `perStoreAndDay`, reading through `RunningStore`. A campaign with figures is "a campaign whose published file exists. Others appear nowhere" (FR-022). The current campaign is "the one whose `race_id` is the focus race, if it has figures". Returns `{ current?: CampaignView, past: [] }`, where `CampaignView` holds the campaign, its race (name and date, from `upcoming-races.yaml` by `id`), the latest figures (the last point), `last_read_at`, the points, and its progress. T065 fills `past`
- [ ] T047 [US1] In `src/sections/running/data/landing.ts`, add `fundraising?: CampaignView` to `LandingData` from `loadFundraising(today, store).current`. `featuredGoals()`, the featured-goal limit and the Goals page are untouched (FR-025)
- [ ] T048 [P] [US1] Styles. In `src/sections/running/styles/goal-card.css`, add `.fundraising-card` to the shell selectors (`.theme-running .goal-card`, `.goal-card-title`), keeping a left accent edge, with its forced-colours colour, as its own (FR-031); don't reuse `.goal-card`. Move `LastUpdated.astro`'s scoped `.stale-notice` rules to `src/sections/running/styles/theme.css`, so both freshness blocks share them, and check the notice's computed style is unchanged on a stale page. Add `.theme-running .fundraising-donate`: the Running accent, at least 44 px tall, visible focus, forced-colours support. A new token pair for the button's text and background joins the AA suite in `tests/unit/design-tokens.test.ts` if the existing ones don't pass
- [ ] T049 [US1] Create `src/sections/running/components/FundraisingUpdated.astro`, modelled on `LastUpdated.astro`: a block `data-fundraising-updated` with `data-campaign`, `data-read-ms` and `data-stale-ms`, the text "Figures updated <formatDateTime>" (so it's distinct from the page's Running "Last updated" line, FR-004), and a stale notice saying the figures may be out of date, using the `.stale-notice` class but its own attribute (`data-fundraising-stale`), because `tests/e2e/stale.spec.ts` expects `[data-stale-notice]` to be Running's alone. The instant is epoch milliseconds, and `now` is a prop that tests pin. Stale at build time decides `hidden`. The script (under 1 KB, inlined): "one fetch, then for each `[data-fundraising-updated]` block, take the later of the live time and the block's `data-read-ms`. If it's newer than the build's time, show 'Figures updated 2 hours ago'; if the build's time is still current, leave the text alone. Show or hide the notice by age against `data-stale-ms`. On 503 or offline, nothing changes." (FR-004, FR-005)
- [ ] T050 [US1] Create `src/sections/running/components/FundraisingFigures.astro`, shared by card and page: the lead line, the `ProgressBar` (label naming the target, `valueText` from `barValueText()`, the floored fraction), the secondary line and the Donate link. Before-race rows of contracts/routes.md's table: **£1,250 raised of £2,000**, bar 62%, "37 supporters · For Martlets"; **£2,000 raised of £2,000**, full, "Target reached: 100% · 37 supporters · For Martlets"; **£2,160 raised of £2,000**, full, "Target beaten: 108% · 37 supporters · For Martlets" (FR-030 needs the supporters and charity here too, because the hero's line has gone); **£1,250 raised**, no bar, "37 supporters · For Martlets"; **£0 raised of £500**, empty bar, "No supporters yet · For Martlets". Donate: "a plain `<a>` reading 'Donate on JustGiving', with `href` set to the campaign's `page_url`", class `fundraising-donate`, same tab, no JustGiving or Blackbaud logo (FR-001, FR-032, FR-061, FR-063, FR-065, research.md R3). Keep short amounts and dates on one line, and add explicit `{' '}` between inline elements (AGENT_TIPS *Astro*, *UI and accessibility*)
- [ ] T051 [US1] Create `src/sections/running/components/FundraisingCard.astro`: `<article class="fundraising-card">` with a level-3 heading, so the page outline holds under the hero's `h2`, then `FundraisingFigures` and `FundraisingUpdated`. It imports `../styles/goal-card.css`, as `GoalCard.astro` does. "Nothing renders in the slot without a current campaign with figures: no wrapper, no heading". All figures and the Donate link are in the built HTML, and no client JS but the freshness script (FR-030, FR-031, FR-062)
- [ ] T052 [US1] In `src/sections/running/components/Hero.astro`, drop `<li data-charity>` when the `fundraising` slot is filled (`Astro.slots.has('fundraising')`), and update its header comment ("For Martlets hospice", "nothing fills yet"). The line returns when no card shows. Test that an empty conditional slot keeps the line: if `Astro.slots.has` reports a conditional child as filled, pass a prop instead (owner decision 4)
- [ ] T053 [US1] In `src/sections/running/pages/index.astro`, render `{data.fundraising && <FundraisingCard slot="fundraising" campaign={data.fundraising} />}` inside `Hero`, so it sits after the headline facts and, on phones, before the build chart and goals (FR-030, FR-034). Update the header comment
- [ ] T054 [US1] Add the previews: `tests/fixtures/fundraising-preview/generate.ts` (deterministic, output committed, all names, totals and dates made up, as `tests/fixtures/health-preview/generate.ts`), writing `tests/fixtures/fundraising-preview/data/<state>/data/running/{owner,published}/` (`JsonFileStore` expects `<root>/data/running/`) for the states `active` (£1,250 of £2,000, 37 supporters), `no-target`, `zero` (£0 of £500), `beaten` (108%) and `stale` (last read 2 days ago); `tests/fixtures/fundraising-preview/store.ts` (one store per state, `PREVIEW_TODAY`, a pinned `PREVIEW_NOW`); `tests/fixtures/fundraising-preview/[state].astro` (`getStaticPaths` over the states, the real `SectionLayout` and `FundraisingCard`). In `astro.config.mjs`'s `shellPreview`, inject `{ pattern: '/fundraising-preview/[state]', entrypoint: './tests/fixtures/fundraising-preview/[state].astro' }` and update the comment. Deploy builds never set `SHELL_PREVIEW`

### Tests for User Story 1 (straight after the code)

- [ ] T055 [P] [US1] Create `tests/unit/fundraising-worker.test.ts`, following `tests/unit/freshness-worker.test.ts`: the contract fields and 5-minute cache, the route reading only `public/fundraising-freshness.json`, re-shaping (an extra field dropped, a bad campaign ID dropped, a bad timestamp dropped), 503 `no-store` on missing, malformed and R2 failure, `HEAD`, 405, and `/running/api/freshness` unchanged and unaffected by a broken fundraising file, and the reverse (FR-003)
- [ ] T056 [P] [US1] Create `tests/unit/fundraising.test.ts`: `poundsText` rounding down (£1,250.99 is "£1,250", FR-063); `campaignProgress` (£1,250 of £2,000 is 62, not 63; 99.9% shows 99; exactly at target; 108%; no target); `barValueText`; `isStale` at the 12-hour edge; `supportersText` for 0, 1 and many (FR-032)
- [ ] T057 [P] [US1] Create `tests/unit/fundraising-cards.test.ts` with the Astro container API: every before-race row of T050, including the supporters and charity in the reached and beaten rows; US1.1's exact text; the Donate link's `href`, words and same-tab behaviour; `aria-valuenow` agreeing with the words; the stale notice at build time; no client JS beyond the freshness script. In `tests/unit/landing.test.ts`, add a campaign to the store and assert the card's place, the hero without its charity line, the line returning with no campaign, the fundraising target on neither the Goals page nor in `featured`, and the featured count unchanged (US1.3, US1.8, FR-025)
- [ ] T058 [US1] Update `tests/e2e/landing.spec.ts`, which asserts the old state (`[data-charity]` at line 92 and "shows nothing yet" at lines 97–98). Take expectations from the data (AGENT_TIPS *End-to-end testing*): if the focus race's campaign has a published file, the hero has no `[data-charity]`, and `.fundraising-card` holds `For <charity>` and a Donate link to `page_url`; otherwise the line shows and nothing mentions fundraising. Add that, at 360 and 320 px, the card comes after the hero's facts and before the goals (FR-034, FR-060). The test "race, days left, target and this week's distance are on the first screen" (lines 217–225) needs `[data-training-build] .chart-figure-summary` within 780 px at 360 wide, and with a card that's about 903 px: when a card shows, it keeps the first three selectors and adds `.fundraising-card`'s lead line, dropping the training summary (001's SC-001 doesn't need it). Figures must not be pinned, because the bot publishes them
- [ ] T059 [US1] Create `tests/e2e/fundraising.spec.ts` over `/fundraising-preview/<state>/`: each Phase 4 state renders as its row in contracts/routes.md says, at 360 and 320 px and on desktop, with the bar not overflowing at 108%; "Figures updated …" and Running's "Last updated" both present and separate; the notice in `stale` only; with JS off, all figures, Donate and the updated line stay (FR-004, FR-005, FR-062); a routed `/running/api/fundraising-freshness` with a newer time updating the text, and with 503 changing nothing. Add a keyboard path to Donate
- [ ] T060 [P] [US1] Create `tests/a11y/fundraising.spec.ts` with `tests/helpers/a11y.ts` (`axe`, `outline`, `fullSweep`, `sweepOnlyInDark`): zero violations for each preview state, in light, dark and forced colours, heading outline intact (FR-060, SC-010)

### Ship the slice

- [ ] T061 [US1] Run the PR routine's suites and quickstart.md §6 for these states (`tests/e2e/fundraising.spec.ts`, `tests/a11y/fundraising.spec.ts`), look at phone-width screenshots of each, and confirm `dist/` against `main`: markup differs only on the landing page, the Worker has its new route, and CSS differs where T048 moved it (the Goals page's inline CSS, and any shared-CSS hash in every page's `<link>`)
- [ ] T062 [US1] (owner, guided by the agent) Raise the PR by the PR routine, with the phase header's *How to view it*. The owner reviews the card on a phone and a desktop after the deploy, folded into the PR review of `src/sections/running/components/FundraisingCard.astro`. Checkbox questions: is the wording of the stale notice fine, and is it fine that this week's distance moves below the first screen on a phone (T058)?
- [ ] T063 [US1] After the merge and deploy, finish quickstart.md §5: `curl` `https://alexanderwebber.com/running/api/fundraising-freshness` shows a `last_read_at`, a later one after the next refresh, and no commit from that refresh. Confirm Donate reaches the page. Note in `PROJECT_MEMORY.md`'s *Next session* that the next session starts with a short guided review of the live card and a question round on what the owner saw (the *Show me the real thing* norm), and write T117–T119's triggers there now, because Donate is live and the first donation can come before Phase 8

**Checkpoint**: US1 is live: visitors can see the cause and give. This is the MVP.

---

## Phase 5: User Story 2 - The fundraising page (Priority: P2)

**Goal**: A permanent page for the fundraising: the current campaign, a chart of the total by day and
past campaigns.

**Independent Test**: With a campaign and several weeks of stored totals, open `/running/fundraising/`
on a phone and a desktop: figures, Donate and the last-updated time show, the chart matches the stored
history with an accessible table, and a synthetic past campaign is listed with its final total.

**Goes live**: `/running/fundraising/`, "Fundraising" in the Running menu and landing links, a link
from the card, `/og/running-fundraising.png`.

**How to view it**: https://alexanderwebber.com/running/fundraising/ on a phone and a desktop:
"Brighton Marathon · 4 April 2027", "For Martlets" linking to Martlets' site, "Part of Southern Hospice
Group, registered charity 256789", the figures, Donate. The chart appears once totals exist from two
days. Open the page's link in a messaging app to see the preview. The past-campaign list and a chart
with history are screenshots in the PR, from `/fundraising-preview/<state>/`.

**Needs the owner**: a phone and desktop review (T079).

**Not built yet**: the story section, the after-race forms, the logo.

### Implementation for User Story 2

- [ ] T064 [US2] Add `campaignsWithFigures(root = process.cwd())` to `src/sections/running/data/store/files.ts`: it reads `owner/campaigns.yaml` and tests for `published/fundraising/<id>.json`, without loading the whole data tree a second time (research.md R13). In `src/sections/running/integration.ts`, add the `fundraising` area to `runningAreas` only when it finds a campaign, after Health: `key: 'fundraising'`, label "Fundraising", href `/running/fundraising/`, description "Fundraising for charity, and how to give.", routes `{ pattern: '/running/fundraising', entrypoint: './src/sections/running/pages/fundraising.astro' }` and `{ pattern: '/og/running-fundraising.png', entrypoint: './src/sections/running/og/fundraising.png.ts' }`. The nav, `SectionLinks` and the sitemap follow with no other change (FR-040, SC-006)
- [ ] T065 [US2] Extend `src/sections/running/data/fundraising.ts`: `past` is every campaign with figures that isn't current, "most recent race first" (FR-022, FR-043); a race falls back from `upcoming-races.yaml` to `races/<slug>/race.yaml` by `slug`, and because `Race.name` is optional its name falls back as `raceHistory` does (`entry.name ?? run?.title`); each view has `finished`
- [ ] T066 [P] [US2] Add `chartPoints(points, today)` to `src/sections/running/domain/fundraising.ts`: "a total holds until it changes, so each change gets a point the day before it at the old value, plus a closing point today" (no duplicate when the previous point is already the day before), and "The table lists only the real points". Add `chartSummary()`, e.g. "£1,250 raised since 10 Nov 2026, 62% of the £2,000 target". The target line uses the latest target (FR-042, FR-061)
- [ ] T067 [P] [US2] Create `src/sections/running/components/PastCampaigns.astro`: most recent race first, each with its race and date, charity, final or latest total, target if any, and a link to its JustGiving page. "A finished one reads 'Final total'; an unfinished past campaign shows its last-updated line and, past the threshold, the notice" (`FundraisingUpdated`). Style it from global CSS in `src/sections/running/styles/theme.css` if the list grows (FR-043)
- [ ] T068 [US2] Create `src/sections/running/components/FundraisingPage.astro`, taking its data as props and rendering `SectionLayout` (title "Fundraising · Running · Alexander Webber", a description naming the race and charity, `garmin` off), as `HealthPage.astro` does, with an optional default slot first that only the preview fills. In order: (1) the current campaign: "Brighton Marathon · 4 April 2027" (`formatLongDate`), the charity (linked where `charity.url` is given), the registered line, "Part of <name>, registered charity <number>" when `name` differs from `charity.name`, else "Registered charity <number>", on this page only, then `FundraisingFigures` and `FundraisingUpdated`; (3) the chart: `LineChart` inside `ChartFigure`, shown from two points, `zero`, target line, `format` in pounds, table columns date and total only, "because the page has no need to show how supporters changed by day"; with one point there is no chart (US2.3); (4) `PastCampaigns`. With no current campaign the page leads with that list. Leave place (2) for the story, added in T086. The fundraising line says "Figures updated", so it stays apart from Running's "Last updated" (FR-041, FR-042, FR-043)
- [ ] T069 [US2] Create `src/sections/running/pages/fundraising.astro`, loading `loadFundraising()` and rendering `FundraisingPage`, with `image={ogPath('/running/fundraising/')}`
- [ ] T070 [P] [US2] Create `src/sections/running/og/fundraising.png.ts` with `ogEndpoint`, serving `/og/running-fundraising.png`: "Charity, race and total raised at the last deploy", from the current campaign, else the most recent past one, with `RUNNING_OG_COLOURS` and no JustGiving logo. Look at a rendered PNG before trusting the layout (AGENT_TIPS *Share images*). The landing image is unchanged (FR-060)
- [ ] T071 [US2] In `src/sections/running/components/FundraisingCard.astro`, add the link to `/running/fundraising/` (FR-040). The card only renders when a campaign has figures, so the link can't go to a missing page
- [ ] T072 [US2] Extend the previews: add the states `first-day` (one point), `second-campaign` (a new current campaign, with Brighton under past) and `no-current` (focus race with no campaign) to `tests/fixtures/fundraising-preview/generate.ts`, add a chart's worth of points to `active`, and change `tests/fixtures/fundraising-preview/[state].astro` to render the real `FundraisingPage`, with the real `FundraisingCard` in its default slot

### Tests for User Story 2 (straight after the code)

- [ ] T073 [P] [US2] Extend `tests/unit/fundraising.test.ts`: `chartPoints` (a change the next day, a gap of weeks, a drop, the closing point, the real points only in the table); `chartSummary`; past-campaign order; a campaign without a file left out (FR-022); `campaignsWithFigures` with no file, a file with no campaign and both
- [ ] T074 [P] [US2] Extend `tests/unit/fundraising-cards.test.ts` with `FundraisingPage`: order of sections, the registered line in both forms and absent from the card, one point showing no chart, two showing it, the table's columns, no supporters column. Extend `tests/unit/og.test.ts` for `ogPath('/running/fundraising/')` and the card's text
- [ ] T075 [US2] Update `tests/unit/landing.test.ts`: the test at line 213 pins `SectionLinks` to four hrefs and asserts no "fundrais" anywhere, and `runningAreas` reads the real repo, so it fails once the area exists. Compare with `runningAreas` itself, and limit the "nothing in the slot" check to the hero. Update `tests/e2e/landing.spec.ts` in the same way, so the card and the nav item aren't confused
- [ ] T076 [US2] Extend `tests/e2e/fundraising.spec.ts`: `/running/fundraising/` on real data (figures from the published file, never pinned; nav item with `aria-current`; `og:image` and description present; sitemap entry) and the page in the preview states, at 360 and 320 px and on desktop: US2.1's text, US2.3's `first-day`, US2.5's list in `second-campaign`, `no-current` leading with past campaigns while `/running/` shows no card (US4.5), and the chart's table opening by keyboard (FR-061)
- [ ] T077 [P] [US2] Extend `tests/a11y/fundraising.spec.ts` to the page in every state so far, the chart's table open, in light, dark and forced colours, and to `/running/fundraising/` on real data

### Ship the slice

- [ ] T078 [US2] Run the PR routine's suites and `tests/e2e/fundraising.spec.ts`, and look at phone-width screenshots of each state and the rendered share image. Check the page's weight against the 150 KB budget, including with three years of daily points in a temporary local fixture (spec edge case *Very long campaign history*)
- [ ] T079 [US2] (owner, guided by the agent) Raise the PR by the PR routine. The owner reviews `/running/fundraising/` (`src/sections/running/pages/fundraising.astro`) on a phone and a desktop after the deploy, including a share preview, folded into the PR review
- [ ] T080 [US2] After the merge and deploy, check `/running/fundraising/` answers 200 with its menu item, `/og/running-fundraising.png` loads, and the sitemap lists the page. Note in `PROJECT_MEMORY.md`'s *Next session* that the next session starts with a short guided review of the live page and a question round on what the owner saw

**Checkpoint**: US1 and US2 both work on the live site.

---

## Phase 6: User Story 3 - Why I'm running for Martlets (Priority: P2)

**Goal**: The machinery that publishes an approved story and refuses anything else. The real story
joins separately, whenever it's approved (T114). This phase waits for nothing.

**Independent Test**: With a synthetic story in the preview tree, the approved text and nothing else
appears on the fundraising page; a story with `approved` removed, or changed after approval, stops
`validate-data`; with no story the page shows no section or placeholder.

**Goes live**: nothing visible. The page is unchanged until a story file exists.

**How to view it**: a screenshot of the `with-story` preview in the PR, with synthetic text. On the
live page, nothing changes.

**Needs the owner**: a look at the preview's layout in the PR.

**Not built yet**: the real story (T114) and `VOICE.md` (T115).

### Implementation for User Story 3

- [ ] T081 [P] [US3] Create `schemas/owner/campaign-story.schema.json`: draft 2020-12, `$id` `https://alexanderwebber.com/schemas/owner/campaign-story.schema.json`, title `CampaignStory`, closed, required `campaign`, `text`, `approved`. Data-model.md §6, verbatim: `campaign` "Equals the file name, and is a campaign ID" (slug); `text` "Non-empty plain text. Blank lines separate paragraphs. No HTML or Markdown"; `approved` "Required, with an `x-error` saying the story needs the owner's approval (FR-052)", the message reading "needs the owner's approval before it can be published"; `approved.date` "A date, not in the future" (defs `date`); `approved.text_sha256` 64 lower-case hex characters. Confirm in both languages that a missing `approved` shows this message, because `toIssues` names missing fields itself
- [ ] T082 [P] [US3] Add `schemas/fixtures/owner/campaign-story/valid/` and `schemas/fixtures/owner/campaign-story/invalid/` (no `approved`, no `text`, an empty `text`, a bad date, a short hash, an unknown key), with synthetic text only
- [ ] T083 [US3] Register the schema: `owner/campaign-story` in `src/sections/running/data/store/schemas.ts`; in `src/sections/running/data/store/files.ts` the rule `^owner\/stories\/[^/]+\.yaml$`, `RunningData.stories: Loaded<CampaignStory>[]`, the `store()` case and `named['owner/campaign-story'] = ['story', 'campaign']`; `OwnerData.stories: CampaignStory[]` in `src/sections/running/data/store/running-store.ts` and `src/sections/running/data/store/json-file-store.ts`, plus `stories: []` in the six fakes T006 lists
- [ ] T084 [US3] Add the story checks to `validateRunning` in `src/sections/running/validate.ts`, all errors: the file name equals `campaign`, and that campaign exists; `approved.date` not after `today`; `approved.text_sha256` equals the sha256 of `text` as parsed (UTF-8, `node:crypto`), with the contract's text `data/running/owner/stories/brighton-2027.yaml  field approved.text_sha256: the text has changed since it was approved; the owner must approve it again` (FR-052, SC-007)
- [ ] T085 [US3] In `src/sections/running/data/fundraising.ts`, add `story?` to `CampaignView`, from `OwnerData.stories`, as paragraphs split on blank lines
- [ ] T086 [US3] Create `src/sections/running/components/CampaignStory.astro`: a section headed "Why I'm running for <charity>", with one `<p>` per paragraph, escaped by Astro's normal `{...}` output, never `set:html`. Render it in `src/sections/running/components/FundraisingPage.astro` after the current campaign, only when there's a story: "No section or placeholder otherwise" (FR-044)
- [ ] T087 [US3] Create `scripts/approve-story.ts` and its npm script `approve-story`: `node scripts/approve-story.ts <campaign-id> [--date=YYYY-MM-DD]` reads `data/running/owner/stories/<campaign-id>.yaml`, computes the sha256 of `text` as parsed, and writes the `approved` block (`date`, default today in Europe/London; `text_sha256`), keeping the text and any comments (`parseDocument`, as `scripts/add-race-photo.ts`). It prints a reminder that the JustGiving page must be updated to match (FR-054) and never prints the text. The agent runs it only after the owner's explicit approval
- [ ] T088 [US3] Add the `with-story` state to `tests/fixtures/fundraising-preview/generate.ts`: a synthetic approved story, made-up text only, with a correct hash

### Tests for User Story 3 (straight after the code)

- [ ] T089 [P] [US3] Extend `tests/unit/fundraising-validate.test.ts`, quickstart.md §9 as tests: `approved` removed and a sentence changed after approval both fail with file and field, a future date fails, a wrong file name and an unknown campaign fail, a correct story passes, CRLF line endings don't change the hash, and an unapproved story fails `validateData`, which stops the gate (US3.4, FR-052, SC-007). No real story text is used
- [ ] T090 [P] [US3] Create `tests/unit/approve-story.test.ts` through `tests/helpers/temp-repo.ts`: the written block passes validation, the text is byte-identical afterwards, re-approval after an edit moves the hash, the reminder prints, and the text never appears in output
- [ ] T091 [US3] Extend `tests/unit/fundraising-cards.test.ts`, `tests/e2e/fundraising.spec.ts` and `tests/a11y/fundraising.spec.ts`: `with-story` shows the heading and exactly the approved paragraphs; `<b>` in the text comes out escaped; `active` has no story section and no placeholder; the US2 states are unchanged (US3.2, US3.5, FR-044)
- [ ] T092 [P] [US3] Document the story process in `src/sections/running/README.md`, with no story wording: drafts and raw answers stay outside the repo, only approved text enters a PR, `approve-story.ts` records the approval after the owner's explicit yes, and a revised text repeats the approval and the JustGiving update (FR-050, FR-051, FR-054, FR-055)

### Ship the slice

- [ ] T093 [US3] (owner, guided by the agent) Run the PR routine's suites, including quickstart.md §9, and raise the PR by the PR routine. The owner looks at the screenshot of `with-story` in the PR review

**Checkpoint**: an approved story can join with one file. Nothing else waits for it.

---

## Phase 7: User Story 4 - After race day, and later campaigns (Priority: P3)

**Goal**: The remaining card and page states, built and proven on previews now, so the fundraising
stays as a record after Brighton, and a later campaign needs only file edits.

**Independent Test**: In the preview states, `after-race` reads "Raised £X for <charity>", `after-result`
adds the result, `finished` shows "Final total" with no Donate and no notice, and `second-campaign`
shows the new campaign current with Brighton under past campaigns.

**Goes live**: nothing visible before race day: the code ships, and the card changes form by itself
from 5 April 2027, or once a result is recorded (T120 checks it).

**How to view it**: screenshots of `race-day`, `after-race`, `after-result` and `finished` in the PR,
on a phone and a desktop.

**Needs the owner**: a look at the screenshots in the PR.

### Implementation for User Story 4

- [ ] T094 [US4] Add `campaignPhase()` to `src/sections/running/domain/fundraising.ts`, as data-model.md §7: `before_race` for race state `upcoming` or `race_day`; `after_race` for `awaiting_result` or `completed`; `finished` for `finished: true`, "whatever the race state". The race state comes from `raceState()`. A race known only from `races/<slug>/race.yaml` is passed as `{ date, result_ref: slug }`, so it reads as `completed`
- [ ] T095 [US4] In `src/sections/running/data/fundraising.ts`, add `phase` and `result` to `CampaignView`, the result from `raceResult()` with the official time if recorded, else the watch time, as the hero shows it (FR-033). Past campaigns take the same fields. A focus race with no campaign gives no `current`, and the area and page stay (US4.5)
- [ ] T096 [US4] Add the remaining rows of contracts/routes.md's card table to `src/sections/running/components/FundraisingFigures.astro` and `src/sections/running/components/FundraisingCard.astro`: **Raised £2,340 for Martlets**, bar "117%" as secondary detail, target and supporters, Donate; with a result, **Raised £2,340 for Martlets** · Brighton Marathon: 3:18:42; finished, **Raised £2,340 for Martlets**, secondary bar, "Final total, last updated 3 Jul 2027", **no Donate**, no `FundraisingUpdated` and no notice. On race day the card stays in its pre-race form until a result is recorded or the day has passed (FR-023, FR-032, FR-033, spec edge cases)
- [ ] T097 [US4] In `src/sections/running/components/FundraisingPage.astro`, follow the same forms after race day (FR-041): `finished` leaves no Donate and no notice. In `src/sections/running/data/fundraising.ts` and `src/sections/running/components/PastCampaigns.astro`, a campaign that moves to past keeps its chart history in its file, and "Final total" uses `last_read_at` as the date
- [ ] T098 [US4] Add the states `race-day` (pre-race form on the day), `after-race` ("Raised £X", no result yet), `after-result` (with a result) and `finished` (final total, no Donate, no notice) to `tests/fixtures/fundraising-preview/generate.ts`, which completes contracts/routes.md's 13 states

### Tests for User Story 4 (straight after the code)

- [ ] T099 [P] [US4] Extend `tests/unit/fundraising.test.ts`: `campaignPhase` for every race state and `finished`; a race known only under `races/`. Extend `tests/unit/fundraising-cards.test.ts`: each new card row; US4.1's exact text; `finished` with no Donate, no updated line, no notice; a finished campaign never stale, however old (FR-005, FR-023)
- [ ] T100 [US4] Extend `tests/e2e/fundraising.spec.ts` and `tests/a11y/fundraising.spec.ts` to the four new states, at 360 and 320 px and on desktop, with zero axe violations in light, dark and forced colours
- [ ] T101 [US4] Prove SC-009 and US4.4 in `tests/unit/fundraising-validate.test.ts` through a temp repo: from a Brighton tree, add a campaign for a later race, make that race the focus race and mark Brighton `finished`, with file edits only; validation passes, `loadFundraising` gives the new campaign current (once its figures exist) and Brighton past with its final total and its points intact; with the focus race on a race with no campaign, `current` is undefined and `past` lists Brighton. Add to `ingest/tests/unit/test_fundraising.py` that a finished campaign's published file doesn't change and its alert closes
- [ ] T102 [US4] (owner, guided by the agent) Run the PR routine's suites and raise the PR by the PR routine. The owner looks at the screenshots of the four states of `tests/fixtures/fundraising-preview/`, at phone and desktop width, in the PR review

**Checkpoint**: every state in contracts/routes.md is built and tested.

---

## Phase 8: Polish & Cross-Cutting Concerns (delivery slice 7)

**Purpose**: Prove the feature against its hardest success criteria, then the adversarial review.

**Goes live**: no visible change, unless the review finds something.

**How to view it**: the PR gives each drill's result. The live pages are as Phases 4–5 left them.

**Needs the owner**: a short usability check, folded into the review (T112).

- [ ] T103 Extend the drill in `tests/e2e/stale.spec.ts` for SC-003 (quickstart.md §7): in the scratch copy, write `data/running/published/fundraising/brighton-2027.json` with a `last_read_at` 7 days old, whether or not real data exists. Add `/running/fundraising/` to `pageTypes()`. Assert on the landing and fundraising pages: the gate passes on that data; the total, target, supporters, "Figures updated …" and the notice are in the built HTML; with `/running/api/fundraising-freshness` answering 503, and with JS off, they all stay and Donate still works; with Running's freshness fresh and fundraising's stale, only the fundraising notice shows, and the reverse holds too. Locators stay separate: `[data-stale-notice]` for Running and `[data-fundraising-stale]` for fundraising. The drill keeps building in the desktop project only
- [ ] T104 Create `tests/e2e/fundraising-none.spec.ts`, the SC-006 drill (quickstart.md §8), building once in the desktop project as `stale.spec.ts` does: a scratch copy with `campaigns.yaml` but no published file. Expected: no `/running/fundraising/`, no `/og/running-fundraising.png`, no "Fundraising" in any nav, no sitemap entry, and no `<article class="fundraising-card"` element in any page (the class name is in two pages' inlined CSS, so test for the element, not the string). A second assertion on the same build: the hero keeps its charity line
- [ ] T105 Prove SC-004 (quickstart.md §10): `npm run scan-privacy` gives 0 findings on real data and a full build. Add a test to `tests/unit/scan-privacy.test.ts` and `ingest/tests/unit/test_cli.py` that plants `"totalEstimatedGiftAid": "12.50"` and a `donorName` key in a temporary published file, and confirm both `publish-check` and the scan fail. Confirm the four layers of contracts/data-files.md are each tested: allow-list (T026), no raw storage (T026), the schema (T031), the scan (T033)
- [ ] T106 Add `{ type: 'fundraising', path: () => '/running/fundraising/' }` to `PAGE_TYPES` in `scripts/lighthouse-budget.mjs`, then run `node scripts/lighthouse-budget.mjs` (quickstart.md §12). Expected: the landing page and `/running/fundraising/` at 90 or more on mobile, landing LCP within 2.5 s, HTML + CSS + JS at most 150 KB, client JS at most 10 KB, no third-party requests (FR-060, SC-010). The landing page sat near 90 on the 2-core CI runner, so read the nightly Quality run after the merge too
- [ ] T107 Check the last quality bars across the feature: every fundraising view at 320 px with no horizontal scroll; keyboard reaches Donate and the chart's table; each page has a unique title, description, canonical URL and share image; `git diff origin/main --stat -- src/shared` is empty and `npm run check-boundaries` passes (FR-060, FR-064, SC-010)
- [ ] T108 Run the graduation self-review (constitution *Review at graduation*; plan.md *Graduation plan*) as an adversarial pass over the whole feature, recording findings in the PR: can any path write a figure outside the allow-list; can the key reach a log, an artifact or the `publish` job; does a fundraising failure reach running, or the reverse, on every step of `refresh.yml`; can a failed publish show old figures as just updated (SC-005); does a stale or missing state file break a build; do the 12-hour and 24-hour clocks match the spec; does anything render an unapproved story. Record that FR-003's isolation covers reads: the gate is shared, and a failed `process` stops fundraising's publish step (research.md R4). Fix what it finds
- [ ] T109 [P] Update the docs: `src/sections/running/README.md` (the fundraising area, its data, the filled `fundraising` slot replacing line 148's "nothing fills yet", and how a campaign is added or marked finished, FR-020; this is the graduation design note), `ingest/README.md`, `README.md` (the pages table gains Fundraising, and line 30's *Next* drops it), `BACKLOG.md` (remove the two fundraising entries), `specs/001-running-section/quickstart.md` only if it describes the refresh steps changed here
- [ ] T110 Run every scenario in `specs/002-fundraising/quickstart.md` that can run now (§1, §5–§10, §12), and note in the PR any that differ
- [ ] T111 Raise the PR by the PR routine. After the merge, update `PROJECT_MEMORY.md`: move fundraising's status to shipped, write T120–T121's triggers into *Next session* and confirm T113–T119's are there, so each is checked at session start with no owner reminder
- [ ] T112 (owner, guided by the agent) SC-001, folded into the next review: the agent offers the usability check once, with an exact script: at least 5 people unfamiliar with the site, on a phone, say within 15 seconds of opening the landing page how much has been raised and the target, and reach the JustGiving page within 2 taps; at least 4 should manage it. Record the result, or the owner's choice to skip it as with 001's hallway test, in `PROJECT_MEMORY.md`

**Checkpoint**: the feature has graduated. What remains waits on others or on a date.

---

## Standing follow-ups (waiting on replies or dates; nothing above depends on them)

**Purpose**: Each has a trigger. The agent checks the triggers at session start, from `PROJECT_MEMORY.md`'s
*Next session* block. No task elsewhere in this file depends on these.

### Blocked on replies

- [ ] T113 [US3] BLOCKED on the reviewers' reply. At each session start, ask whether the reviewers the owner chose have replied, and record the answer in `PROJECT_MEMORY.md`. Nothing from the draft goes in the repo, a PR or a commit before approval
- [ ] T114 [US3] BLOCKED on T113. (owner, guided by the agent) Once the reviewers' passage is in and the owner explicitly approves the final text: check statement by statement, with the owner, that every fact comes from the owner's answers or the site's stored data, leaving any gap as a question (FR-051, SC-008); re-check any published figure the approved story quotes against its source; create `data/running/owner/stories/brighton-2027.yaml` with the approved story; run `node scripts/approve-story.ts brighton-2027`; run `npm run scan-privacy` on it before the PR, because stories are exempt only from the new key rule, and a line such as `sleep:` or a "£… Gift Aid" sentence would still trip the older rules; raise it in its own PR by the PR routine, with *How to view it* pointing at https://alexanderwebber.com/running/fundraising/. After the deploy, confirm the page shows exactly the approved text (SC-007), and guide the owner through pasting it into JustGiving, and retitling the page if they wish (FR-054)
- [ ] T115 [US3] BLOCKED on T114. Create `VOICE.md` in the same PR as T114: style lessons from the owner's edits to the draft, not private facts, plus the lesson that personal passages are written by the people they belong to, while the agent's draft covers framing and facts (FR-053, US3.3). Ask the owner whether an anonymised question, draft and approved-text pair may be kept as the first example for the eval suite the CV & Blog spec will need (spec assumption *Eval suite*)
- [ ] T116 [US1] BLOCKED on Martlets' reply. When Martlets answers: record the "I'm supporting" logo's conditions in `PROJECT_MEMORY.md`, then add the logo as supplied to `src/sections/running/components/FundraisingCard.astro` and `src/sections/running/components/FundraisingPage.astro`, following those conditions, in a small PR by the PR routine, with the file served from this site (no third-party request), alt text, and the image passing `npm run scan-images`. Until then the charity is named in text, and the layout holds no space for it (spec assumption *Charity branding*)

### Triggered by an event or a date

- [ ] T117 At the first real donation on the live page (the session after the card shows a non-zero total): repeat the supporters check of quickstart.md §4 against the owner's own view of the JustGiving page; confirm the number format parsed, or that an alert opened if it didn't, and that a run logged `Publishing: fundraising figures changed`, the first real proof of that branch. If `donationCount` differs, change `supportersText`'s word to "donations" in `src/sections/running/domain/fundraising.ts`, in a small PR (spec assumption *Supporters*). Staging proved the number format and the count on nine donations (T040), but its two repeat donations carried different display names, so keep an eye out for a live repeat donor under one name
- [ ] T118 SC-002: from the first donations, the agent compares the bot's commit times with the owner's donation times, for a month, in `PROJECT_MEMORY.md`, and times one `gh workflow run refresh.yml` end to end against the 30-minute limit. Report the percentage within 3 hours at the month's end
- [ ] T119 SC-005 (owner, guided by the agent), folded into reviews, quickstart.md §11: on 10 occasions, the total, target and supporters on the site match the JustGiving page as at the site's "last updated" time. The agent keeps the tally in `PROJECT_MEMORY.md` and only asks when a review is already happening
- [ ] T120 After 4 April 2027, quickstart.md §13: check the card's change of form on the live site, and, once the owner records the race result, that it shows beside "Raised £X for Martlets". Check the fundraising page's form too, and record it in `PROJECT_MEMORY.md`
- [ ] T121 (owner, guided by the agent) At a session in June 2027, before the page expires on 3 July 2027: the agent asks whether donations have stopped and whether to mark Brighton finished. On a yes, set `finished: true` in `data/running/owner/campaigns.yaml` in a PR by the PR routine, and confirm reads stop, "Final total" shows, Donate goes and any open issue closes (FR-023, research.md R9). On a no, ask again before 3 July 2027, and watch for the `page_not_active` or `page_not_found` alert

---

## Traceability

Every requirement, contract and quickstart scenario, by task.

| Requirement | Tasks |
|---|---|
| FR-001 | T050, T059 |
| FR-002 | T023, T037 |
| FR-003 | T012, T015, T017, T023, T027, T034, T055, T108 |
| FR-004, FR-005 | T017, T044, T045, T049, T059, T099, T103 |
| FR-006 | T011, T020, T029, T041, T121 |
| FR-007 | T009–T013, T035 |
| FR-008 | T004, T018, T028, T101 |
| FR-010, FR-011, FR-012 | T004, T012, T013, T022, T025, T026, T031, T033, T105 |
| FR-020, FR-021 | T003, T005, T024 |
| FR-022 | T018, T028, T046, T065, T073 |
| FR-023 | T017, T018, T020, T027, T096, T097, T099, T101, T121 |
| FR-024 | T007, T016, T024, T032 |
| FR-025 | T047, T057 |
| FR-030 to FR-034 | T045, T048, T050–T053, T056–T059, T094–T096, T099 |
| FR-040 | T064, T071, T076, T080, T104 |
| FR-041 to FR-043 | T065–T069, T073, T074, T076, T097 |
| FR-044 | T085, T086, T091 |
| FR-050 to FR-055 | T081–T092, T113–T115 |
| FR-060 | T060, T070, T077, T100, T106, T107 |
| FR-061, FR-062 | T045, T050, T051, T059, T066, T076, T103 |
| FR-063 | T045, T050, T056 |
| FR-064 | T107 |
| FR-065 | T050, T057 |
| SC-001 | T112 |
| SC-002 | T037, T063, T118 |
| SC-003 | T027, T029, T103 |
| SC-004 | T022, T026, T031, T033, T105 |
| SC-005 | T017, T119 |
| SC-006 | T064, T104 |
| SC-007 | T084, T089, T114 |
| SC-008 | T114 |
| SC-009 | T101 |
| SC-010 | T060, T077, T100, T106, T107 |

| Contract or guide | Tasks |
|---|---|
| contracts/provider-adapter.md | T010–T014, T025, T026, T041, T042 |
| contracts/pipeline.md: CLI | T017, T018, T020, T021, T030, T008 |
| contracts/pipeline.md: `refresh.yml`, static check | T001, T023, T034 |
| contracts/pipeline.md: alert contract | T019, T020, T029 |
| contracts/pipeline.md: freshness route and script | T044, T049, T055, T059, T063 |
| contracts/data-files.md: registration, schemas | T003–T006, T008, T031, T081–T083 |
| contracts/data-files.md: referential checks | T007, T032, T084, T089 |
| contracts/data-files.md: privacy scan | T022, T033, T105 |
| contracts/routes.md: card | T048–T053, T057, T096, T099 |
| contracts/routes.md: page, share image | T064–T071, T074, T076 |
| contracts/routes.md: 13 preview states | T054, T072, T088, T098 |
| quickstart.md §0–§3 | T002, T026–T030, T036, T041 |
| quickstart.md §4 | T039, T040, T042, T043, T117 |
| quickstart.md §5–§6 | T037, T063, T061 |
| quickstart.md §7–§10 | T103, T104, T089, T105 |
| quickstart.md §11–§13 | T119, T106, T120, T121 |

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Phase 1. BLOCKS all user stories.
- **Staging check (Phase 3)**: depends on Phase 2's merge. It needs the owner, and if staging can't
  be used, Phase 4 goes ahead and T117 takes its place.
- **Phase 4 (US1)**: depends on Phase 2 (and on T043 for the supporters label, when staging ran).
- **Phase 5 (US2)**: depends on Phase 4: the page reuses `FundraisingFigures` and `FundraisingUpdated`.
- **Phase 6 (US3)**: depends on Phase 5: the story sits on the page.
- **Phase 7 (US4)**: depends on Phase 5. It can come before or after Phase 6, and needs nothing from it.
- **Polish (Phase 8)**: depends on Phases 4–7.
- **Standing follow-ups**: T113–T116 are BLOCKED on other people. T114 and T115 need Phase 6, and T116
  needs Phases 4–5, but **no task in any phase depends on them**. The card and page ship with the
  charity named in text, and with no story section.

### User story dependencies

- **US1 (P1)**: after Phase 2. The MVP.
- **US2 (P2)**: after US1's shared components.
- **US3 (P2)**: after US2's page.
- **US4 (P3)**: after US2's page and past-campaign list.

### Within each phase

- Code first, then its tests (TDD isn't required).
- Schemas and registration before the stages that write the files.
- T024 (data) comes after T006 and T007, or the gate rejects `campaigns.yaml` as an unexpected file.
- T023 (workflow) and T024 merge together, in Phase 2's one PR.

### Parallel opportunities

- **Phase 2**: T003, T004 and T005 together; T012 and T014 once T010–T011 exist; T030–T035 together
  after the stages exist.
- **Phase 4**: T048 alongside the components; T055, T056, T057 and T060 together after the code.
- **Phase 5**: T066, T067 and T070 together; T073, T074 and T077 together.
- **Phase 6**: T081 and T082 together; T089, T090 and T092 together.
- **Phase 7**: T099 beside T100, after the implementation.
- **Polish**: T109 alongside the drills.

---

## Parallel Example: Phase 2

```text
# Schemas and fixtures together:
Task: "Create schemas/owner/campaigns.schema.json"
Task: "Create schemas/published/fundraising-campaign.schema.json"
Task: "Add fixtures under schemas/fixtures/owner/campaigns/ and schemas/fixtures/published/fundraising-campaign/"

# Tests together, once the stages exist:
Task: "CLI tests in ingest/tests/unit/test_cli.py"
Task: "Validation tests in tests/unit/fundraising-validate.test.ts"
Task: "Scan tests in tests/unit/scan-privacy.test.ts"
Task: "Workflow check in tests/contract/refresh-workflow.test.ts"
```

## Parallel Example: User Story 1

```text
# After T053, the unit tests together:
Task: "Worker tests in tests/unit/fundraising-worker.test.ts"
Task: "Domain tests in tests/unit/fundraising.test.ts"
Task: "Card tests in tests/unit/fundraising-cards.test.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phases 1 and 2: reads and history start, and nothing shows.
2. Phase 3, with the owner.
3. Phase 4: the card goes live. **Stop and review on a phone.** This is already useful: people can
   see the cause and give.

### Incremental delivery

Each phase is one PR and one session, and each leaves the live site working.

1. Foundation → real reads, invisible.
2. US1 → the card (MVP).
3. US2 → the page, chart and share image.
4. US3 → the story machinery. The approved story joins by itself later.
5. US4 → the after-race forms, dormant until April 2027.
6. Polish → drills and graduation.
7. Standing follow-ups, as their triggers arrive.

---

## Notes

- Tasks marked [P] touch different files, with no dependency on an incomplete task.
- Use made-up values in every fixture. No real response, name or identifier is committed.
- **Nothing from the story draft goes in the repo, PRs or commit messages before approval.** All story
  tests and previews use synthetic text.
- The JustGiving key is in one workflow step only. Secrets from the owner come through the local file
  outside the repo, piped with nothing printed.
- Reading the website by script is forbidden by JustGiving's terms, so every check goes through the API.
  Local reads count towards the quota of 1,000 calls a day.
- On a commit from PowerShell, avoid piping a here-string to `git commit -F -` (it adds a BOM).
