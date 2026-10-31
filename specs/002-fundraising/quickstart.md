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

## 2. One real read, against a local archive

```text
cd ingest; uv run awingest fundraising-read --archive local --archive-dir .archive
```

Expected: summary `outcome: ok`, `read: 1`, `changed: 1` (no published file yet). `.archive/state/fundraising.json`
holds only the fields in [data-model.md](data-model.md) §2. A search of that folder finds no owner name,
story text or identifier. Before the first donation the figures are 0, 500 and 0.

## 3. A mistyped page

Point a temporary local `campaigns.yaml` at a page address that doesn't exist, then read once.

Expected: `page_not_found`, exit 15, and state records the failure with no `latest`. If the real status
isn't 404, change the adapter's mapping and its test (research.md R1).

## 4. Staging: the two unproven points (research.md R8)

**Owner**, guided: a page on JustGiving's staging environment, and test-card donations totalling over
£1,000, with two from one donor. A second staging page with no target.

```text
$env:JUSTGIVING_REALM = 'staging'; cd ingest; uv run awingest fundraising-read --archive local --archive-dir .archive/staging
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

After the workflow change merges and `campaigns.yaml` holds Brighton:

```text
gh workflow run refresh.yml --ref main
```

Expected:

- The fetch job's fundraising step passes, the run publishes with "fundraising figures changed", the bot
  commits `data/running/published/fundraising/brighton-2027.json`, and the deploy runs.
- The next run finds the same figures: no publish, no commit, and
  `GET /running/api/fundraising-freshness` shows a later `last_read_at`.
- **FR-003**: breaking the live key on `main` to test this isn't worth the risk, so the static workflow
  check and the failing-provider pytest cover it. A real run's log confirms the key is only in the read
  step's `env`.

## 6. Previews

```text
$env:SHELL_PREVIEW = '1'; npm run build; npx playwright test tests/e2e/fundraising.spec.ts tests/a11y/fundraising.spec.ts
```

Expected: each state in [routes.md](contracts/routes.md) renders as its row says, at 320 px and on desktop,
in light, dark and forced colours, with axe at zero violations. The agent looks at phone-width screenshots
of every state before raising a UI PR, and puts them in the PR.

## 7. SC-003: JustGiving unreadable for 7 days

`tests/e2e/stale.spec.ts` gains a fundraising part. In its scratch copy of the site, a synthetic campaign's
`last_read_at` is 7 days old.

Expected, on the landing and fundraising pages:

- The gate passes on that data.
- The total, target, supporters, "Figures updated …" and the notice are in the built HTML.
- With `/running/api/fundraising-freshness` answering 503, and with JS off, they all stay, and Donate
  still works.
- With Running's freshness fresh and fundraising's stale, only the fundraising notice shows, and the
  reverse holds too.

The alert within 24 hours and the 12-hour threshold are pytest cases with a fixed clock, including
`state/fetch-status.json` staying untouched and a running fetch carrying on with corrupt fundraising state.

## 8. SC-006: nothing before figures

The drill builds a site copy with `campaigns.yaml` but no published file.

Expected: no `/running/fundraising/`, no `/og/running-fundraising.png`, no "Fundraising" in any nav, no
sitemap entry, and no `fundraising-card` in any page.

## 9. SC-007: the story gate

In a temporary copy, add `stories/<id>.yaml` with `approved` removed, then with a sentence changed after
approval. Run `npm run validate-data`.

Expected: both fail, naming file and field; the build gate stops; the live site is unchanged. No real story
text is used.

## 10. SC-004: privacy

```text
npm run scan-privacy
```

Expected: 0 findings. Then plant `"totalEstimatedGiftAid": "12.50"` and a `donorName` key in a temporary
published file, and confirm both `publish-check` and the scan fail.

## 11. SC-005: spot checks

**Owner**, folded into reviews: on 10 occasions, the total, target and supporters on the site match the
JustGiving page as at the site's "last updated" time. The agent keeps the tally in `PROJECT_MEMORY.md`.

## 12. Performance

```text
node scripts/lighthouse-budget.mjs
```

Expected: the landing page and `/running/fundraising/` at 90 or more on mobile, HTML + CSS + JS at most
150 KB, client JS at most 10 KB, no third-party requests. The page type joins the script's list.

## 13. After race day (from April 2027)

- The agent checks the card's change of form on the live site after 4 April 2027, and the owner's race
  result in it.
- **Before 3 July 2027**, when the page expires, the agent asks the owner whether donations have stopped,
  and marks the campaign `finished` in a PR (research.md R9).
- SC-009 is proven now by the `second-campaign` preview, and for real at the next charity run.
