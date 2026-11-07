# Quickstart and Validation Guide: Journey Story

**Feature**: 003-journey-story | Contracts: [contracts/](contracts/) | Data: [data-model.md](data-model.md)

Scenarios that prove the feature end to end. The agent runs them; steps marked **Owner** need the owner.
Everything up to §7 runs on made-up text. Only §8 touches the real story, and only once it's approved.

## 0. Prerequisites

- The toolchain from [001 quickstart](../001-running-section/quickstart.md) §0. No secrets are needed:
  the story reads nothing from any provider.
- **Privacy (FR-036):** the approved text and the owner's raw answers live outside the repository. Never
  paste them into a test, fixture, PR body, commit message or log. Fixtures use generated text only.

## 1. Unit and contract tests

```text
npx vitest run tests/unit/journey tests/contract/journey-schemas.test.ts tests/unit/approve-story.test.ts tests/unit/check-links.test.ts tests/unit/scan-privacy.test.ts
```

Expected: every rule in [content-files.md](contracts/content-files.md) *Validation* has a passing refused
case naming its file, entry and field; the sentinel test finds the sentinel in no message; the approve
script round-trips every target and refuses each bad input without touching the file; `parseProse`
covers every form in data-model.md §5 and each stray-markup case.

**Result (2026-11-06, graduation, T075):** 6 files, 182 tests passed (the full Vitest suite 1,083).
The sentinel test now also plants an alias naming no anchor (`*word*`), which the YAML library used to
throw on, quoting the word; and the refused cases gained an empty journey file and a chapter id
repeating another element's id (contracts/content-files.md *Validation*).

## 2. Approval holds (SC-003, US2)

In a temporary data tree with one made-up chapter:

1. Run `approve-story --journey=<id>`, then build: the chapter renders exactly as written (rendering:
   §3's previews and §5's drill, because the page has no route until the story area exists).
2. Change one character of the prose: `validate-data` and a plain `astro build` both stop, naming the file,
   `chapter "<id>"` and `approved.sha256`, and `dist/` from step 1 is still there.
3. Remove the `approved` block: both stop with "needs the owner's approval before it can be published".
4. Replace a photo with another under the same name: stops as in step 2.

**Result (2026-11-06, graduation):** run for real on a scratch copy of the site with a made-up
story (the graduation drill): step 1 renders exactly as written (`story-launch.spec.ts` US2.2, 1 passed);
steps 2 and 3 stop `validate-data` and a plain build alike with the messages above, naming the file,
`chapter "chapter-a"` and the field, with `dist/` from the last good build intact. Step 4 is proven by
`journey-validate.test.ts` (a photo swapped under the same name) and Phase 5's drill (a photo added
with the real script needs re-approval).

## 3. The page on previews (US1, US4, US5)

```text
$env:SHELL_PREVIEW = '1'; npm run build; npx playwright test tests/e2e/story.spec.ts tests/a11y/story.spec.ts
```

Expected, at 360 x 780 and on desktop:

- Chapters in time order, each with name, when, prose, takeaway (US1.1); `same-day` follows `order`.
- The first screen shows the first chapter's name and opening lines, and nothing matching a figure,
  chart or bar comes before the first prose, in `one-chapter` and `long` (SC-001).
- "What I learned" is an `h3` in a bordered box; in forced colours the border and label remain (FR-004).
- `figures`: inline figures carry their source in parentheses right after them; the set-apart figure
  follows its paragraph; no figure leads a chapter.
- `four-chapters` and `long`: the closed "Chapters" list; any chapter in 2 taps with JavaScript off;
  "Back to chapters" returns to the list (SC-010).
- `one-chapter` and `three-chapters`: no list, no numbering, no placeholder (US1.7).
- `no-closing`: the note follows the latest chapter directly.
- `photos` and `long`: captions visible, alt text present, no photo file carries metadata.
- axe: zero violations in light and dark. Heading order h1, h2, h3. No sideways scroll at 320 px.
- Paragraph width at most 75 times the width of "0" in its font (FR-072).
- With JavaScript disabled, the page is identical (FR-071).

**Result (2026-11-06, graduation):** 266 passed, 22 skipped by design (forced colours and the
phone-only sweeps run in one project), both projects. Graduation added a keyboard check: Tab reaches
every link and control in every state, each in view when focused.

## 4. Nothing before the first chapter (SC-002)

```text
npx playwright test tests/e2e/story-none.spec.ts
```

A scratch-site deploy build of today's data: no `dist/running/story/`, no `/og/running-story.png`, no
"Story" in any page's menu, no story panel on the landing page, no `/running/story/` in the sitemap,
and `/running/story/` answers with the 404 page.

**Result (2026-11-06, graduation):** 5 passed, 5 skipped by design (it builds once, in the desktop
project).

## 5. Launch layout (SC-006, US3)

