---
name: speckit-house-process-tips-testing
description: 'Agent tips for testing, unit and end-to-end: path-filtered jobs and bot data, fakes for store interfaces, expectations taken from the data, every Playwright project locally, pointer-interception, font-dependent layout checks, timeouts, beforeAll per project, exact and scoped locators, fixture seeds, absence checks, proving checks fail, per-project counts, lazy images and screenshots, toBeInViewport on focused links, accessible names of SVGs, and failures from a sleeping machine. Read before writing or debugging tests, Playwright ones especially.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-testing.md
---

# Agent tips: Testing and End-to-end testing

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

## Testing

- **Path-filtered test jobs don't watch bot-published data.** A layout check failed on the first
  UI PR in six days, because the week's data had changed under it. Run layout checks on a schedule
  against real data too.
- **Adding a required method to a store interface needs a task for hand-written fakes.** Where
  type-checking covers tests and runs in the build, a missed fake turns the gate red.

## End-to-end testing

- **Tests over real data take their expectations from the data or the page,** never a fixed
  list. A keyboard test expected an "All time" option that its own PR had made appear only once
  enough data existed, so the check went red on merge.
- **Run every Playwright project locally before a PR.** A bug that moved the layout went
  unnoticed when only one project was run, then failed on CI's 360 px project.
- **"Element intercepts pointer events" retried for a long time means a layout shift**, not
  slowness: something moved the target out from under the pointer.
- **Layout checks that depend on the browser's font pass on one OS and fail on another.** A 1 px
  overflow appeared only on CI's Linux font. Assert the geometry that causes it (a label inside
  its plot), which fails on any font, and show that it fails before fixing.
- **A test that loops over all published data outgrows the default timeout silently.** Set a
  generous limit when writing it.
- **Run nothing else during a local Playwright run.** A first-run timeout coincided with pytest
  and git. Rerun alone with the JSON reporter before judging; its durations and skip reasons
  separate a growing test from a flake.
- **`beforeAll` runs once per project and worker.** Expensive setup (building a site copy) and
  viewport-independent checks (full axe sweeps) double with a phone and a desktop project. Pin
  them to one project.
- **Use `exact: true` with `getByRole(..., { name })`.** Names match substrings by default, so
  real data adding a heading "Just achieved" beside "Achieved" broke strict mode.
- **Scope each locator to its container** when a page renders a component twice (a card and a
  page). Older tests otherwise hit strict mode.
- **Add a fixture state last, from its own seed.** In a generator with one seed counter, a new
  state shifts every later state's words and hashes. Check `git diff --stat` shows only the new
  state.
- **Make absence checks follow the repo's data.** "No 'Story' in the menu" on a preview that
  renders the real menu becomes a launch-day failure; derive what's expected from the data.
- **An exact-text helper that swaps tags for spaces hides a missing space between inline
  elements.** Drop tags without adding spaces, and also compare the browser's `innerText`.
- **Prove new checks fail by breaking them in one batch:** every CSS and markup break in one
  build and one spec run (32 checks in about a minute), then restore the files.
- **Per-project Playwright counts** come from `--reporter=line,json` with
  `PLAYWRIGHT_JSON_OUTPUT_FILE`, walking `suites` and `specs[].tests[].projectName`.
- **A full-page screenshot with `isMobile` can fail** ("Unable to capture screenshot"). Use a
  phone-width viewport with `isMobile` off for that shot.
- **Lazy images:** a `loading="lazy"` `<img>` the browser hasn't requested yet reads
  `complete === true`, so waiting on `complete` waits for nothing; await `img.decode()`. Full-page
  screenshots don't trigger lazy loading either: images below the first screen come out empty
  unless the test sets them to eager and decodes them first.
- **`toBeInViewport({ ratio: 1 })` fails at 0.99 on a focused inline link** (its box sits a
  fraction of a pixel outside). Check its bounding box against the viewport within a pixel.
- **For an SVG with `aria-labelledby` on its title and desc, the desc is part of the accessible
  name,** so `toHaveAccessibleDescription` reads empty. Assert on `toHaveAccessibleName`.
- **Run a quickstart's failure scenario for real, not only as unit tests.** A check in the
  validator isn't a check in the build: a plain build rendered text the validator would have
  refused.
- **Timeouts across unrelated tests usually mean the machine, not the code.** A run left going
  overnight took 2–4 h and failed different tests each time (the laptop slept); a mid-morning run
  hit `ERR_NETWORK_IO_SUSPENDED`. Check wall-clock times and the JSON report's messages, then
  rerun the failed specs alone while the machine is in use.
- **For "X mustn't move Y", measure the same page with X shown and hidden,** not against an
  absolute position: with a `system-ui` font stack, "Donate within 780 px" passed on Windows and
  failed on CI's Linux by 24 px. To compare layouts before touching code, inject CSS and DOM
  changes into the built site with Playwright and measure under several fonts: DejaVu Sans (from
  jsdelivr) reproduced CI's Linux exactly, and Roboto stands in for Android.