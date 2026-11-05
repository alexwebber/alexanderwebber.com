---
name: speckit-house-process-tips-testing
description: 'Agent tips for testing, unit and end-to-end: path-filtered jobs and bot data, fakes for store interfaces, expectations taken from the data, every Playwright project locally, pointer-interception, font-dependent layout checks, timeouts, and beforeAll per project. Read before writing or debugging tests, Playwright ones especially.'
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