```text
npx playwright test tests/e2e/story-launch.spec.ts
```

A scratch-site deploy build of the real data plus one made-up approved chapter, note and page wording, and
a `story_link` with a made-up label:

- "Story" is second in the menu, after Overview, on every Running page, and current on the story page (US3.5).
- On the landing page at 360 x 780 with the fundraising card, Donate is fully on the first screen, and the
  menu has no third line. **If either fails, stop and raise it with the owner** (research.md R8).
- No Running page scrolls sideways at 320 px.
- The story panel shows the label; "Story" isn't repeated in the section links below it.
- Removing the chapter and building again: page and menu item gone, and the `story_link` stops the update,
  naming `section.yaml` `story_link.href` (US3.4, US4.6).

**Result (2026-11-06, graduation):** 10 passed, 10 skipped by design (desktop builds once). At
360 x 780 on Windows fonts, the menu keeps one line with "Story" and Donate ends at 582 px of 780,
the same as without it; one line at 320 px too.

## 6. Growth (US4, SC-008)

In the scratch copy from §5, add a second made-up chapter dated earlier than the first, approve it, and
build:

- It appears before the first, every other chapter's file and hash is byte-identical, and the first
  chapter's anchor still works.
- Every other journey file's bytes equal the copies recorded before the edit, so only the new chapter's
  folder changed (the scratch copy isn't a git repository).

**Result (2026-11-06, graduation):** passes, as `story-launch.spec.ts`'s SC-008 test (in §5's count).

## 7. Gate and budgets

```text
npm run validate-data; npm run scan-images; npm run check-boundaries; npm run build; node scripts/check-links.ts; npm run scan-privacy
node scripts/lighthouse-budget.mjs
```

- `check-links` passes on today's site, then fails on a planted dead chapter link with the chapter's ID
  and no text.
- A planted privacy match in a story file reports a redacted finding.
- Lighthouse (mobile): the `long` preview and the landing page at 90 or more, no script files on the
  story page, no third-party requests (SC-009, FR-073). Add `story` to `PAGE_TYPES` so the nightly Quality
  run checks the real page once it exists.

**Result (2026-11-06, graduation):** every gate command passes on today's site (deploy build;
`check-links`: no issue). A planted dead chapter link stops `check-links` with `chapter "chapter-a"
links to /running/nowhere/` and no text (graduation drill); the redacted privacy finding in a story file
is `scan-privacy.test.ts`'s (no rule reaches story text in a real gate run first: `validate-data`
stops a provider-like number earlier, quoting nothing). Lighthouse (mobile, local): the `long` preview
100 (LCP 0.91 s, 14.4 KB gzip, no script, no third-party request), the landing page 100 (LCP 1.13 s).
Previews are measured with `--path=`, on a `SHELL_PREVIEW=1` build (from Git Bash, prefix
`MSYS_NO_PATHCONV=1`, or the path is rewritten to a Windows one and the page is skipped):

```text
node scripts/lighthouse-budget.mjs --path=/story-preview/long/
```

## 8. The real story (content PR)

**Owner** steps are folded into one review session, outside the repository:

1. The agent drafts the note (FR-008) and the page wording (FR-039) from the owner's words, outside the
   repository. **Owner:** edits and approves them.
2. The agent writes the approved chapters, closing section, note and page wording into their files,
   marking each figure with a placeholder and its source, and the one link with its path.
3. **SC-005:** the loader refuses unapproved files, so the agent copies the site to a scratch folder
   outside the repository, records the approvals there with the same dates as step 5, builds the copy,
   renders each file's plain text to a scratch file and diffs it with the approved text. Zero
   differences, or the file isn't approved.
4. **Owner:** looks at the rendered chapters on a local preview of that copy (figure sources and the
   set-apart figure included) and says yes, or asks for a change, which is then approved afresh.
5. The agent runs `approve-story --journey=<target>` in the repository for each file, with
   `--date=2026-11-04` for the chapters and closing section approved that day and unchanged, the note's
   and page wording's approval date for those, else that day's date (research.md R4), sets `story_link`,
   and writes `VOICE.md` from the owner's edits (style lessons only).
6. The full gate of §7 on the real files, locally, including `scan-privacy` and `check-links`.
7. **Before the PR:** the agent reads every new file in full, and searches the repository for the raw
   answers and drafts (none may be found, SC-005). The PR body describes the content by shape only.
8. After the merge: `main`'s Gate run finishes, deploy included; then the live checks (page, menu, landing
   panel, share image, sitemap, Donate on a phone) and a guided review with the owner.

## 9. After launch

- **SC-011, reader test:** offered once on the real text; the owner may skip it, as with earlier
  usability checks.
- **A new chapter** (first expected after Brighton): §8 for that chapter alone. The agent asks whether
  the closing section still holds.
