# Contract: Pages, Card and Page States

Extends Running's [routes contract](../../001-running-section/contracts/routes.md).

| URL | Page | Story | Notes |
|---|---|---|---|
| `/running/` | Landing, with the fundraising card in the hero's `fundraising` slot | US1 | Only with a current campaign that has figures; otherwise the slot is empty and the hero is unchanged |
| `/running/fundraising/` | Fundraising page | US2, US3, US4 | **Exists only once a campaign has figures** (FR-040, research.md R13) |
| `/og/running-fundraising.png` | Share image | FR-060 | Same condition. Charity, race and total raised at the last deploy. No figures on the landing image, which stays as it is |
| `/running/api/fundraising-freshness` | Worker JSON | FR-004 | [pipeline.md](pipeline.md) |
| `/fundraising-preview/<state>/` | Test-only previews | All | `SHELL_PREVIEW=1` builds only |

## Route registry

`integration.ts` gains a `fundraising` area, added to `runningAreas` only when `campaignsWithFigures()`
finds a configured campaign with a published file:

- label "Fundraising", href `/running/fundraising/`, description "Fundraising for charity, and how to
  give.";
- after Health in the nav;
- its routes are injected only then, so the sitemap, the nav and `SectionLinks` follow with no other
  change (SC-006).

The fundraising target isn't a goal: nothing here touches the Goals page or `featuredGoals()` (FR-025).

## Landing card (`components/FundraisingCard.astro`)

A compact `<article class="fundraising-card">` passed to `Hero`'s named slot, so it sits after the
headline facts, in the hero's first column on wide screens, and before the build chart and the goals
on phones (FR-034). It shares the goal cards' shell through `styles/goal-card.css`, where
`.fundraising-card` joins the shared selectors, and uses `ProgressBar`. A left accent edge and the
Donate button keep it visibly its own (FR-031). No client JS but the freshness script.

`Hero.astro` drops its `For <charity>` line when the slot is filled, because the card says the same
directly below it.

| State | Lead line | Bar | Secondary | Donate |
|---|---|---|---|---|
| Before race, target set | **£1,250 raised of £2,000** | 62% | 37 supporters · For Martlets | Yes |
| Target reached exactly | **£2,000 raised of £2,000** | Full | "Target reached: 100%" · 37 supporters · For Martlets | Yes |
| Target beaten | **£2,160 raised of £2,000** | Full | "Target beaten: 108%" · 37 supporters · For Martlets | Yes |
| No target | **£1,250 raised** | None | 37 supporters · For Martlets | Yes |
| Nothing raised yet | **£0 raised of £500** | Empty | "No supporters yet" · For Martlets | Yes |
| After race, no result yet | **Raised £2,340 for Martlets** | 117%, secondary | Target, supporters | Yes |
| After race, result | **Raised £2,340 for Martlets** · Brighton Marathon: 3:18:42 | Secondary | Target, supporters | Yes |
| Finished | **Raised £2,340 for Martlets** | Secondary | "Final total, last updated 3 Jul 2027" | **No** |

Every active state also shows "Figures updated …", separate from the page's Running "Last updated"
line (FR-004), and the stale notice past `stale_after_hours` (FR-005). A finished campaign shows neither.

**Rules that hold in every state**

- Amounts round down to the whole pound; the percentage rounds down, so 99.9% never shows as 100%
  (FR-032, FR-063).
- The bar's `valueText` gives its value in words, e.g. "£1,250 of £2,000, 62%" (FR-061).
- Nothing renders in the slot without a current campaign with figures: no wrapper, no heading (FR-030).
- All figures and the Donate link are in the built HTML (FR-062).

**Donate**: a plain `<a>` reading "Donate on JustGiving", with `href` set to the campaign's `page_url`,
styled as a button in the Running accent, at least 44 px tall, opening in the same tab (FR-001, FR-065).
No JustGiving or Blackbaud logo (research.md R3). A new token pair for the button's text and background
joins the AA contrast suite if the existing ones don't pass.

**The charity's logo** isn't built. The "I'm supporting" logo and its conditions haven't arrived, so the
charity is named in text, and the layout holds no space for it. Adding it later is a small follow-up.

## Fundraising page (`pages/fundraising.astro`, `components/FundraisingPage.astro`)

The body takes its data as props, so the previews render the real thing, as `HealthPage` and `RacesPage`
do. In order:

1. **Current campaign**: "Brighton Marathon · 4 April 2027", the charity (linked where `charity.url` is
   given), "Part of Southern Hospice Group, registered charity 256789", the figures in the card's form,
   Donate. After race day it follows the card's "Raised £X" form (FR-041).
2. **Story**, with the heading "Why I'm running for <charity>", when there's an approved one. No section
   or placeholder otherwise (FR-044). Paragraphs from the plain text.
3. **Chart**: `LineChart` inside `ChartFigure`, shown from two points. `zero`, a target line, the
   step-shaped points of [data-model.md](../data-model.md) §7. The summary reads "£1,250 raised since
   10 Nov 2026, 62% of the £2,000 target". The table lists date and total for each stored day, and
   nothing else, because the page has no need to show how supporters changed by day. With one point there
   is no chart (US2.3).
4. **Past campaigns**: most recent race first: race and date, charity, final or latest total, target if
   any, and a link to JustGiving (FR-043). A finished one reads "Final total"; an unfinished past campaign
   shows its last-updated line and, past the threshold, the notice. With no current campaign the page
   leads with this list.

Title "Fundraising · Running · Alexander Webber", a description naming the race and charity, `garmin`
off. The page's `SectionLayout` still shows Running's own "Last updated" line; the fundraising line says
"Figures updated" to keep them apart.

## Preview routes (tests, and for the owner's review)

`SHELL_PREVIEW=1` adds `/fundraising-preview/<state>/`, following `/race-preview/` and `/health-preview/`.
Each state is a small synthetic data tree under `tests/fixtures/fundraising-preview/data/<state>/`,
written by `generate.ts`, with a pinned `today`. Each renders both the real `FundraisingCard` and the real
`FundraisingPage`. All names, totals and dates are made up.

| State | Shows |
|---|---|
| `active` | £1,250 of £2,000, 37 supporters, a chart |
| `first-day` | One point: no chart |
| `no-target` | No bar |
| `zero` | £0 of £500 |
| `beaten` | 108%, and the bar not overflowing |
| `stale` | Last read 2 days ago, with the notice |
| `race-day` | Pre-race form on the day |
| `after-race` | "Raised £X", no result yet |
| `after-result` | With a result |
| `finished` | Final total, no Donate, no notice |
| `second-campaign` | A new current campaign, with Brighton under past |
| `no-current` | Focus race with no campaign: the page leads with past campaigns |
| `with-story` | A synthetic approved story |

Deploy builds never set `SHELL_PREVIEW`, so these can't reach the live site. For the owner's review the
agent serves a preview build locally, and puts phone and desktop screenshots of each state in the PR.
