---
name: gate-drill
description: Prove a rule for real on a scratch copy of the site — copy the real code and data, plant one fault at a time (a file, a missing chapter, a dead link), run the gate's steps in order (runGate), see which step stops it and what it says, check a failed build leaves dist/ intact, then restore and see it pass; in a browser too (serveDist). Use for every "run for real" or "drill" step in a task or quickstart, every launch/none/stale drill spec, and the for-real proof a new gate check needs.
---

# A gate drill on a scratch copy

A rule in a function isn't a rule in the gate until a copy of the real site, with the fault planted,
is stopped by it. Unit tests plant faults in tiny trees (`tests` skill); a drill plants them in the
**real** code and data and runs what CI runs. Read `page-tests` too when the drill opens pages.

## The helpers (`tests/helpers/scratch-site.ts`)

| Helper | What it does |
|---|---|
| `copySite(root)` | Copies `src/`, `public/`, `schemas/`, `data/running/` and the config files into an emptied `root`. |
| `scratchRepo(root)` | The copy as a `TempRepo`, so `tests/helpers/journey.ts`'s `writeStory`/`writeApproved` (and any writer taking a `TempRepo`) plant files in it. |
| `runGate(root, { build?, today? })` | The gate's steps in order (`GATE_STEPS`: validate-data, scan-images, check-boundaries, build, check-links, scan-privacy), stopping at the first that fails. Returns `ran`, `failed`, `messages` (as the CLI prints them) and `warnings`. `build: false` stops after check-boundaries, in seconds. |
| `buildSite(root)` / `buildFailure(root)` | A deploy build (no `SHELL_PREVIEW`); `buildFailure` returns a build's output and throws if it built. |
| `snapshotDist(dir)` | Every file's sha256: equal before and after shows a failed build left `dist/` intact. |
| `serveDist(dist)` | Serves the copy's `dist/` like Cloudflare (`/a/` → `index.html`, else 404 with the 404 page); `base` for `page.goto`, `close()` in `afterAll`. Build first: it indexes files when it starts. |
| `builtHtmlFiles(dir)` | Every built `.html` under a folder. |

Not covered by `runGate`: `npm ci`, gen-types and `astro check` (the copy shares the repo's
`node_modules` and generated types), and the R2 run-ID map (CI only), so `scan-privacy` runs without
provider IDs. Scripts that validate "the repo they sit in" are called as functions on the copy
(`validateData(root)`, `scanPrivacy(root)`, `approveJourney({ root, target })`); a `dist/` check also
runs as its real command line on the copy (`node scripts/check-links.ts --dist=<root>/dist`).

## Where it goes

- **A drill a task or success criterion names** (SC-xxx, "the launch drill", "the none drill"): a
  committed spec, `tests/e2e/<area>-<case>.spec.ts`. Copy `fundraising-none.spec.ts` (built files
  only), `stale.spec.ts` (gate, built files and a browser over `serveDist`), `story-none.spec.ts`
  (gate, built files and a 404), or `story-launch.spec.ts` (a made-up approved story, a phone-sized
  context, rebuilds at the end).
- **A one-off proof for a PR** (gate-check's "drill, for real", a quickstart step "run for real" that
  no spec keeps): a script at `spikes/<name>/out/drill.ts` (gitignored, outside `tsconfig`), run with
  `node spikes/<name>/out/drill.ts`, its output pasted into the PR. Put the copy beside it
  (`spikes/<name>/out/site`) so `node_modules` resolves.

## Steps

1. **Copy, then run the gate clean** (`runGate(root)`): `failed` undefined and `ran` equal to
   `GATE_STEPS`. A drill that starts from a broken copy proves nothing.
2. **Make the copy independent of what the repo holds now**: replace real story files with made-up
   ones (`writeStory`, `chapter()`, `note()`, `page()`), delete or set `section.yaml` keys and
   campaign entries rather than assuming them, so the drill still holds after later phases add real
   content. Made-up text only (`lorem`), never real or private words (FR-036, Principle VI).
3. **Plant one fault at a time**, then `runGate`: assert `failed` is the step that should stop it,
   and the message names the file, entry and field (or page and chapter) and the rule. It must
   never quote free text: assert a planted word is absent from the messages. Then plant two faults
   together if the check reports one match per rule per file.
