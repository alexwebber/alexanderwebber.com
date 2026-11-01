# Quickstart and Validation Guide: Fundraising

**Feature**: 002-fundraising | Contracts: [contracts/](contracts/) | Data: [data-model.md](data-model.md)

Scenarios that prove the feature end to end. The commands show the plan's layout. The agent runs them;
steps marked **Owner** are the few that need the owner.

## 0. Prerequisites

- The toolchain from [001 quickstart](../001-running-section/quickstart.md) §0.
- Done (2026-10-31): the JustGiving page; a SKY API developer account subscribed to the **JustGiving
  APIs** product (not Standard APIs); `JUSTGIVING_SUBSCRIPTION_KEY` as a GitHub Actions secret and a user
  environment variable on the owner's PC.
- Secrets from the owner come through the local file outside the repo, and are piped without printing
  (PROJECT_MEMORY.md).
- **Quota**: 1,000 calls a day, and every local read counts. Reading the website by script is forbidden
  (research.md R0), so every check goes through the API. Don't save a raw response anywhere in the repo.

## 1. Unit and contract tests

```text
cd ingest; uv run pytest tests/contract/test_justgiving_adapter.py tests/unit/test_fundraising.py tests/contract/test_alerts.py
npx vitest run tests/unit/fundraising tests/contract/refresh-workflow.test.ts
```

Expected: every row of [provider-adapter.md](contracts/provider-adapter.md) *Tests* passes, including the
sentinel test, and no real identifier or response appears in a fixture.

**Result (2026-11-01):** 220 pytest and 193 Vitest cases pass; the fixtures hold made-up names and
all-zero GUIDs only.

## 2. One real read, against a local archive

```text
cd ingest; uv run awingest fundraising-read --archive local --archive-dir .archive
```

Expected: summary `outcome: ok`, `read: 1`, `changed: 1` (no published file yet). `.archive/state/fundraising.json`
holds only the fields in [data-model.md](data-model.md) §2. A search of that folder finds no owner name,
story text or identifier. Before the first donation the figures are 0, 500 and 0.

## 3. A mistyped page

Make a scratch repo root outside the repo (a `schemas/` junction plus a temporary
`data/running/owner/campaigns.yaml`), point it at a page address that doesn't exist, and read once with
`--repo-root <scratch>`.

Expected: `page_not_found`, exit 15, and state records the failure with no `latest`. If the real status
isn't 404, change the adapter's mapping and its test (research.md R1).

## 4. Staging: the two unproven points (research.md R8)

**Result (2026-11-01):**

| Check | Result |
|---|---|
| Figures with pence and thousands | Plain strings with no comma: `'630.50'`, then `'1030.75'`, read as 103,075 pence |
| `donationCount` against the supporters shown | Equal: 7 before the test, 9 after, and the page also says "9 donations" |
| Online, offline and SMS totals | They sum, with the whole total online |
| A total over target | No problem, at 103% |
| A hidden donation amount | Counted in the total and the count |
| A page with no target | **Not tested**: no such page could be made. It fails safely if the field surprises us |

The two test donations came from one owner under different display names, so one name repeated isn't
tested (T117). A page created on staging opened in its dashboard, then gave a 404 everywhere within
minutes, so the check used an existing shared test page. A donation reaches the API at once, and the
public page within a few minutes. The page rounds to the nearest pound (£1,031), while this site rounds
down (£1,030, FR-063).

**Owner**, guided: a page on JustGiving's staging environment, and test-card donations totalling over
£1,000, with two from one donor. A second staging page with no target.

```text
$env:JUSTGIVING_REALM = 'staging'; cd ingest; uv run awingest fundraising-read --archive local --archive-dir .archive/staging --repo-root <scratch>
```

| Check | Expected | If not |
|---|---|---|
| Figures with pence and thousands parse | A correct `raised_pence` | Widen the parser and its tests |
| `donationCount` against the supporters shown on the staging page | Equal, with the repeat donor | Label the figure "donations" (spec assumption *Supporters*) |
| Online, offline and SMS totals against the grand total | They sum | Check which total JustGiving's page shows (FR-012) |
| A page with no target | `fundraisingTarget` is `null`, `""` or `"0"` | Adjust the parser's no-target rule |

Repeat the supporters check at the first real donation on the live page. `ingest/.archive/` is
gitignored; remove `staging` from it afterwards, and clear `JUSTGIVING_REALM`.

## 5. The pipeline on `main`

The merge changes `data/running/owner/**`, which starts a refresh by itself. That run does the first
publish, with the reason "owner files changed":

- The fetch job's fundraising step passes, the bot commits
  `data/running/published/fundraising/brighton-2027.json`, and the deploy runs.

Then prove the idle case:

```text
gh workflow run refresh.yml --ref main
```

