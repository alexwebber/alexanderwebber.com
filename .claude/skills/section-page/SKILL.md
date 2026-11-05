---
name: section-page
description: Add or change a Running page or landing card in this project's Astro site — SectionLayout, the area in runningAreas (conditional until its data exists), a share image, a card on the shared shell, styles that survive dark mode, forced colours and 320px, and the dist/ comparison that catches CSS chunking. Use whenever a page, page component or landing card is built or restyled.
---

# A section page or landing card

Read `speckit-house-process-tips-astro` and `-tips-ui-accessibility` first, and
`-tips-share-images` for a share image. Tests: `tests` (Astro container) and `page-tests`
(browser); states the real data can't show: `preview-state`.

## The page

- **A page component** (`src/sections/running/components/<Area>Page.astro`) takes loaded data as
  props, so the route and each preview render the same thing. The route
  (`src/sections/running/pages/<area>.astro`) loads through `src/sections/running/data/` and passes
  it in. Copy `FundraisingPage.astro` and `pages/fundraising.astro`.
- **`SectionLayout`** gives the shell, the section menu, the `<h1>`, Garmin attribution
  (`garmin`, on any page showing Garmin data) and "Last updated" (every data-driven view must show
  it, Principle V). `title` defaults to "<heading> · Running · Alexander Webber". `current` marks the
  menu item a sub-page sits under (its href, e.g. `"/running/story/"`). `imageAlt` is required. A new
  prop keeps a default that leaves every existing page's output unchanged, and a prop that hides a
  part also skips that part's data read (`lastUpdated={false}` skips `buildFreshness()`). Don't drive
  an optional part with `Astro.slots.has`: it reports `{cond && <X slot="x" />}` as filled.
- **A components-only slice** (page and preview, no route yet) skips the area, share image and
  landing steps; say so in the PR.
- **Register the area** in `src/sections/running/integration.ts`'s `runningAreas`, in menu order,
  with its routes and share image route. An area that would be empty without data is added only
  when its data exists, checked from files without loading the tree (`campaignsWithFigures()`,
  `fundraisingArea`), so no visitor reaches an empty page. `SectionLinks` lists areas with a
  `description` on the landing page; words a visitor sees need the owner's approval.
- **Share image**: `src/sections/running/og/<area>.png.ts` with `ogEndpoint` and
  `RUNNING_OG_COLOURS`; the page passes `image={ogPath(PATH)}` and an `imageAlt`. Look at a
  rendered PNG before trusting the layout.
- **No client JavaScript** unless the spec needs it. A shared module two inline scripts import
  becomes a script file.

## A landing card

- On `/running/` (`pages/index.astro`), in the order its comment states; it renders nothing,
  not an empty box, when its data is missing.
- The **card shell** is shared in `styles/goal-card.css` (padding, border, radius, surface); an
  accent edge marks a special card and keeps its colour in forced colours (`Highlight`).
- One `<article aria-labelledby>` or `<section aria-labelledby>` per card, its heading at the level
  the page outline needs; a "See the ..." link to the area's page.

## Styles

- Use the tokens (`src/shared/design/tokens.css`, `styles/theme.css`): colours come from
  `--color-*`, so dark mode (`prefers-color-scheme`, no toggle) follows. Never a literal colour.
- Repeated markup or a component not on every page: rules in a section stylesheet under
  `.theme-running` with a prefix, not a scoped `<style>`. A `<style>` in an imported component can
  reorder a page's inlined CSS even when it doesn't render, and growing a shared chunk past Vite's
  4 KB inline limit turns it into a render-blocking file.
- **320 px**: `overflow-wrap: anywhere` on free text; no `white-space: nowrap` beside a heading;
  hidden labels (`visibility: hidden`) still take width. Text blocks at `max-width: 66ch`.
- **Forced colours**: a box drawn only by its background disappears; give it a border.
- Visualisations over walls of text (constitution); charts: the `dataviz` skill.

## Done when

- Unit tests over the Astro container and Playwright specs cover the page (`tests`, `page-tests`).
- `pr-ready` compares `dist/` with `main`: only the pages you meant changed. Compare the file
  list too (a new or vanished CSS chunk), and computed styles if the CSS moved.
- You've looked at the page at 360 px and on a desktop, light and dark (`pr-screenshots`).
- The PR has a *How to view it* section: URLs once deployed, what to check on a phone and a
  desktop, and what isn't built yet.
