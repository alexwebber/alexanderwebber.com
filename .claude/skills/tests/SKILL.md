---
name: tests
description: Write this project's Vitest unit and contract tests (and their pytest twins) — where each kind goes, the helpers to use (tempRepo, emptyOwner, copySite, AstroContainer with a fake store), made-up fixtures, and the rules that keep them honest. Use whenever code is added or changed, straight after the code (Principle II(a)).
---

# Tests

Coverage of each component's documented contract comes with the code, not test-first (Principle
II(a)). Playwright page tests have their own skill, `page-tests`.

## Where they go

| Kind | Folder | Copy |
|---|---|---|
| Pure logic, a script's function | `tests/unit/` | `check-boundaries.test.ts`, `format.test.ts` |
| Validation rules over a data tree | `tests/unit/` | `fundraising-validate.test.ts` |
| A page or component rendered | `tests/unit/` | `goal-cards.test.ts` (AstroContainer + fake store) |
| Schemas, the store, workflows | `tests/contract/` | `schemas.test.ts`, `store.test.ts`, `refresh-workflow.test.ts` |
| Ingest (Python) | `ingest/tests/` | `contract/test_schemas.py` |

## Helpers (`tests/helpers/`)

- `tempRepo()`: a throwaway repo root with the real `schemas/` (a junction on Windows); `write(path,
  content)`, `cleanup()` in `afterEach`. `write` JSON-stringifies anything that isn't a string, so
  write binary files (photos) with `writePhoto` from `journey.ts`. `run(id, extra)` and `runPath(id)` make a valid published run.
- `emptyOwner(overrides)` (`owner-data.ts`): a fake store's `getOwner()` value. Never write the
  `OwnerData` literal out in a test.
- A fake `RunningStore`: an object of async methods, passed to `setRunningStore` (from
  `src/sections/running/data/load.ts`) before rendering with `experimental_AstroContainer`.
- `copySite(root)` and `buildSite(root)` (`scratch-site.ts`): a scratch copy of the site to edit and
  build for a drill.
- `journey.ts`: made-up approved story trees (`lorem(seed, n)`, `chapter`, `note`, `page`,
  `closing`, `approve`, `writeApproved`, `writeStory`) for anything that reads approved text.
- `stripTags` (`html.ts`) to assert on rendered text; `a11y.ts` for axe in Playwright.

## Rules

- **Made-up data only**, from a fixed seed or written out: never real names, places or story text
  (Principle VI; the repo is public).
- **Plant each refused case alone**, then together: scanners report one match per rule per file.
- **Pin today**: pass `today` (`validateData(root, { today })`, `--today=`) rather than reading the clock.
- Assert what the contract says: file, entry, field and severity of an issue (`formatIssue`), not only
  that something failed.
- On Windows, give `sharp` the bytes (`readFileSync(path)`), not the path, or the file stays locked.
- **`Picture` in the Astro container** renders with real files: `import.meta.glob` them in the test
  and pass them under made-up keys (`tests/unit/story-page.test.ts`).
- **Regexes over Astro output** allow `<` and `>` inside attribute values (Astro escapes only `&`
  and `"` there): match a tag's attributes with `(?:[^>"]|"[^"]*")*`, not `[^>]*`.
- An SVG labelled by its title and desc: assert `toHaveAccessibleName`, not the description.
- A regex that looks for HTML tags, even in an assertion, is case-insensitive and allows attributes
  (`/<(b|script)[\s>]/i`), or CodeQL's `js/bad-tag-filter` fails the PR.

## Running them

- `npm test` (runs `gen-types` first); one file: `npx vitest run tests/unit/<file>.test.ts`.
- `cd ingest; uv run pytest` when `schemas/` or `ingest/` changed.
- `node scripts/process/pr-ready.ts --suites` runs what the branch's changes need.

## Done when

- Each new behaviour has a test that fails when the behaviour breaks: break it once, see it fail.
- The suites `--suites` picks are green, and no test reads the real `data/` unless it's meant to (the
  "parses the repo file" kind).