4. **Rules that also run at build time** (schema and loader checks, `astro:build:start`): also
   `buildFailure(root)`, with `snapshotDist` equal before and after. The `validate.ts` rules don't
   run in the build, so assert those through `validateData` (or `runGate`) only. Take the snapshot
   just before each build, not once per drill. A build that fails at render time (a page's own data
   check: a missing note, a bad link) leaves `dist/` partly rewritten, unlike one that fails in
   `astro:build:start`. For those, assert that `validate-data` stops the fault first in `runGate`,
   and don't assert that `dist/` is intact.
5. **A fault only the built site shows** (a dead link, a missing page): to get past validation,
   re-approve changed story text in the copy (`approveJourney({ root, target })` from
   `scripts/approve-story.ts`), so the failure comes from the check you're drilling, not the hash.
   Then `runGate` should stop at `check-links` (or the step in question), naming the chapter.
6. **Restore and see it pass**: remove the plant (or re-copy) and `runGate` again. A check that
   never passes again proves nothing either.
7. **In a browser** (layout, menus, the first screen): `serveDist(join(root, 'dist'))`, then the
   page checks from `page-tests` (320 px fit, viewport size, exact names). If a check the task
   marks as "stop and ask the owner" fails, stop and ask; don't change the layout to pass it.
   A drill that builds once in the desktop project measures a phone's first screen in its own
   context, as the `mobile-360` project sets it up:
   `browser.newContext({ ...devices['Pixel 7'], viewport: { width: 360, height: 780 } })`. Print
   the measurements (`testInfo.annotations` and a log line), so the PR can quote them. Positions
   depend on the system font (`system-ui`): Donate ended at 777 px of 780 on Windows and 804 on CI's
   Linux. So assert what the change causes, on the same page (hide the new item, measure again:
   same lines, same position), and print the absolute numbers rather than asserting them
   (`story-launch.spec.ts`, owner on #122).
8. **Screenshots of the drill's site** (`pr-screenshots`): run the spec with
   `DRILL_KEEP_DIST=spikes/<name>/out/dist` (as `story-launch.spec.ts` supports; add the same few
   lines to a new drill) so the copy's `dist/` outlives `afterAll`, then
   `node scripts/process/screenshots.ts ... --dist=spikes/<name>/out/dist`.

## Many faults: a matrix

For a review's "can it deploy" questions (graduation), write one script with a list of
`[what, plant, viaBuild]` entries. Put a sentinel word in every text field of the made-up story.
Then, for each entry: re-copy, plant, `runGate` (and `buildFailure` when `viaBuild` is set), and print
one line with the step that stopped it, the message, and whether the sentinel appears anywhere in
the output. Then restore and check it passes. Keep the script under `spikes/<name>/out/` (gitignored)
and quote its report lines in the PR (003's graduation planted 18 faults this way).

## In a Playwright spec

`test.describe.configure({ mode: 'serial' })`; `beforeAll` pinned to the desktop project
(`test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device')`) with
`testInfo.setTimeout(240_000)` per build; the copy at `testInfo.outputPath('<case>-site')`; in
`afterAll`, `await server?.close()` then `rmSync(root, …)`. Throw from `beforeAll` with
`gate.messages` if the clean gate fails, so the cause shows. Assert on elements, not strings: class
names also appear in inlined CSS. Several builds in one spec: one `beforeAll` per state, or rebuild
in the test with its own timeout. Put rebuilds last: each replaces the `dist/` that `serveDist`
indexed, so close the server first. In serial mode a failing test skips the rest, so to prove
several checks fail when broken, run each with `-g`.

## Pitfalls

- The copy has no `.git` but sits inside the repo, so a `git` command run in it acts on the real
  checkout. Keep git out of drills.
- `validateData`'s date-relative rules use today: pass `today` when the drill pins dates.
- An approval date can't be in the future (`approveJourney` refuses it).
- A drill that edits the copy's schemas (a new field, SC-013) needs a fresh copy path. The loader
  caches each root's compiled schemas for the life of the process, so reusing a path validates
  against the old schemas.
- Drilling a removal ("every chapter removed") also removes what depends on it: `story_link` in
  `section.yaml` is an error with no chapter, so remove it too, unless that error is the point.
- A clean copy plus a full build takes about 10–30 s locally; each extra build adds about as much.