- The run finds the same figures: no publish and no commit.
- Once the route exists (the landing card's slice), `GET /running/api/fundraising-freshness` shows a later
  `last_read_at` after each read.
- The "fundraising figures changed" reason can only be proven by a real change, so it is checked at the
  first donation.
- **FR-003**: breaking the live key on `main` to test this isn't worth the risk, so the static workflow
  check and the failing-provider pytest cover it. A real run's log confirms the key is only in the read
  step's `env`.
- **A failed deploy** (T108): the next refresh logs `Publishing: the last refresh's deploy didn't
  finish.` and deploys its gated build, so the live "Figures updated" time can't run ahead of the page.

**Result:** the first publish, the idle case, the route's later `last_read_at` and the "fundraising
figures changed" reason were all proven on `main` by 1 Nov 2026 (tasks.md T037, T063, T117).

## 6. Previews

```text
$env:SHELL_PREVIEW = '1'; npm run build; npx playwright test tests/e2e/fundraising.spec.ts tests/a11y/fundraising.spec.ts
```

Expected: each state in [routes.md](contracts/routes.md) renders as its row says, at 320 px and on desktop,
in light, dark and forced colours, with axe at zero violations. The agent looks at phone-width screenshots
of every state before raising a UI PR, and puts them in the PR.

**Result (2026-11-01):** the whole Playwright suite on a `SHELL_PREVIEW=1` build, both projects: 579 passed
and 55 skipped by design (the build-a-copy drills run in the desktop project only), including every
fundraising state.

## 7. SC-003: JustGiving unreadable for 7 days

`tests/e2e/stale.spec.ts` has a fundraising part. In its scratch copy of the site, the focus race's
campaign gets a published file with made-up figures and a `last_read_at` 7 days old, whatever the real
data holds (a `finished` mark is removed, since a finished campaign has no notice).

Expected, on the landing and fundraising pages:

- The gate passes on that data.
- The total, target, supporters, "Figures updated …" and the notice are in the built HTML.
- With `/running/api/fundraising-freshness` answering 503, and with JS off, they all stay, and Donate
  still works.
- With Running's freshness fresh and fundraising's stale, only the fundraising notice shows, and the
  reverse holds too.

The alert at the first refresh after 24 hours is a pytest case with a fixed clock, as are
`state/fetch-status.json` staying untouched and a running fetch carrying on with corrupt fundraising state.
Corrupt fundraising state also opens each active campaign's issue at once (T108). The 12-hour threshold is
a Vitest case.

**Result (2026-11-01):** all five fundraising cases pass in the desktop project, with the 503 and no-JS
cases following Donate to a stubbed JustGiving page.

## 8. SC-006: nothing before figures

The drill builds a site copy with `campaigns.yaml` but no published file.

Expected: no `/running/fundraising/`, no `/og/running-fundraising.png`, no "Fundraising" in any nav, no
sitemap entry, and no `<article class="fundraising-card"` element in any page. The class name itself is in
the inlined CSS of two pages, so check for the element, not the string.

**Result (2026-11-01):** `tests/e2e/fundraising-none.spec.ts` passes (desktop project, one build). It
also checks that the data validates, that no page links to `/running/fundraising/`, and that the hero
keeps "For Martlets".

## 9. SC-007: the story gate

In a temporary copy, add `stories/<id>.yaml` with `approved` removed, then with a sentence changed after
approval. Run `npm run validate-data`.

Expected: both fail, naming file and field; the build gate stops; the live site is unchanged. No real story
text is used.

**Result (2026-11-01):** in a temp copy of the real data, a made-up story with no `approved` failed on
`approved` ("needs the owner's approval before it can be published"), the same story approved passed, and
one changed sentence failed on `approved.text_sha256` ("the text has changed since it was approved").

## 10. SC-004: privacy

```text
npm run scan-privacy
```

Expected: 0 findings. Then plant `"totalEstimatedGiftAid": "12.50"` and a `donorName` key in a temporary
published file, and confirm both `publish-check` and the scan fail.

**Result (2026-11-01):** 0 findings on the real data and a deploy build (without the R2 run-ID map, which
CI adds). The planting is now two tests: `tests/unit/scan-privacy.test.ts` ("SC-004: a published file
with a planted Gift Aid figure and donor name fails the scan") and `ingest/tests/unit/test_cli.py`
(`test_publish_check_fails_a_planted_gift_aid_figure_or_donor_name`). The scan reports a rule's first
match in a file, so the test plants each key alone too.

## 11. SC-005: spot checks

**Owner**, folded into reviews: on 10 occasions, the total, target and supporters on the site match the
JustGiving page as at the site's "last updated" time. The agent keeps the tally in `PROJECT_MEMORY.md`.

## 12. Performance

```text
node scripts/lighthouse-budget.mjs
```

Expected: the landing page and `/running/fundraising/` at 90 or more on mobile, HTML + CSS + JS at most
150 KB, client JS at most 10 KB, no third-party requests. The page type joins the script's list.

**Result (2026-11-01, deploy build, Lighthouse 13.5.0):** landing 100 and 100, LCP 0.90 s, 12.0 KB gzip;
fundraising 100 and 100, LCP 0.90 s, 6.9 KB gzip; no script files (the freshness scripts are inline) and no
third-party requests. Read the nightly Quality run after the merge, as the 2-core runner is noisier.

## 13. After race day (from April 2027)

- The agent checks the card's change of form on the live site after 4 April 2027, and the owner's race
  result in it.
- **Before 3 July 2027**, when the page expires, the agent asks the owner whether donations have stopped,
  and marks the campaign `finished` in a PR (research.md R9).
- SC-009 is proven now by the `second-campaign` preview, and for real at the next charity run.
