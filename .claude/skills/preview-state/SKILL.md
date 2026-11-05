---
name: preview-state
description: Add a test-only preview to this project — made-up data trees from a fixed-seed generate.ts, a store per state, a page through the real components, and the SHELL_PREVIEW=1 route in astro.config.mjs — so a page can be tested and screenshotted in states the real data can't show yet. Use whenever a page or card needs states the live data doesn't have (before a race, a story, a campaign).
---

# A test-only preview state

A preview renders the **real components** over **made-up data**, at a route only a `SHELL_PREVIEW=1`
build has. Deploy builds never set it, so no visitor reaches a preview. Playwright, axe and the PR's
screenshots run against it (`page-tests`, `pr-screenshots`).

## Copy the nearest precedent

| Shape | Copy | Route |
|---|---|---|
| One page per named state | `tests/fixtures/fundraising-preview/` | `/fundraising-preview/[state]/` |
| One data tree, many pages | `tests/fixtures/race-preview/` | `/race-preview/`, `/race-preview/[slug]/` |
| One page | `tests/fixtures/health-preview/` | `/health-preview/` |

## Steps

1. **`generate.ts`** writes `data/<state>/data/running/...` (a `JsonFileStore` expects
   `<root>/data/running/`). It starts with `rmSync` of its output, so a removed state leaves nothing
   behind. Run it with `node tests/fixtures/<x>-preview/generate.ts`; **commit its output**.
   - **Deterministic:** a fixed seed (`race-preview`'s LCG, or `lorem(seed, n)` from
     `tests/helpers/journey.ts` for text). Running it twice changes nothing (`git status` clean).
     `lorem()` capitalises its first word, so lower-case the words that carry on a sentence (after
     a placeholder or a link), as `story-preview`'s `lower()` does.
   - **Reuse the test helpers** for approved files: `approve(kind, value, photos, date)` and
     `yaml(value)` from `tests/helpers/journey.ts` write exactly what `approve-story` would.
   - **Made up, and says so:** lorem-style words or "Example hospice", "Seaside Marathon"; never a
     real name, place, figure or the owner's text (Principle VI, FR-036). Coordinates in open sea.
   - **Approved text** carries an `approved` block with the hash the real approver writes
     (`journeySha256(kind, value, photoBytes)` from `src/sections/running/data/store/files.ts` for
     the journey; a campaign story hashes its parsed text, as `fundraising-preview`'s `storyYaml`
     does), so the preview passes the same validation as real data.
   - **Write `\n` line endings** and hash exactly the bytes written. A unit test that validates the
     preview proves the hash holds on Windows (autocrlf) and Linux checkouts alike.
   - Cover the edge cases the tasks name: the shortest and longest content, one long unbroken word
     (320 px), ties, empty optional parts.
2. **`store.ts`**: one `JsonFileStore` per state over the repo's schemas, `PREVIEW_STATES` as a
   `const` tuple, and a pinned `PREVIEW_TODAY` (and `PREVIEW_NOW` if a component reads the clock),
   so date-driven text doesn't drift. Paths resolve from the repo root.
3. **The page** (`[state].astro` or `index.astro`): `getStaticPaths` over the states, loading through
   the section's real loader with the preview store, and rendering the real page component. Extra
   preview-only wrappers (a heading over a card) are fine; say so in the PR's screenshots.
4. **`astro.config.mjs`**: `injectRoute` in `shellPreview`, and add the route to the comment above it.
5. **A unit test** that each state passes `validateData(root, { today, schemaRoot: REPO_ROOT })` with
   no errors, as `tests/unit/fundraising-validate.test.ts` does for its previews. A tree without
   `section.yaml` always carries that one warning: assert it's the only one (or add the file).

## Rules

- The preview's menu is the real section menu: never add a nav item for a preview.
- Imports go one way: the preview imports `src/`, and nothing under `src/` imports `tests/`
  (`check-boundaries` doesn't check this, so look at the diff).
- A preview state is a test fixture: change it with the tests that read it, never to make one pass.

## Done when

- `SHELL_PREVIEW=1` build: every state answers 200; a plain build has none of the routes.
- `generate.ts` rerun leaves `git status` clean, and the validation test passes.
- `pr-ready --suites` is green (the e2e suite builds with `SHELL_PREVIEW=1`).
