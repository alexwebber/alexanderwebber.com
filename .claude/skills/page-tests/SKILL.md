---
name: page-tests
description: Write this project's Playwright page tests — e2e specs in tests/e2e/ and axe specs in tests/a11y/ — over the SHELL_PREVIEW=1 previews and the real pages, on both projects (mobile-360 and desktop), with the 320px fit, no-JavaScript, forced-colours and heading checks, scoped locators and exact names, and build drills on a scratch copy. Use whenever a page or card is added or changed, straight after the code.
---

# Playwright page tests

Unit tests (`tests` skill) prove the markup; these prove the page in a real browser. Read
`speckit-house-process-tips-testing` and `-tips-ui-accessibility` first.

## Where they go

| Kind | File | Copy |
|---|---|---|
| A page over preview states | `tests/e2e/<area>.spec.ts` | `fundraising.spec.ts` |
| A real page over bot data | `tests/e2e/<area>.spec.ts` | `goals.spec.ts`, `landing.spec.ts` |
| A build drill on a scratch copy | `tests/e2e/<area>-none.spec.ts` | `fundraising-none.spec.ts` |
| Accessibility | `tests/a11y/<area>.spec.ts` | `fundraising.spec.ts` |

`playwright.config.ts` runs every spec in two projects: `mobile-360` (Pixel 7 at 360 x 780) and
`desktop`. Its `webServer` serves the last build with `astro preview`.

## What a page's specs check

- **Each state answers 200**: an `open(page, path)` helper that asserts the status.
- **Content and order** the spec names, with expectations from the fixture (preview) or from the
  data file or page (real data), never a pinned list for bot-published data.
- **No sideways scroll at 320 and 360 px**, in every state:
  `document.documentElement.scrollWidth - document.documentElement.clientWidth` is 0 after
  `page.setViewportSize({ width: 320, height: 800 })`.
- **Without JavaScript**: `test.describe` with `test.use({ javaScriptEnabled: false })`, same text,
  and no script files where the page promises none.
- **Accessibility** (`tests/helpers/a11y.ts`): `axe(page)` is `[]` in light and dark
  (`sweepOnlyInDark`), in forced colours on the phone project (`fullSweep()`), with `<details>`
  opened first; `outline(page)` for headings; named regions (`getByRole('region', { name })`).
- **Forced colours**: a box or button that relies on a background keeps a border
  (`not.toHaveCSS('border-top-style', 'none')`). A heavier edge is proved by comparing computed
  border widths, not by "not none".
- **Approved text, exactly**: read the served HTML (`response.text()`) through a helper that drops
  tags *without* adding spaces (`tests/helpers/story-text.ts`), compare with the fixture, and also
  compare the browser's `innerText`. A helper that swaps tags for spaces hides a missing space.

- **Photos** (`tests/e2e/story.spec.ts`, the `photos` state): alt text and a visible caption; lazy
  loading with width and height set (the box's shape checked within 1 px: a `ch`-based column is
  fractional under CI's font, and `toBeCloseTo(..., 0)` failed by 0.52 px); zero layout shift, measured by a `PerformanceObserver` on
  `layout-shift` while scrolling through; an aborted image (`page.route(..., (r) => r.abort())`)
  keeps its alt text and caption; and every built `/_astro/` file the page's HTML references has no
  metadata (read with sharp, from the bytes). A lazy `<img>` not yet requested reads
  `complete === true`: wait on `decode()`.

## Rules that kept failing

- **Scope every locator** to its container (`page.locator('.fundraising-card').getByRole(...)`):
  a preview that renders a component twice breaks strict mode.
- **`exact: true` on role names**: names match substrings by default.
- **Assert elements, not strings**, on built HTML: class names appear in inlined CSS.
- **Layout that depends on fonts**: assert the geometry that causes it (a label inside its box),
  not a pixel count; Linux CI fonts differ. Hidden text still takes layout: walk text-node ranges.
  The exception is a target the owner set (Donate on a 360 x 640 first screen, 24 px to spare,
  `landing.spec.ts`): assert it, with the margin measured under CI's font (DejaVu Sans, the widest)
  before committing to it.
- **Keyboard paths press Tab** (`page.keyboard.press('Tab')`), the path a visitor takes, and check
  the focused element is fully in view, not just focused: a sideways-scrolling menu left a focused
  link faded at its edge until `scroll-padding-inline` was set.
- **An SVG labelled by title and desc**: `toHaveAccessibleName`, not the description.
- **Dates**: previews pin "today" (`PREVIEW_TODAY`); never read the clock in an expectation.

## Build drills (a scratch copy)

`copySite(root)` and `buildSite(root)` from `tests/helpers/scratch-site.ts`, in `beforeAll` with
`test.describe.configure({ mode: 'serial' })`, **pinned to the desktop project**
(`test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device')`) and
`testInfo.setTimeout(240_000)`. Validation rules go through `validateData(copyRoot)`, not the build.
Load the `gate-drill` skill: `runGate` runs the gate's steps on the copy, and `serveDist` serves its
`dist/` to the browser.

## Running them

- Everything, as the PR routine does: `node scripts/process/pr-ready.ts --suites`.
- One spec: build with `SHELL_PREVIEW=1` (`$env:SHELL_PREVIEW='1'; npm run build` in PowerShell),
  then `npx playwright test tests/e2e/<file>.spec.ts --reporter=line`, both projects. Run
  `npx astro preview stop` first if a preview server is running, and nothing else alongside.
- CI runs them only when paths in `tests.yml`'s `playwright` filter change, so a test over bot data
  can go red on the next UI PR without its own change at fault. The nightly Quality run is
  Lighthouse only (`BACKLOG.md` has the scheduled Playwright run).

## Done when

- Both projects pass locally; skips are by design, each with its reason.
- Each new check fails when the behaviour breaks (break it once and watch it fail). Batch the
  breaks: several CSS and markup mutations in one `SHELL_PREVIEW=1` build, one spec run, then
  restore the files (one build, not one per check).
