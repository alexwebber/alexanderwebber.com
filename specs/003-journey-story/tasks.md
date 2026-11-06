---

description: "Task list for the Journey Story (003-journey-story)"
---

# Tasks: Journey Story

**Input**: Design documents from `/specs/003-journey-story/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (README, content-files,
routes, gate), quickstart.md

**Tests**: Test tasks ARE included. The constitution (Principle II(a)) and plan.md's *Graduation plan*
require solid contract coverage **by graduation**. Tests are written **alongside or straight after**
the code they cover; test-first/TDD is NOT required. Suites run locally and on PRs through the
path-filtered `tests.yml` jobs. The build gate gains two things only: the journey checks inside
`validate-data` and the build's first step, and the new `check-links` step after the build.

**Privacy (FR-036; applies to every task)**: the repository is public. Slices 1–6 (Phases 1–6) use
made-up text and generated images only, and no task in them reads the approved story or the owner's
answers, which live outside the repository. Only Phase 7 touches the real text, and only once it's
approved. No task, fixture, test, PR body or commit message may carry story wording, chapter names,
personal details or real figures; tasks describe the story by shape only.

**Owner decisions reflected here (#105, all ten plan boxes ticked; plan.md *Open questions for the
owner*, each recommended option as written)**:

1. A Garmin figure inside the prose reads like "12.3 kg (Garmin Index S2)": the source in brackets
   straight after the figure, at the prose's size in the secondary text colour. Owner figures with no
   Garmin source show nothing extra (T028).
2. Chapter dates read "15 Mar 2001", "March 2001" and "March to September 2001" (months in full when
   there's no day) (T024).
3. The chapter list is a closed "Chapters" disclosure at the top, with "Back to chapters" after each
   chapter (T054, T055). The real story has nine chapters, so it shows at launch.
4. "Story" isn't repeated in the landing page's section links while the story panel sits above them
   (T046).
5. The "not medical advice" note holds back launch; the closing section doesn't (T009, T078).
6. The approved chapters and closing section are recorded as approved on 4 Nov 2026 if the words reach
   the site exactly as approved; the owner looks at the rendered chapters once, in the session that
   approves the note and page wording (T080–T082).
7. At most two figures a chapter, counting figures within the prose, checked automatically (T002).
8. The share image's words can't contain any digit (T003).
9. FR-062 as amended (no other people in chapter photos outside races; in a race photo, strangers in
   the crowd only if none is recognisable), and spec 001's FR-055 mentions story photos. Both edits are
   already in the specs; FR-062 is an approval step, not a check (T063, T091).
10. The takeaway is a bordered box with a heavier start edge and "What I learned" as a small heading
    (T027, T030).

**For the owner to confirm in this tasks PR (checkbox questions, each with its recommended option)**:

1. **A new figure category, `calories`** (daily calories burned, a Garmin estimate: one value or a
   range per day, in made-up form "1,234 calories" or "1,000 to 2,000 calories"). The owner approved showing it
   in the interview on 2026-11-03 (FR-013); adding it to the schema records that approval. It's always
   the owner's figure (`source: owner`, not in the stored data) with `garmin: Garmin`, and "calories" is
   its only unit (data-model.md §3; T002). *Recommended: yes.*
2. **Numbers in the prose that aren't measurements of the owner are prose, not figures**: a target or
   aspiration, a product's limit, or a fixed expression the owner chose to keep in their own words
   (a non-metric one included). They aren't marked up, carry no source and don't count towards the two
   figures; FR-077's metric-unit rule applies to figures only (data-model.md §3, spec FR-077's note).
   *Recommended: yes.*
3. **FR-078 reworded** (spec.md): test-only previews cover every state that renders (one chapter, a
   long story, figures, photos, no closing section); "no chapters" and each refused case are covered by
   scratch-site drills and temporary-tree tests, never by a deploy build. That's how the plan already
   built it. *Recommended: yes.*

**Organization**: Each phase is one PR-sized delivery slice, in plan.md's *Delivery order* (the
owner's order), and one session. Each phase header says what goes live, how to view it, and whether it
needs the owner. Owner steps are tasks marked **(owner, guided by the agent)**: the agent prepares
everything around them and folds them into reviews the owner is already doing (plan.md *Owner steps*).
Later, trigger-based work is in *Standing follow-ups*, written into `PROJECT_MEMORY.md`'s *Next
session* block so nothing depends on the owner remembering.

**Task IDs** are this feature's own. T113 and the like in `PROJECT_MEMORY.md` refer to
`specs/002-fundraising/tasks.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story the task serves (US1–US5, numbered as in spec.md)
- **(owner, guided by the agent)** marks a task that needs the owner

## Path Conventions (from plan.md)

- Site (TypeScript/Astro): `src/sections/running/**`, `astro.config.mjs`. `src/shared/` gains nothing
  (FR-070, Principle VII)
- JSON Schemas: `schemas/owner/`, fixtures in `schemas/fixtures/owner/<schema>/{valid,invalid}/`
- Story data (Phase 7 only): `data/running/owner/journey/`
- Tooling scripts: `scripts/`, shared helpers `scripts/lib/`; gate: `.github/actions/gate/action.yml`
- TS tests: `tests/{unit,contract,e2e,a11y}/`, helpers `tests/helpers/`
- Previews: `tests/fixtures/story-preview/`
- No Python change: ingest reads named owner files only, and `publish-check` doesn't govern `owner/`
  (research.md R19). `ingest/tests/contract/test_schemas.py` does validate every shared fixture, so
  pytest runs whenever `schemas/` changes

## User stories and phases

The phase numbers are the plan's delivery slices. Story numbers and titles are spec.md's own.

| Phase | Delivery slice (plan.md) | User story (spec.md) | Priority | Needs the owner? |
|---|---|---|---|---|
| 1 Foundational | 1. Files and checks | None (blocks all) | | No |
| 2 | 2. The page | US1 Reading the story, US2 Only the owner's approved words | P1 | Screenshots in the PR |
| 3 | 3. Finding it | US3 Finding the story | P2 | Screenshots in the PR |
| 4 | 4. Growth | US4 The story keeps growing | P2 | Screenshots in the PR |
| 5 | 5. Photos | US5 Photos in a chapter | P3 | Screenshots in the PR |
| 6 Polish | 6. Polish and graduation | Cross-cutting | | No |
| 7 Launch | 7. The content PR | US1–US3 on the real text | | **Yes**: one approval session, then a guided review |

Slices 1–6 change nothing a visitor sees: the story area exists only once a chapter does, and no
chapter enters the repository before Phase 7.

## The PR routine (every phase that raises a PR)

Referred to below as **the PR routine**:

1. `git fetch`, branch from `origin/main`, and read the matching `AGENT_TIPS.md` sections first
   (*GitHub Actions*, *Privacy and data pipelines*, *Astro*, *End-to-end testing*, *Share images*,
   *UI and accessibility*, *Testing*, as the phase needs them).
2. Run the suites the phase touches: `npm test`; `npx astro check`; `cd ingest; uv run pytest` when
   `schemas/` changed; and, from PowerShell, a `SHELL_PREVIEW=1` build and `npm run e2e` on **both**
   Playwright projects (`npx astro preview stop` first if a preview server is running). A deploy build
   (no `SHELL_PREVIEW`) follows for the gate commands: `validate-data`, `scan-images`,
   `check-boundaries`, `build`, `check-links` (from Phase 1 on), `scan-privacy`.
3. **Slices 1–6: compare `dist/` against `main`** (`/pr-ready` builds the branch's base on `main`
   in a temporary worktree and compares every file). Expected: byte-identical, because no chapter exists. Explain any difference in the PR
   (Vite's CSS chunking can move when a component is added, research.md R19), and compare computed
   styles if CSS moved.
4. Look at phone-width screenshots of everything visible (here, the previews) in light and dark, and
   put them in the PR (one commit on a side branch that never merges, linked by SHA; WebP).
5. **Privacy pass before pushing**: read every new or changed file in full, and `/pr-ready` searches
   the diff, the branch's commit messages and the PR body for the private terms (FR-036). Fixtures come
   from a fixed seed.
6. The PR body has a *How to view it* section (the phase header's text) and checkbox questions for
   anything the owner must confirm. Say plainly when nothing is visible yet, with an example of what
   the previews show.
7. Before saying the PR is ready, `/pr-ready` shows every check green, not just the required ones.
8. After the merge, `/after-merge <pr>` waits for `main`'s own Gate run to finish, deploy included. If a box was left
   unanswered, ask at the next session start.
9. Update *Next session* in `PROJECT_MEMORY.md` and the log in `DECISIONS.md`, add any lesson to *Upstream
   candidates*, log the phase's token cost, and tell the owner it's a good point for a new session.

---

## Phase 1: Foundational (delivery slice 1: files and checks)

**Purpose**: The journey files' schemas, store registration, the approval hash and its loader check,
`approve-story --journey`, every validation rule, the `story_link` rules, the new `check-links` gate
step and the redacted privacy findings. Every user story needs it.

**Goes live**: nothing visible. The gate gains `check-links`, which runs on every deploy and every bot
refresh from the merge on.

**How to view it**: nothing to view. The PR reports `check-links`' clean run on today's site, the
refused cases, and the `dist/` comparison (byte-identical).

**Needs the owner**: no (PR review only).

**Critical**: No user story work can begin until this phase is complete.

### 1a. Setup

- [X] T001 In `.github/workflows/tests.yml`, add `tests/fixtures` to the first alternation of the `vitest=$(match '...')` regex, giving `^((src|schemas|scripts|tests/unit|tests/contract|tests/helpers|tests/fixtures|\.github/workflows)/|...`, because the approval, sentinel and page tests import `tests/fixtures/story-preview/generate.ts`; and add `scripts/check-links\.ts` to the `playwright=$(match '...')` alternation (as `scripts/check-links\.ts$`), because the launch drill (T049) runs it. Every other new location is covered already: `scripts/`, `src/`, `schemas/`, `tests/unit/`, `tests/contract/`, `tests/helpers/` by Vitest; `tests/e2e/`, `tests/a11y/`, `tests/fixtures/` and `data/running/owner/` by Playwright; `schemas/` by pytest

### 1b. Schemas and registration

- [X] T002 [P] Create `schemas/owner/journey-chapter.schema.json` (draft 2020-12, `$id` `https://alexanderwebber.com/schemas/owner/journey-chapter.schema.json`, title `JourneyChapter`, `additionalProperties: false` throughout, an `x-error` on each rule an owner can break). Data-model.md §3, verbatim: `id` "A slug. Equals the folder name" (defs `slug`; the folder check is T009's); `name` "Required plain text, one line" (defs `text`, no line break); `when` "Required. `YYYY-MM-DD`, `YYYY-MM`, or `<start>/<end>` with each end a month or a day" (a pattern; "start before end" and "not after today" are T009's); `order` "Optional integer"; `prose` "Required. Plain text in paragraphs separated by blank lines" (its own `\S` rule, because defs `text` refuses the trailing line break of a `|` block, as 002's story `text`); `takeaway` "Required. Plain text, one paragraph, at most 400 characters (FR-004). No markup" (`maxLength: 400`, no blank line); `figures` "Optional, `maxItems: 2` (FR-010)"; `photos` "Optional, `maxItems: 3` (FR-060)"; `approved` "Required", a closed object with `date` (defs `date`) and `sha256` "64 lower-case hexadecimal characters" (`^[0-9a-f]{64}$`). Each figure (closed): `id` slug, "unique in the chapter" (T009); `category` an enum of exactly `weight`, `body_fat`, `vo2_max`, `resting_hr`, `hrv`, `training_status`, `race_prediction`, `fitness`, `race_time`, `best_effort`, `run_distance`, `run_pace`, `training_total`, `calories` (research.md R5; `calories` approved by the owner on 2026-11-03, confirm box 1; "Anything else needs a schema change, which records the owner's approval", FR-013); `label` plain text; `as_of` "A day or a month"; `text` "The figure exactly as approved", matched per category with `if`/`then` patterns, data-model.md §3's *Figure text by category* table verbatim: `kg` for `weight`, `%` for `body_fat`, a bare number for `vo2_max` and `fitness`, `bpm` for `resting_hr`, `ms` for `hrv`, a clock time `m:ss` or `h:mm:ss` for `race_prediction`, `race_time` and `best_effort`, `km` for `run_distance`, `m:ss /km` for `run_pace`, `km` or `h:mm` for `training_total`, plain words with no digit for `training_status`, and for `calories` a comma-grouped number or "<n> to <n>", followed by " calories" and no other unit (FR-077); `source` `stored` or `owner`; `ref` "Required with `source: stored`: `{ run: <run-id> }`, `{ health: { metric, date } }`, `{ manual: { kind, as_of } }` or `{ race: <slug> }`. Not allowed with `source: owner`" (`if`/`then`), with the ref kind fixed per category by data-model.md §3's *Ref kinds by category* table (`if`/`then`): `health` for `weight`, `body_fat`, `vo2_max`, `fitness`, `resting_hr`, `hrv`; `manual` for `training_status`, `race_prediction`; `run` for `run_distance`, `run_pace`, `best_effort`; `run` or `race` for `race_time`; and `training_total` and `calories` owner-only (`source: stored` refused); `calories` also requires `garmin: Garmin`; `garmin` "Optional: a Garmin device model (`garminDevice` from `defs`), `Garmin` alone, or `derived`". Each photo (closed): `file` `^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|webp|avif)$`, `description` "Required plain text: the alt text (FR-063)", `caption` "Required plain text, shown under the photo (FR-063)". No `video` property: a later spec adds it with its own approval (research.md R11)
- [X] T003 [P] Create `schemas/owner/journey-page.schema.json` (`JourneyPage`), `schemas/owner/journey-note.schema.json` (`JourneyNote`) and `schemas/owner/journey-closing.schema.json` (`JourneyClosing`), closed, each with T002's `approved` block. Data-model.md §6–§8, verbatim: page `title` "Required plain text, at most 70 characters", `description` "Required plain text, at most 160 characters", `share_text` "Required plain text, at most 90 characters, **no digits**" (pattern `^[^0-9]+$`, with an `x-error` saying the share image carries no figure, FR-075), `link_label` "Required plain text"; note `text` "required plain text, one paragraph, no markup"; closing `heading` and `text` "required plain text", `text` in paragraphs (its own `\S` rule)
- [X] T004 [P] Add made-up fixtures (generated words, never real ones) in `schemas/fixtures/owner/journey-chapter/{valid,invalid}/`, `schemas/fixtures/owner/journey-page/{valid,invalid}/`, `schemas/fixtures/owner/journey-note/{valid,invalid}/` and `schemas/fixtures/owner/journey-closing/{valid,invalid}/`. Valid: a minimal chapter; a full one (day, month and period `when`, `order`, two figures of different categories and sources, three photos); each other file. Invalid: no `approved`; a short or upper-case `sha256`; a third figure; a fourth photo; an unknown category; a figure `text` against its category's pattern (e.g. a weight without `kg`); `ref` with `source: owner`; no `ref` with `source: stored`; a photo with no `caption`, no `description` or a `.png` file; a takeaway over 400 characters; a two-line `name`; a `calories` figure with `kg`, with `source: stored`, or without `garmin: Garmin`; a ref kind that doesn't fit its category (a `weight` figure with a `run` ref, a `run_distance` figure with a `health` ref); a `race` ref on a category other than `race_time`; `share_text` with a digit; a `title` of 71 characters; an unknown key in each file. `tests/contract/schemas.test.ts` and `ingest/tests/contract/test_schemas.py` require at least one valid and one invalid fixture per schema, and reject fixtures of unknown schemas, so T006 registers the schemas in the same commit
- [X] T005 [P] In `schemas/owner/section.schema.json`, change the `story_link.href` description and `x-error` examples from `/story/` to `/running/story/`, wording only: the pattern and the generated type stay as they are (data-model.md §9 "unchanged schema"), and `schemas/fixtures/owner/section/valid/full.yaml` stays, because schema fixtures aren't run through `validateRunning`
- [X] T006 Register the journey files and add them to the store, in one task, because each piece rejects unknown files or types today (data-model.md §1, research.md R19). In `src/sections/running/data/store/schemas.ts`, add `owner/journey-page`, `owner/journey-note`, `owner/journey-closing` and `owner/journey-chapter` to `RUNNING_SCHEMAS`. In `src/sections/running/data/store/files.ts`: the `schemaForFile` rules `^owner\/journey\/page\.yaml$`, `^owner\/journey\/note\.yaml$`, `^owner\/journey\/closing\.yaml$` and `^owner\/journey\/chapters\/[^/]+\/chapter\.yaml$`; add a separate `JOURNEY_PHOTO_FILE` = `^data\/running\/owner\/journey\/chapters\/[^/]+\/[^/]+\.(jpg|webp|avif)$` beside `PHOTO_FILE` and accept it in the unexpected-file check, or every chapter photo is "not an expected data file". Don't widen `PHOTO_FILE`: `validate.ts` (the unlisted-photo warning near line 161) would then warn that every chapter photo "is not listed in its race.yaml photos"; `RunningData.journey` (`page?`, `note?`, `closing?`, `chapters: Loaded<JourneyChapter>[]`), the `store()` cases, and `locate()`'s naming so every message's entry reads `chapter "<id>"`, `closing section`, `note` or `page wording` (contracts/content-files.md *Messages*). In `src/sections/running/data/store/running-store.ts`, export `JourneyChapter`, `JourneyClosing`, `JourneyNote`, `JourneyPage` and `Journey` (`{ chapters: JourneyChapter[]; closing?: JourneyClosing; note?: JourneyNote; page?: JourneyPage }`), and add `OwnerData.journey: Journey` ("`{ chapters: [] }` until a chapter exists"); fill it in `src/sections/running/data/store/json-file-store.ts`. Absent files mean no journey. **In the same task**, add `journey: { chapters: [] }` to every hand-written `getOwner` fake in `tests/unit/` (today `fundraising-cards.test.ts` twice, `goal-cards.test.ts`, `health.test.ts`, `landing.test.ts`, `race-pages.test.ts`, `shell-components.test.ts` and `training.test.ts`; find them all with `grep -rn "getOwner: async" tests/`): `tsconfig.json` includes `tests/` and `astro check` is part of `npm run build`, so a missing field turns the gate red and blocks every refresh. Run `npm run gen-types` and `npx astro check`

### 1c. Approval (research.md R3)

- [X] T007 In `src/sections/running/data/store/files.ts`, add `journeySha256(kind, value, photoBytes)`: the sha256 of the canonical JSON (keys sorted at every level, no whitespace, UTF-8) of the file's **hashed fields only**, as YAML parsed them, data-model.md §2 verbatim: `chapter.yaml` "`id`, `name`, `when`, `order`, `prose`, `takeaway`, `figures`, and `photos` with each photo's `file`, `description`, `caption` and the sha256 of the photo file's bytes"; `closing.yaml` "`heading`, `text`"; `note.yaml` "`text`"; `page.yaml` "`title`, `description`, `share_text`, `link_label`". "Absent optional fields are left out, not hashed as null." The field lists are named constants, never "everything but `approved`", so a future `video` field doesn't move the hash (FR-053). `storySha256()` (spec 002) is unchanged. In `loadRunningData()`, beside the campaign story's check, check each journey file: a missing `approved` reports "needs the owner's approval before it can be published" (swapping `toIssues`' "is required", as 002 does for stories, held equal to the schema's `x-error` by a test); a `sha256` that differs reports "has changed since it was approved; the owner must approve it again" on `approved.sha256`. Either drops the file and records an error, so the store, `validate-data` and a plain `astro build` all stop before `dist/` is emptied (FR-034). Photo bytes are read from the chapter's folder; a listed photo that's missing is reported once, as `photos[<n>].file` "is listed but isn't in the chapter's folder" (contracts/content-files.md: the loader's rule, because only the loader reads the bytes), with no second hash message. No message quotes a value (FR-035)
- [X] T008 [P] Create `src/sections/running/domain/journey.ts`, pure, first part (data-model.md §5, research.md R6): `parseProse(prose) → Paragraph[]`, where a paragraph is `{ kind: 'figure', id }` (a placeholder alone in a paragraph) or `{ kind: 'text', parts: (string | { figure: id } | { link: href, text })[] }`. Blank lines separate paragraphs; "Leading and trailing blank lines are ignored". Links are `[link text](/path/)` only: "Path starts with one `/`, ends with `/` or `/#anchor`, no scheme, query or spaces". Anything else that looks like markup ("an unmatched `{{` or `}}`, `[…](` not in the form above, or an HTML-like tag: `<` followed by a letter or `/`") is an issue carrying the paragraph number, never the text; a plain `<` in a sentence is fine. A `parseText(text, { figures: false })` variant for the closing section (links, no figures). `parseWhen(when) → { kind: 'day' | 'month' | 'period', start, end }`, comparing ends by their first and last day. No dependency
- [X] T009 Add the journey rules to `validateRunning` in `src/sections/running/validate.ts`, each in Running's `file / entry / field` format and never quoting a value (contracts/content-files.md *Validation* and *Messages*; data-model.md §3 *Cross-field rules*). Errors: `id` differs from its folder (FR-051); `when` start after its end, or its end (a day's or month's start) after today in Europe/London; `approved.date` or a figure's `as_of` in the future; two chapters with the same start and no distinct `order`, naming both chapter IDs (FR-002); a figure `id` repeated in a chapter; a placeholder naming no figure, a figure with no placeholder or with two (each figure "has exactly one placeholder"); stray markup, with `prose, paragraph <n>`; the first paragraph a lone placeholder (FR-003, FR-005); a link not of the site-path form (FR-015); a closing `text` with a placeholder; a `stored` figure whose `ref` doesn't exist (a published run ID, a published health point of that metric and date, a `manual-metrics.yaml` entry of that kind and date, or a `races/<slug>/race.yaml` with an official time); a figure whose category and ref don't agree (data-model.md §3 *Ref kinds by category*: `weight` → `weight_avg7`, `body_fat` → `body_fat_pct`, `vo2_max` → `vo2max`, `fitness` → `fitness_ctl`, `resting_hr` → `resting_hr`, `hrv` → `hrv`; `training_status` and `race_prediction` → that manual kind; the schema already fixes the ref kind, so this checks the metric and manual kind names); a `stored` figure dated before the first stored record of its kind (FR-012: "only the owner can supply it"); `garmin` missing or disagreeing with its record: "a run's own `device` (or `Garmin` when it has none), the scale for weight and body fat, `Garmin` for other wellness and manual Garmin figures, `derived` for fitness and fatigue" (FR-014); any chapter without `note.yaml` (FR-008) or without `page.yaml` (FR-039) (owner decision 5). Warning: `closing.yaml` with no chapter, "it has nothing to follow". Use T008's parser
- [X] T010 Add the `story_link` rules to `validateRunning` in `src/sections/running/validate.ts`, each naming `data/running/owner/section.yaml` and the field (data-model.md §9; FR-040, FR-042; research.md R8): `story_link` set with no chapter is an error on `story_link.href` ("the story page doesn't exist"); `story_link.href` other than `/running/story/` is an error on `story_link.href`; `story_link.label` differing from `page.yaml`'s `link_label` is an error on `story_link.label`, quoting neither label. Chapters with no `story_link` are allowed. Today's `section.yaml` has no `story_link`, so nothing real changes
- [X] T011 Extend `scripts/approve-story.ts` with journey mode, keeping campaign mode byte-for-byte as it is (contracts/content-files.md *`scripts/approve-story.ts`, journey mode*): `node scripts/approve-story.ts --journey=<chapter-id|closing|note|page> [--date=YYYY-MM-DD]`. `<chapter-id>` is `data/running/owner/journey/chapters/<id>/chapter.yaml`; `closing`, `note` and `page` their files; anything else, or a missing file, refuses. The date defaults to today in Europe/London; a future or malformed date refuses. It writes `approved.date` and `approved.sha256` with T007's `journeySha256` (one function makes and checks the hash), reads listed photos' bytes (a missing one refuses), keeps the text and comments (`parseDocument`), writes with `lineWidth: 0`, re-parses the result and refuses unless every hashed field and the block survive unchanged; the file is untouched on any refusal. Output: one line naming the file and date. Never text, never a parser message. The JustGiving reminder prints for campaign stories only. Update the header comment and usage line

### 1d. Gate additions (contracts/gate.md)

- [X] T012 [P] Create `scripts/check-links.ts`, exporting `checkLinks(distDir): LinkIssue[]` for tests and drills and accepting `--dist=<dir>` on the command line (default: the repo's `dist/`), and its npm script `check-links`, and add a step `Check links` running `npm run check-links` to `.github/actions/gate/action.yml` directly after the build step, before the R2 run-ID map and `scan-privacy` (the gate's order becomes `validate-data` → `scan-images` → `check-boundaries` → build → `check-links` → `scan-privacy`; `gate.yml` and `refresh.yml` both run it). Scope: every `.html` file in `dist/`; every `href` that is a site path (starts with one `/`), with any `#fragment` stripped first, must resolve to `<path>index.html` for a path ending in `/`, else the file itself; fragments are checked against element `id`s only for links to `/running/story/` (on that page), and ignored elsewhere. Ignored: external links (`https:`), `mailto:`, links into `/_astro/`, and `/running/api/` Worker routes. Output: `error: <page file>: links to <path>, which the build didn't make`; for a link carrying `data-chapter-link="<id>"`, the message names `chapter "<id>"` instead of quoting its text. Exit 1 on any finding. **It must pass on today's site**: run it on a deploy build of `main` first, and fix any dead link it finds in this slice (research.md R9). Update the gate action's header comment
- [X] T013 [P] In `scripts/scan-privacy.ts`, redact every finding in `data/running/owner/journey/`, `data/running/owner/stories/` and `dist/running/story/` as `[<n> chars redacted]`, whatever the rule (FR-035). The rules still apply to those files, unchanged (FR-022), and the fundraising-key exemption for `owner/stories/` (`STORY_FILE`) stays. Update the header comment

### 1e. Tests (straight after the code)

- [X] T014 [P] Create `tests/contract/journey-schemas.test.ts`: every category's `text` pattern, accepting and refusing made-up values (FR-077); `when` in each form; `maxItems` 2 figures and 3 photos; `share_text` refusing any digit, a year included (owner decision 8); `ref` required with `stored` and refused with `owner`; no `video` property yet. `tests/contract/schemas.test.ts` and `ingest/tests/contract/test_schemas.py` pick up T004's fixtures by themselves
- [X] T015 [P] Create `tests/unit/journey.test.ts` for `parseProse` and `parseWhen`: every form in data-model.md §5 (inline figure, lone figure, link with and without `#anchor`, leading and trailing blank lines) and each stray-markup case (unmatched `{{` and `}}`, `[text](https://…)`, `[text](/path?q)`, `[text](path/)`, `<b>`, `</p>`), each with its paragraph number; a plain `<` passing; the closing variant refusing a placeholder; `when` across months, across years, and a period whose start is after its end
- [X] T016 Create `tests/unit/journey-validate.test.ts` through `tests/helpers/temp-repo.ts`, with a made-up story tree (one chapter, note, page) approved by `journeySha256`. One test per refused case of research.md R18 and contracts/content-files.md, each asserting file, entry, field and severity: no approval; one character changed in each hashed field (name, `when`, prose, takeaway, a figure's `text`, a caption); a photo swapped under the same name; a listed photo missing; a placeholder with no figure; a third figure; a lone figure first; an external link; a future `when`, `as_of` and approval date; a same-day tie with no `order`; a missing note; missing page wording; a `story_link` with no chapter; an href other than `/running/story/`; a link label that differs; a photo with no caption; a fourth photo; a `stored` figure with no record, and one dated before the stored data; a figure whose category and ref disagree (a `weight` figure naming `vo2max`, a `training_status` figure naming a race-prediction entry); a `race` ref to a race with no official time; a missing and a mismatched `garmin`; an `id` that differs from its folder; a closing section with no chapter (warning only). Also: CRLF line endings and a YAML comment don't move the hash; a field outside the hashed list (e.g. a made-up `video` key added to the parsed value) doesn't move it; an unapproved file fails `validateData`, the store and a `loadRunningData()` call alike (FR-034). **Sentinel test**: one made-up sentinel word in every text field of every file, every refused case run, and no message, warning or log line contains it (FR-035, SC-003)
- [X] T017 [P] Extend `tests/unit/approve-story.test.ts` for journey mode: each target round-trips and then passes validation; the hashed fields are byte-identical afterwards and comments survive; re-approval after an edit moves the hash; photos' bytes are in the hash; a bad target, a missing file, a missing photo, a future or malformed date each refuse without touching the file; output names the file and date only, with no text and no JustGiving reminder; campaign mode is unchanged
- [X] T018 [P] Create `tests/unit/check-links.test.ts` over planted `dist/` trees: a clean tree passes; a dead site link, a dead chapter link (message names the chapter, not its text), a dead `story_link` panel link and a missing `#anchor` on the story page each fail; external, `mailto:`, `/_astro/` and `/running/api/` links are ignored
- [X] T019 [P] Extend `tests/unit/scan-privacy.test.ts`: a planted rule match in each of `data/running/owner/journey/`, `data/running/owner/stories/` and `dist/running/story/` reports file, line, column and rule, and the output doesn't contain the planted word; the same match elsewhere still prints its excerpt; the `owner/stories/` key exemption is unchanged
- [X] T020 [P] Extend `tests/contract/store.test.ts` with `OwnerData.journey`: absent files give `{ chapters: [] }`; a full made-up tree loads every file; an unapproved or changed file isn't returned and is reported

### 1f. Ship the slice

- [X] T021 [P] Update `schemas/README.md` (the four journey schemas and what each file holds) and the header comments of the touched store files. No story wording
- [X] T022 Run the PR routine's suites, then quickstart.md §1, and §2 steps 2–4 **for real**, not only as unit tests: in a scratch copy (`tests/helpers/scratch-site.ts`'s `copySite`, or a temporary folder outside the repo), add a made-up approved chapter, note and page wording; change one character and confirm both `validateData(copyRoot)` (`scripts/validate-data.ts` validates the repo it sits in, so call the function on the copy, not the npm script) and a plain `astro build` of the copy (`buildSite`) stop naming the file, `chapter "<id>"` and `approved.sha256`, with the previous `dist/` intact; remove `approved` and confirm the approval message; swap a generated photo under the same name and confirm the hash message. Step 1's rendering waits for Phase 3 (T049). Then quickstart.md §7's gate parts: `npm run check-links` clean on a deploy build of today's site, and `checkLinks(join(copyRoot, 'dist'))` failing on a dead link planted in the copy's built HTML; a planted privacy match in a scratch journey file reporting a redacted finding. Compare `dist/` against `main` (expected byte-identical)
- [X] T023 Raise the PR by the PR routine. *How to view it*: nothing visible; the PR lists the refused cases and `check-links`' first run. After the merge, wait for `main`'s Gate run (now with `check-links`) to finish, deploy included, then dispatch one refresh (`gh workflow run refresh.yml --ref main`) and confirm its gate passes `check-links` too, because the bot's deploys now depend on it

**Checkpoint**: approved text can be stored and checked, and nothing else can reach a build. Nothing is
visible.

---

## Phase 2: User Stories 1 and 2 - Reading the story; only the owner's approved words (Priority: P1)

**Goal**: The story page's components and styles, rendered over made-up previews: chapters in time
order, each with its name, when, prose with inline and set-apart figures, and the "What I learned"
box; the closing section and the note; exactly the approved words.

**Independent Test**: In `/story-preview/<state>/`, on a phone and a desktop: chapters in time order
with their parts in order; the first screen shows the first chapter's name and opening lines and no
figure; takeaways stand out in light, dark and forced colours; each chapter's text equals its
fixture's approved text; everything reads the same with scripts off.

**Goes live**: nothing: no deploy build has a story route until Phase 3, and no chapter until Phase 7.

**How to view it**: screenshots in the PR of `one-chapter`, `three-chapters`, `figures`, `no-closing`,
`same-day` and `long` at 360 px and on a desktop, light and dark, made-up text only.

**Needs the owner**: a look at the screenshots in the PR review (plan.md *Owner steps*).

**Not built yet**: the route, menu item, share image and landing panel (Phase 3), the chapter list
(Phase 4), photos (Phase 5), the real story (Phase 7).

### Implementation for User Stories 1 and 2

- [X] T024 [US1] Add the display half of `src/sections/running/domain/journey.ts`, pure (data-model.md §10, owner decisions 1 and 2): `sortChapters()` by the start of `when`, then `order`, oldest first, the same on every build (FR-002); `whenText(when)` giving "15 Mar 2001" (spec 001's date format), "March 2001", "March to September 2001" and "March 2001 to February 2002", plus the `datetime` value for the `<time>` element (FR-077); `sourceText(garmin)` giving "Garmin <device>", "Garmin" or "derived in part from Garmin device-sourced data", and nothing for an owner figure without `garmin` (research.md R1)
- [X] T025 [US1] Create `src/sections/running/data/journey.ts`: `loadJourney(store)`, memoised with `perStore`, reading `getOwner().journey`. "Exists: at least one chapter. Otherwise `undefined`, and nothing anywhere renders" (FR-042). With chapters but no `page.yaml` or `note.yaml` it throws a `DataValidationError` naming the missing file and quoting no text (validation stops the gate first; this keeps a plain build from rendering a page without its wording or note). Returns the page wording, the chapters sorted with their parsed paragraphs, their `when` text and their figures by ID, then the closing section's parsed paragraphs (if any) and the note
- [X] T026 [P] [US1] Add a `lastUpdated` prop (default `true`) to `src/sections/running/components/SectionLayout.astro`; `false` renders no `LastUpdated` block (FR-071, research.md R15). A prop, not an empty named slot, because `Astro.slots.has` reports a conditional slot as filled. Every existing page keeps the default, so their output is unchanged
- [X] T027 [P] [US1] Create `src/sections/running/styles/story.css`, every rule under the `.theme-running` scope and a `.story-` prefix (but not `.story-link`, which is spec 001's landing panel), not scoped `<style>` blocks, so repeated markup carries no per-element attribute and an unrendered component can't reorder a page's inlined CSS (research.md R16, R19): paragraphs, takeaways and figure blocks at `max-width: 66ch` (FR-072); `overflow-wrap: anywhere` on the prose (no sideways scroll at 320 px); `.story-source` at the prose's size in the secondary text colour; `.story-figure-block` smaller than the prose; `.story-takeaway` a box with a border on every side and a heavier start edge, kept in forced colours (owner decision 10, FR-004); `.story-when` and `.story-note` as secondary text
- [X] T028 [US1] Create `src/sections/running/components/StoryProse.astro`: one `<p>` per text paragraph, text escaped by Astro's normal output (never `set:html`); an inline figure as `<span class="story-figure">text</span>`, then `{' '}`, then `<span class="story-source">(source)</span>` when it has one (owner decision 1); a link as `<a href="/path/" data-chapter-link="<chapter-id>">text</a>`; explicit `{' '}` wherever inline elements meet, so "12.3 kg (Garmin Index S2)" can't render as one word. A lone placeholder hands off to `StoryFigure`. It takes a `chapterId` prop, and serves the closing section with no figures (contracts/routes.md *Chapter parts*)
- [X] T029 [P] [US1] Create `src/sections/running/components/StoryFigure.astro`, the set-apart figure: `<p class="story-figure-block">` with the label, the `as_of` date ("15 Mar 2001" or "March 2001"), the figure in `<strong>` and the source on the same block, after the paragraph before it, never above the chapter's first paragraph (FR-010, FR-011, FR-014)
- [X] T030 [US1] Create `src/sections/running/components/StoryChapter.astro` with the markup of contracts/routes.md *The page*: `<section class="story-chapter" id="<id>" aria-labelledby="<id>-title">`, `<h2 id="<id>-title">` the name, unnumbered (FR-003), `<p class="story-when"><time datetime>`, `StoryProse`, then the reserved place for photos (Phase 5), then **one marked comment where a future `ChapterVideo` goes, rendering nothing** (FR-053, SC-013), then `<div class="story-takeaway">` with `<h3 id="<id>-learned">What I learned</h3>` and one `<p>` (FR-004). No empty wrapper when a chapter has no figures (US1.4)
- [X] T031 [P] [US1] Create `src/sections/running/components/StoryClosing.astro` (`<section aria-labelledby>`, its `<h2>` heading and paragraphs through `StoryProse`, FR-007) and `src/sections/running/components/StoryNote.astro` (one `<p class="story-note">`, FR-008)
- [X] T032 [US1] Create `src/sections/running/components/StoryPage.astro`, taking the loaded journey as props and rendering `SectionLayout` with `heading` = the approved `title`, `description`, `image` (a prop, `/og/running-story.png` on the real page), `garmin={false}` (attribution sits at each figure, FR-014), `lastUpdated={false}` (FR-071) and `current="story"`. In order: the `<h1>`, nothing between it and the first chapter (Phase 4 adds the closed list there), the chapters, the closing section if approved, then the note once (FR-005, FR-007, FR-008). No Donate button, fundraising card, figure summary, chart or progress bar (FR-002). Import `../styles/story.css`. No client JavaScript
- [X] T033 [US1] Add the previews (FR-078, research.md R18): `tests/fixtures/story-preview/generate.ts` (deterministic, fixed seed, lorem-style words only, output committed, approval hashes from `journeySha256`, as `tests/fixtures/fundraising-preview/generate.ts` and `tests/fixtures/race-preview/generate.ts` do), writing `tests/fixtures/story-preview/data/<state>/data/running/owner/journey/` for the states `one-chapter` (no closing section), `three-chapters` (with a closing section), `long` (12 chapters of about 600 words, with a closing section), `figures` (inline, set-apart, a Garmin device, plain "Garmin", `derived`, an owner figure with no source, and a chapter with none), `no-closing` and `same-day` (two chapters ordered by `order`); include a very short chapter (one paragraph) and a long unbroken word for the 320 px check. `tests/fixtures/story-preview/store.ts` (one `JsonFileStore` per state with the repo's schemas, `PREVIEW_TODAY`); `tests/fixtures/story-preview/[state].astro` (`getStaticPaths` over the states, the real `StoryPage`). In `astro.config.mjs`'s `shellPreview`, inject `{ pattern: '/story-preview/[state]', entrypoint: './tests/fixtures/story-preview/[state].astro' }` and update the comment. The preview menu is the real Running menu, so no deploy build gains "Story" (contracts/routes.md *Previews*)
- [X] T034 [P] [US2] Create `tests/helpers/story-text.ts`: from built story HTML, each chapter's plain text in reading order (name, when, paragraphs with each figure's `text` and source, takeaway) and the closing section's and note's, normalising whitespace only. The e2e tests use it (T039), and Phase 7's SC-005 comparison runs the same function from a scratchpad script (T080)

### Tests for User Stories 1 and 2 (straight after the code)

- [X] T035 [P] [US1] Extend `tests/unit/journey.test.ts`: `sortChapters` (month before day in the same month, period by its start, `order` on a tie, stable across runs); `whenText` and the `datetime` value for every form; `sourceText` for each `garmin` value and none
- [X] T036 [P] [US1] Create `tests/unit/story-page.test.ts` with the Astro container API over made-up journeys: the parts of a chapter in order (US1.1); the inline figure's markup and its source with a space before it; an owner figure with no source; the set-apart block after its paragraph; nothing figure-like before the first prose (US1.2); `<b>` and `&` in the prose escaped; a link carrying `data-chapter-link`; one `h1`, `h2` per chapter and the closing section, `h3` per takeaway; no "Last updated" and no Garmin line under the `h1`; no closing section, so the note follows the last chapter directly (FR-007); one chapter with no list, numbering, "coming soon" or placeholder (US1.7); no Donate, chart or progress bar anywhere; the reserved video place renders nothing. Add to `tests/unit/shell-components.test.ts` that `SectionLayout` with `lastUpdated={false}` renders no freshness block and the default still does
- [X] T037 [US1] Create `tests/e2e/story.spec.ts` over `/story-preview/<state>/` at 360 x 780 and on desktop (quickstart.md §3): chapters in time order with their parts (US1.1), `same-day` by `order`; SC-001 in `one-chapter` and `long`: the first chapter's name and opening lines on the first screen, and nothing matching a figure, chart or bar before the first prose; "What I learned" an `h3` in a bordered box, and in forced colours the border and label remain (FR-004); `figures` with sources right after inline figures and the set-apart figure after its paragraph; `no-closing` with the note straight after the last chapter; each paragraph's rendered width at most 75 times the width of "0" in its font (FR-072); no sideways scroll at 320 px in any state, the long word included; with JavaScript disabled, the same text and no script files (FR-071). Scope locators to the story's containers (strict mode). Use `exact: true` on role names
- [X] T038 [P] [US1] Create `tests/a11y/story.spec.ts` with `tests/helpers/a11y.ts` (`axe`, `outline`, `fullSweep`, `sweepOnlyInDark`): zero violations in every Phase 2 state, light and dark, forced colours for the takeaway, heading outline h1, h2, h3 (FR-074)
- [X] T039 [US2] Add to `tests/e2e/story.spec.ts` the US2.2 check: in every state, each chapter's, the closing section's and the note's plain text from T034's helper equals the fixture's approved text with each placeholder replaced by its figure (and source), character for character (SC-003). The refused cases are T016's

### Ship the slice

- [X] T040 Run the PR routine's suites, look at phone-width and desktop screenshots of every state in light and dark, and compare `dist/` against `main` (expected byte-identical: no deploy route imports the new components, and `SectionLayout`'s default is unchanged)
- [X] T041 [US1] (owner, guided by the agent) Raise the PR by the PR routine, with the phase header's *How to view it*. The owner looks at the screenshots in the PR review: the takeaway box, an inline figure's source, the set-apart figure and the dates. Nothing is visible on the live site

**Checkpoint**: the page renders any made-up story correctly and exactly as approved, in previews only.

---

## Phase 3: User Story 3 - Finding the story (Priority: P2)

**Goal**: The story page, its "Story" menu item, share image and sitemap entry, all appearing only once
a chapter exists; the landing panel as spec 001 built it; Donate kept on a phone's first screen.

**Independent Test**: A scratch deploy build of today's data has no story page, menu item, landing
link, placeholder, share image or sitemap entry. The same copy with one made-up approved chapter, the
note, page wording and a `story_link` shows the page, "Story" last in the menu and current on its
page, the panel with its label, and Donate fully on a 360 x 780 first screen with the fundraising card.

**Goes live**: nothing: no chapter exists until Phase 7.

**How to view it**: the PR gives both drills' results, with screenshots from the launch drill: the
landing page at 360 x 780 (menu, card, Donate), the menu at 320 px, and the story page with "Story"
marked current.

**Needs the owner**: a look at the screenshots in the PR. If the launch drill finds the menu needs a
third line or Donate leaves the first screen, the PR stops for the owner's decision (research.md R8).

**Not built yet**: the chapter list (Phase 4), photos (Phase 5), the real story (Phase 7).

### Implementation for User Story 3

- [X] T042 [US3] Add `journeyChapterIds(root = process.cwd())` to `src/sections/running/data/store/files.ts`: the folder names under `data/running/owner/journey/chapters/` that hold a `chapter.yaml`, sorted, without loading the data tree (data-model.md §10, as `campaignsWithFigures()` does). A closing section or note alone gives none
- [X] T043 [US3] In `src/sections/running/integration.ts`, add the `story` area to `runningAreas` **only when `journeyChapterIds()` finds a chapter**, last, after "Fundraising" (owner, #101): `key: 'story'`, label "Story", href `/running/story/`, **no `description`** (`SectionLinks` lists it only when `story_link` is absent, and then shows the label alone, because any words about the story need the owner's approval, FR-039), routes `{ pattern: '/running/story', entrypoint: './src/sections/running/pages/story.astro' }` and `{ pattern: '/og/running-story.png', entrypoint: './src/sections/running/og/story.png.ts' }`. The menu, sitemap and share image follow from this one condition (FR-001, FR-041, SC-002). Update the header comment
- [X] T044 [P] [US3] Create `src/sections/running/pages/story.astro`: `loadJourney(store)` and `StoryPage` with `image={ogPath('/running/story/')}`. `<title>` is "<title> · Running · Alexander Webber" from the approved `title`; canonical URL as every page (FR-075, research.md R15)
- [X] T045 [P] [US3] Create `src/sections/running/og/story.png.ts` with `ogEndpoint`, serving `/og/running-story.png`: the approved `share_text` as the headline and the site name as the footer, in `RUNNING_OG_COLOURS`, with no figure, photo or Garmin attribution; image alt text = `share_text` (FR-075, SC-012). Look at a rendered PNG of a made-up `share_text` before trusting the layout (AGENT_TIPS *Share images*)
- [X] T046 [US3] In `src/sections/running/components/SectionLinks.astro`, skip an area whose `href` equals `story_link.href` (from `sectionSettings()`), so "Story" isn't listed directly under the story panel (owner decision 4); with no `story_link`, "Story" is listed, so the landing page always has a way in (data-model.md §9). Update its and `src/sections/running/components/StoryLink.astro`'s header comments (the story page now exists in code; `StoryLink` itself is unchanged, FR-040)

### Tests for User Story 3 (straight after the code)

- [X] T047 [P] [US3] Unit tests: `journeyChapterIds` (no folder, an empty chapter folder, a folder with `chapter.yaml`, closing and note alone) in `tests/unit/journey-validate.test.ts`; in `tests/unit/landing.test.ts`, `SectionLinks` with a made-up story area, with and without a matching `story_link`, comparing with `runningAreas` itself rather than a pinned list (as 002's T075); in `tests/unit/og.test.ts`, `ogPath('/running/story/')` is `/og/running-story.png` and the endpoint's text has no digit
- [X] T048 [US3] Create `tests/e2e/story-none.spec.ts`, the SC-002 drill (quickstart.md §4), building once in the desktop project through `tests/helpers/scratch-site.ts`, as `tests/e2e/fundraising-none.spec.ts` does: a deploy build of a copy of the real data with **every chapter folder removed** and **`story_link` removed from the copy's `section.yaml`** (so it still holds after Phase 7), and an approved `note.yaml`, `page.yaml` and `closing.yaml` in place: the real ones once they exist, else made-up ones written with approval blocks from `journeySha256`, so "nothing alone creates the page" is tested before launch too. Expected: no `dist/running/story/`, no `/og/running-story.png`, no "Story" in any page's `<nav>`, no `[data-story-link]` panel, no `/running/story/` in the sitemap, `/running/story/` answers with the 404 page, `validateData(copyRoot)` passes with exactly one issue, the closing section's warning (a page or note with no chapter is ignored with no message, data-model.md §7–§8). Set a build timeout of at least 240 s. Test for elements, not strings, because class names appear in inlined CSS
- [X] T049 [US3] Create `tests/e2e/story-launch.spec.ts`, the SC-006 drill (quickstart.md §5, and §2 step 1), building in the desktop project: a copy of the real data (its real fundraising card included) plus one made-up approved chapter (with a link to `/running/fundraising/`), note, page wording and a `story_link` with a made-up label equal to that page wording's `link_label` (the made-up note, page wording and `story_link` replace any real ones in the copy, so the drill holds after Phase 7). Assert: the chapter renders exactly as written (T034's helper); "Story" is last in the menu on every Running page and carries `aria-current` on the story page (US3.2, US3.5); on `/running/` at 360 x 780 with the fundraising card, Donate is fully within the first screen and the menu has no third line (**if either fails, stop and raise it with the owner**, research.md R8); no Running page scrolls sideways at 320 px; the panel shows the label and "Story" isn't repeated in the section links (US3.2); the sitemap lists `/running/story/`; `/og/running-story.png` exists; `validateData(copyRoot)` reports no error and `checkLinks(join(copyRoot, 'dist'))` passes; then, with the chapter's link changed to a made-up site path that doesn't exist **and the chapter re-approved in the copy** (`approveStory` journey mode, so the failure comes from the link check, not the hash), a rebuild passes and `checkLinks` fails naming `chapter "<id>"` (FR-015, run for real); and, with every chapter removed, `validateData(copyRoot)` reports an error on `data/running/owner/section.yaml` `story_link.href`, and a plain build of the copy followed by `checkLinks` fails on the dead panel link (US3.4, US4.6). The build-time step (`astro:build:start`) runs only the schema and loader checks, so the `validate.ts` rules are asserted through `validateData` (contracts/content-files.md *Validation*). Set a timeout of at least 240 s per build
- [X] T050 [US3] Make the existing tests hold once the story exists in Phase 7: (a) in `tests/e2e/stale.spec.ts`, the `builtPages()` test "SC-003: every Running page is built with its last-updated time and the stale notice" (and its sibling over `builtPages()`) skips `/running/story/`, which shows no freshness (FR-071), and `pageTypes()` doesn't gain it; (b) in `tests/unit/landing.test.ts`, the test "adds the Fundraising area, after Health, exactly when a campaign has figures" asserts Fundraising directly follows Health, and Story, when present, is last, instead of `runningAreas.at(-1)` being Fundraising; (c) `tests/e2e/fundraising-none.spec.ts` removes `data/running/owner/journey/chapters/` from its copy and (d) `story_link` from the copy's `section.yaml`, so its no-fundraising build doesn't depend on the story. Check `tests/e2e/landing.spec.ts`, `tests/a11y/*.spec.ts` and the nightly Quality workflow for any other every-page or every-nav-item assumption, and record what was found in the PR

### Ship the slice

- [X] T051 Run the PR routine's suites and both drills, and compare `dist/` against `main` (expected byte-identical: no chapter exists, so there's no area, and `SectionLinks`' output is unchanged)
- [ ] T052 [US3] (owner, guided by the agent) Raise the PR by the PR routine, with the launch drill's screenshots. The owner looks at them in the PR review. Nothing is visible on the live site

**Checkpoint**: everything a visitor needs to find the story is built and proven on a copy of the real
site, and nothing shows until a chapter exists.

---

## Phase 4: User Story 4 - The story keeps growing (Priority: P2)

**Goal**: The chapter list at four or more chapters, "Back to chapters" after each chapter, and proof
that adding a chapter touches nothing else.

**Independent Test**: In `four-chapters` and `long`, a closed "Chapters" line sits under the title, any
chapter is reachable in 2 taps with scripts off, and "Back to chapters" returns to the list; in
`three-chapters` there's no list. In the launch copy, a new approved chapter dated earlier appears in
its place, and every other chapter's file, hash and anchor stay the same.

**Goes live**: nothing.

**How to view it**: screenshots of `four-chapters` with the list closed and open, at 360 px and on a
desktop, in the PR.

**Needs the owner**: a look at the screenshots in the PR.

### Implementation for User Story 4

- [X] T053 [US4] In `src/sections/running/data/journey.ts`, add `showChapterList`, true at four or more chapters (a named constant, 4, FR-052)
- [X] T054 [US4] Create `src/sections/running/components/ChapterList.astro`: `<details class="story-chapters">`, closed by default, with `<summary>Chapters</summary>` and a `<ul id="story-chapter-list">` of links to `#<id>` by chapter name, no numbers (a `<ul>`, not an `<ol>`, FR-003); render it in `src/sections/running/components/StoryPage.astro` between the `<h1>` and the first chapter, only when `showChapterList` (owner decision 3, research.md R7). Styles in `src/sections/running/styles/story.css`
- [X] T055 [US4] In `src/sections/running/components/StoryChapter.astro`, add `<p class="story-back"><a href="#story-chapter-list">Back to chapters</a></p>` after the takeaway, only when the list shows (FR-052)
- [X] T056 [US4] Add the `four-chapters` state to `tests/fixtures/story-preview/generate.ts` and regenerate; `long` gains the list by itself

### Tests for User Story 4 (straight after the code)

- [X] T057 [P] [US4] Extend `tests/unit/story-page.test.ts`: no list or back links at three chapters, both at four; the list is a closed `<details>` with a `<ul>` in chapter order; each link's target exists
- [X] T058 [US4] Extend `tests/e2e/story.spec.ts` for `four-chapters` and `long` at 360 x 780 and on desktop: the list closed by default, and the first chapter's name and opening lines still on the first screen (FR-052, SC-001); with JavaScript off, open the list and reach any chapter in 2 taps (SC-010); "Back to chapters" lands on the list or its summary; `three-chapters` and `one-chapter` have neither
- [X] T059 [US4] Prove growth (quickstart.md §6, SC-008, US4.1–US4.3, US4.5) in `tests/e2e/story-launch.spec.ts`: in the launch copy, record every journey file's bytes and hash, add a second made-up chapter dated earlier than the first and approve it, build: it appears before the first; every other file is byte-identical (the copy isn't a git repo, so compare the recorded bytes rather than `git diff --stat`); the first chapter's `#<id>` still works. Timeout of at least 240 s per build. In `tests/unit/journey-validate.test.ts`: correcting one chapter's name leaves its `id` and anchor, needs only its own re-approval, and leaves every other chapter's hash unchanged (FR-038, FR-051)
- [X] T060 [P] [US4] Extend `tests/a11y/story.spec.ts` to `four-chapters` and `long` with the list closed and open, in light, dark and forced colours, and a keyboard path through the summary to a chapter and back

### Ship the slice

- [ ] T061 [US4] (owner, guided by the agent) Run the PR routine's suites, compare `dist/` against `main` (expected byte-identical) and raise the PR by the PR routine, with screenshots of `four-chapters` with the list closed and open. The owner looks at them in the PR review

**Checkpoint**: the page holds any number of chapters, and adding one edits only its own folder.

---

## Phase 5: User Story 5 - Photos in a chapter (Priority: P3)

**Goal**: Up to three photos in a chapter, stripped of metadata before they enter the repository,
each with alt text and a visible caption, served at sizes for the screen. The story launches with
none (plan.md: this slice can come after launch; it's here so graduation covers it).

**Independent Test**: In the `photos` preview, photos appear in their chapter with captions and alt
text and no published file carries metadata; a photo with location data, or with no caption, stops the
update naming the chapter and photo; a story with no photos looks complete.

**Goes live**: nothing. `scripts/add-race-photo.ts` behaves exactly as before.

**How to view it**: screenshots of `photos` and `long` at 360 px and on a desktop, in the PR.

**Needs the owner**: a look at the screenshots in the PR.

### Implementation for User Story 5

- [ ] T062 [US5] Move the strip, rotate and resize steps and the re-check out of `scripts/add-race-photo.ts` into `scripts/lib/photo.ts`, which both scripts use (research.md R10). Pass sharp the file's bytes (`readFileSync`), not a path, as `scan-images` does (AGENT_TIPS: a path stays open in sharp's cache on Windows). `add-race-photo.ts`'s behaviour and command line don't change: `tests/unit/add-race-photo.test.ts` passes without edits
- [ ] T063 [US5] Create `scripts/add-chapter-photo.ts` and its npm script `add-chapter-photo`: `node scripts/add-chapter-photo.ts --chapter=<id> --source=<path outside the repo> --description=<alt text> --caption=<caption> [--name=<file>]`. It refuses a missing chapter, a missing `--description` or `--caption` (FR-063), a fourth photo (FR-060) and a source inside the repository (the original, with its metadata, must never be committed); strips all metadata, applies the orientation and caps the long edge at 2,400 px through `scripts/lib/photo.ts`; writes into `data/running/owner/journey/chapters/<id>/`; appends the entry to `chapter.yaml` (`parseDocument`, `lineWidth: 0`, comments kept); and prints one line naming the file and that the chapter now needs a fresh approval (its hash covers the photo, FR-033), never the caption or alt text. Its header comment says who may appear is the owner's call at approval (FR-062, owner decision 9)
- [ ] T064 [P] [US5] In `src/sections/running/data/photos.ts`, add the glob `/data/running/owner/journey/chapters/*/*.{jpg,webp,avif}` and `chapterPhotos(chapter, files, folder)` beside `galleryPhotos()`, returning each listed photo's image, `description` and `caption`
- [ ] T065 [US5] In `src/sections/running/components/StoryChapter.astro`, at the reserved place after the prose and before the video place and the takeaway: one `<figure>` per photo with `Picture` (AVIF, WebP and a JPEG fallback at 640 and 1280 px, `loading="lazy"`, width and height set), `alt` = `description` and a visible `<figcaption>` = `caption`. No photos: no wrapper, heading or gap (FR-060, FR-063, FR-064). Styles in `src/sections/running/styles/story.css`
- [ ] T066 [US5] Add the `photos` state to `tests/fixtures/story-preview/generate.ts` (three photos in one chapter, one in another, none in a third), and photos in several chapters of `long` (SC-009), as generated gradient images with made-up captions and alt text, written through `scripts/lib/photo.ts` so they carry no metadata, as `tests/fixtures/race-preview/generate.ts` does. Never a photo of the owner (spec assumption *Fixture wording*)

### Tests for User Story 5 (straight after the code)

- [ ] T067 [P] [US5] Create `tests/unit/add-chapter-photo.test.ts` through `tests/helpers/temp-repo.ts`: a generated image with planted GPS and device EXIF comes out with none (read back with sharp: no `exif`, `xmp` or `iptc`); the long edge capped; the entry appended with comments kept; a missing caption or description, a fourth photo, an unknown chapter and a source inside the repo each refuse without writing; the output quotes no caption or alt text; the chapter's hash no longer matches until re-approved
- [ ] T068 [P] [US5] Extend `tests/unit/story-page.test.ts` (photos render with alt and caption after the prose and before the takeaway; none renders nothing) and the existing `scanImageFiles` tests in `tests/unit/scan-privacy.test.ts` (a planted photo with GPS EXIF under `data/running/owner/journey/chapters/<id>/` fails `scan-images`, naming the file, SC-007)
- [ ] T069 [US5] Extend `tests/e2e/story.spec.ts` and `tests/a11y/story.spec.ts` to `photos` and `long`: captions visible, alt text present, no layout shift (width and height set), a photo whose request is aborted keeps its alt text and caption and the chapter still reads, every built photo file under `dist/_astro/` from the story carries no metadata; zero axe violations in light, dark and forced colours

### Ship the slice

- [ ] T070 [US5] (owner, guided by the agent) Run the PR routine's suites (including `npm run scan-images`), compare `dist/` against `main` (expected byte-identical; `add-race-photo.ts`'s refactor changes no output), and raise the PR by the PR routine with screenshots of `photos`. The owner looks at them in the PR review

**Checkpoint**: every state in contracts/routes.md is built and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns (delivery slice 6: graduation)

**Purpose**: Prove the feature against its hardest success criteria, then the adversarial review and
the design note.

**Goes live**: nothing.

**How to view it**: the PR gives the Lighthouse and axe results and the review's findings.

**Needs the owner**: no.

- [ ] T071 Add `{ type: 'story', path: () => '/running/story/' }` to `PAGE_TYPES` in `scripts/lighthouse-budget.mjs` (skipped until the page exists, so the nightly Quality run checks the real page from launch). Run Lighthouse (mobile) on `/story-preview/long/` in a `SHELL_PREVIEW=1` build, with the script's settings, by hand, and `node scripts/lighthouse-budget.mjs` on a deploy build for the landing page (quickstart.md §7). Expected: the `long` preview at 90 or more with photos, no script files, page weight within 150 KB gzip, no third-party requests; the landing page at 90 or more and LCP within 2.5 s (FR-073, SC-009). Read the next nightly Quality run after the merge too
- [ ] T072 [P] Check the last quality bars across every preview state: zero axe violations in light and dark (SC-009); usable in forced colours; no sideways scroll at 320 px; keyboard reaches every link, the chapter list and the back links; all content with JavaScript off; `git diff origin/main --stat -- src/shared` is empty and `npm run check-boundaries` passes (FR-070)
- [ ] T073 Run the graduation self-review (constitution *Review at graduation*; plan.md *Graduation plan*) as an adversarial pass over the whole feature, recording findings with evidence in the PR, and fix what it finds: can any build path (store, `validate-data`, a plain `astro build`, a preview) render text that isn't approved or has changed; can any message, warning or log line from `validate-data`, the build, `approve-story`, `add-chapter-photo`, `check-links` or `scan-privacy` quote story text (FR-035); can HTML or an external link reach the page; can a figure appear without its source, or a Garmin-sourced one with the wrong one; can the page exist without the note or page wording; can a dead chapter link or `story_link` deploy; can anything show before a chapter exists, or remain after the last one goes; can a photo's original or its metadata reach git; does adding a field outside the hashed list (a future `video`) leave approvals intact (SC-013); does the share image carry a figure
- [ ] T074 [P] Add a *Journey story* section to `src/sections/running/README.md`, the graduation design note, with no story wording: the files and what each holds, the inline markup, how approval works and is recorded (`approve-story --journey` only after the owner's explicit yes), adding, correcting and removing a chapter, photos (`add-chapter-photo.ts`, FR-062 at approval), the reserved video place and what adding a video touches (SC-013), what holds back launch, the previews, the drills and the graduation figures. Note that drafts and raw answers stay outside the repository (FR-036), and that a chapter's links are checked on every deploy: before a page it links to goes away, the chapter is edited and re-approved first. Add the same sentence to the README's *Fundraising* section, under removing a campaign: a chapter linking to `/running/fundraising/` must be edited and re-approved before the last campaign with figures is removed, or `check-links` fails every deploy, the bot's included
- [ ] T075 Run every scenario in `specs/003-journey-story/quickstart.md` that can run on made-up text (§1–§7), and add a *Result* line to each, noting and fixing any text that differs from what was run
- [ ] T076 Raise the PR by the PR routine. After the merge, write Phase 7 into `PROJECT_MEMORY.md`'s *Next session*: the content PR is a session with the owner (T078–T088); the approved text's location outside the repository; that the committed text is compared with the approved text, not with the private hashes (`PROJECT_MEMORY.md` records why); and the standing follow-ups' triggers (T089–T092)
- [ ] T077 After the merge, offer `/speckit-house-process-harvest-lessons` in the main conversation (it needs the owner's picks), sending the *Upstream candidates* gathered since software-factory#13

**Checkpoint**: the feature has graduated on made-up text. Only the real content remains.

---

## Phase 7: The content PR (delivery slice 7: launch, with the owner)

**Purpose**: The real story goes live: the note and page wording approved, the approved chapters and
closing section written into their files exactly as approved, `story_link` set, `VOICE.md` created.

**Privacy**: the approved text and the owner's answers stay where they are, outside the repository
(their location is in `PROJECT_MEMORY.md`'s *Next session*). Read the privacy rules recorded with the
answers before touching the text. Only approved text enters the repository; the PR body and commit
messages describe the content by shape only (FR-036).

**Goes live**: `/running/story/`, "Story" last in the Running menu, the story panel on `/running/`
with the approved label, `/og/running-story.png` and the sitemap entry.

**How to view it**: https://alexanderwebber.com/running/story/ on a phone and a desktop: the title,
the closed "Chapters" line (nine chapters), each chapter with its date, prose, any figure with its
source, and the "What I learned" box; the closing section; the note. Then https://alexanderwebber.com/running/
on a phone: "Story" last in the menu, Donate still on the first screen, and the story panel below this
week and the latest run. Share the story link in a messaging app to see the preview. **Not built**:
photos (none yet), videos.

**Needs the owner**: **yes**: one session to approve the note and page wording and look at the rendered
chapters (plan.md *Owner steps*), then a guided review after launch.

- [ ] T078 [US2] (owner, guided by the agent) Draft the "not medical advice" note (FR-008) and the page wording (FR-039: `title` at most 70 characters, `description` at most 160, `share_text` at most 90 with no digits, `link_label`) from the approved text, in the owner's voice, outside the repository. The owner edits and explicitly approves each (owner decision 5; plan.md open questions 5 and 6). Record the owner's edits for `VOICE.md` (T083)
- [ ] T079 [US2] Write the files under `data/running/owner/journey/` from the approved text only: `chapters/<id>/chapter.yaml` per chapter (the `id` a slug from its approved name, permanent from now on, FR-051), `closing.yaml`, `note.yaml`, `page.yaml`. Mark each figure with a `{{figure-id}}` placeholder and a `figures` entry (category, label, `as_of`, the exact approved `text`, `source`, `ref` for stored figures, `garmin` where Garmin-sourced), and the one link as `[text](/running/fundraising/)`. Numbers in the prose that aren't measurements of the owner (a target or aspiration, a product's limit, a fixed expression kept in the owner's words) stay as prose, with no placeholder (data-model.md §3, confirm box 2). Check, statement by statement, that every figure traces to the owner's answers or a stored record, and that every figure dated before the stored data is `source: owner` (SC-004, FR-012). For each weight in the prose, ask the owner whether it came from the scale; if so it carries `garmin: Index S2`. These files carry no `approved` block yet, so the loader refuses them in the repo: nothing is built from the repo until T082, and `ref` and `garmin` are checked in T080's copy. Normalise line endings first (`core.autocrlf`)
- [ ] T080 [US2] SC-005 comparison, through a scratch copy, because the repo's files can't build until they're approved (research.md R4): `copySite` into the session's scratchpad (outside the repository), run `approveStory` journey mode in the copy for each file, with `--date=2026-11-04` for the chapters and the closing section (the words the owner approved that day) and T078's date for the note and the page wording, set the copy's `story_link`, then `validateData(copyRoot)` (every `ref` and `garmin` checked) and a deploy build of the copy. T034's `tests/helpers/story-text.ts`, from a scratchpad script, writes each chapter's, the closing section's and the note's plain text to the scratchpad, and a diff against the approved text finds **zero differences** in the words, the Garmin sources and set-apart layout aside. Any difference is fixed in the repo's file and the copy rebuilt, or becomes a change the owner approves afresh. Compare with the approved text itself, not with the private hashes, which can't be reproduced (`PROJECT_MEMORY.md`)
- [ ] T081 [US2] (owner, guided by the agent) In the same session as T078, the owner looks at the rendered real chapters on a local preview of T080's copy (`astro preview` of its deploy build, run in the copy), on a phone width and a desktop: each figure's source, the set-apart figure, the chapter list. They say yes, or ask for a change, which they then approve afresh with that day's date, and T080 runs again for that file (plan.md open question 6, research.md R4)
- [ ] T082 [US2] Straight after the owner's explicit yes, run `node scripts/approve-story.ts --journey=<target>` in the repo for each file, with the same dates as T080's copy: `--date=2026-11-04` for each chapter and the closing section that reached the files unchanged, T078's date for the note and the page wording, that day's date for any chapter changed in T081. Remove the scratch copy. Then set `data/running/owner/section.yaml` `story_link: { href: /running/story/, label: <the approved link_label> }` [US3] (FR-040, FR-042)
- [ ] T083 [US2] Create `VOICE.md` at the repository root from the owner's edits during this story's approval and T078's: style lessons only (phrasing, tone, structure, what the owner changed and why, in general terms), no private facts, no quotes from drafts, no names (FR-037, research.md R14). If the Martlets story (002 T114, T115) was approved first and created it, extend it instead. Read it in full and search it for personal terms before committing
- [ ] T084 Run the full gate of quickstart.md §7 on the real files locally (`validate-data`, `scan-images`, `check-boundaries`, `build`, `check-links`, `scan-privacy`). If a privacy rule trips on approved wording, stop: the owner rewords it under a fresh approval, or the rule gains a stated exception in its own commit (spec edge case). Run `npm test` (Vitest) on the real data, because `data/` isn't in CI's Vitest path filter and `tests/unit/landing.test.ts` reads the real route registry. Run the e2e suites and both drills on the real data (`story-none` and `story-launch` remove real chapters and `story_link` themselves), Lighthouse on `/running/story/` and `/running/` (FR-073), and axe on the real page in light and dark
- [ ] T085 Before the PR (quickstart.md §8 step 7): read every new and changed file in full; search the repository, the branch's diff and its commit messages for the raw answers and drafts (none may be found, SC-005); write the PR body by shape only (counts, lengths, which files). Update `README.md`: the pages table gains a Story row with a structural description, and *Next* drops the story
- [ ] T086 Raise the PR by the PR routine, with the phase header's *How to view it*. Checkbox questions: anything still open from T081, and confirmation that the text may go public (it stays in git history even if later removed; spec edge case)
- [ ] T087 [US3] After the merge, wait for `main`'s Gate run to finish, deploy included, then the live checks (quickstart.md §8 step 8): `/running/story/` answers 200 with every chapter, the closing section and the note; "Story" last in the menu on every Running page and current on its page; the landing panel with the approved label, and "Story" not repeated below it; `/og/running-story.png` loads with no digit; the sitemap lists the page; Donate fully on a 360 x 780 first screen; no sideways scroll at 320 px. Update `PROJECT_MEMORY.md` (decisions log, *Next session*: the next session starts with a guided review of the live page and a question round)
- [ ] T088 [US1] (owner, guided by the agent) At the next session start, a short guided review of the live page on a phone and a desktop, light and dark, and a question round on what the owner saw (the *Show me the real thing* norm). Fix anything raised in a small PR by the PR routine, with any text change approved afresh

**Checkpoint**: the story is live, exactly as approved, and findable from the landing page and menu.

---

## Standing follow-ups (triggered by an event or a date; nothing above depends on them)

**Purpose**: Each has a trigger. The agent checks them at session start from `PROJECT_MEMORY.md`'s
*Next session* block (written by T076), and raises each at a review the owner is already doing, never
as a chore.

- [ ] T089 (owner, guided by the agent) SC-011, folded into a review after launch: offer the reader test once, with an exact script (at least 5 readers who don't think of themselves as runners, each on a phone; at least 4 describe the page as a story, not statistics, and name one thing that worked for the owner). Record the result, or the owner's choice to skip it as with earlier usability checks, in `PROJECT_MEMORY.md`
- [ ] T090 [US4] At the first review after Brighton (from 5 April 2027), and after later milestones, raise a possible new chapter. If the owner wants one: the interview and draft outside the repository, the owner's edits and approval, then quickstart.md §8 for that chapter alone (its own folder, `approve-story --journey=<id>`, the SC-005 comparison, a PR by the PR routine, `VOICE.md` extended). Ask whether the closing section still holds (spec edge case)
- [ ] T091 [US5] If the owner wants photos in a chapter: they choose each one; the agent checks it against FR-062 with them (no other people outside a race; in a race photo, strangers only if none is recognisable; nothing showing where they live or regularly run), runs `npm run add-chapter-photo` from the original outside the repository, and the owner approves the chapter afresh (FR-033) before a PR by the PR routine
- [ ] T092 When the Martlets story's reviewers reply (002 T113–T115), `VOICE.md` is extended from those edits if this story created it first, or this story extends it (FR-037). Keep the note in `PROJECT_MEMORY.md`'s *Next session* until both stories have contributed

---

## Traceability

Every requirement, contract and quickstart scenario, by task.

| Requirement | Tasks |
|---|---|
| FR-001, FR-042 | T010, T025, T042, T043, T048, T049, T082 |
| FR-002, FR-003 | T002, T009, T024, T030, T032, T036, T037 |
| FR-004 | T027, T030, T037, T038 |
| FR-005 | T009, T032, T036, T037 |
| FR-006 | T079 (content rule, at approval) |
| FR-007, FR-008 | T009, T031, T032, T036, T078 |
| FR-009 | T033, T037, T058 |
| FR-010, FR-011 | T002, T009, T028, T029, T036 |
| FR-012, FR-013 | T002, T004, T009, T016, T079 |
| FR-014 | T009, T024, T028, T029, T081 |
| FR-015 | T008, T009, T012, T018, T049, T074 |
| FR-020, FR-021 | T079, T081, T091 (at approval) |
| FR-022 | T013, T019, T084 |
| FR-030, FR-031 | T078–T081, T090 |
| FR-032 to FR-035, FR-038 | T007, T011, T016, T017, T022, T039, T059, T073, T082 |
| FR-036 | Privacy note, PR routine step 5, T085 |
| FR-037 | T083, T092 |
| FR-039 | T003, T010, T078 |
| FR-040, FR-041 | T043, T046, T049, T082, T087 |
| FR-043 | T049, T087 |
| FR-050, FR-051, FR-054 | T009, T049, T059 |
| FR-052 | T053–T058 |
| FR-053 | T002, T007, T030, T073 |
| FR-060 to FR-064 | T002, T062–T069, T091 |
| FR-070 | T072 |
| FR-071, FR-072 | T026, T027, T032, T037, T050 |
| FR-073 | T071, T084 |
| FR-074 | T038, T060, T069, T072 |
| FR-075 | T003, T044, T045 |
| FR-076 | T009, T010, T016 |
| FR-077 | T002, T024, T079 |
| FR-078 | T033, T056, T066 (rendering states); T016, T048 (refused cases, no chapters) |
| SC-001 | T037, T058 |
| SC-002 | T048 |
| SC-003 | T016, T022, T039 |
| SC-004 | T079 |
| SC-005 | T080, T085 |
| SC-006 | T049, T087 |
| SC-007 | T067, T068 |
| SC-008 | T059 |
| SC-009 | T066, T071, T072 |
| SC-010 | T058 |
| SC-011 | T089 |
| SC-012 | T045, T087 |
| SC-013 | T030, T073, T074 |

| Contract or guide | Tasks |
|---|---|
| contracts/content-files.md: who writes what | T011, T063, T079, T082, T083 |
| contracts/content-files.md: approve script | T011, T017 |
| contracts/content-files.md: validation, messages, sentinel | T007, T009, T010, T016 |
| contracts/routes.md: page, chapter parts, layout | T026–T032, T036–T039 |
| contracts/routes.md: route registry, landing, share image | T042–T047 |
| contracts/routes.md: states and previews | T033, T056, T066 |
| contracts/gate.md: `check-links` | T012, T018, T049 |
| contracts/gate.md: redacted findings | T013, T019 |
| quickstart.md §1–§2 | T014–T020, T022, T049 |
| quickstart.md §3 | T037–T039, T058, T060, T069 |
| quickstart.md §4–§6 | T048, T049, T059 |
| quickstart.md §7 | T022, T071, T084 |
| quickstart.md §8–§9 | T078–T088, T089, T090 |

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Foundational)**: none. BLOCKS every other phase.
- **Phase 2 (US1, US2)**: depends on Phase 1 (schemas, store, hash, `parseProse`).
- **Phase 3 (US3)**: depends on Phase 2 (`StoryPage`, `loadJourney`).
- **Phase 4 (US4)**: depends on Phase 2; its growth drill extends Phase 3's launch drill (T049).
- **Phase 5 (US5)**: depends on Phase 2. Independent of Phases 3–4, and may follow launch (plan.md).
- **Phase 6 (Polish)**: depends on Phases 2–5.
- **Phase 7 (launch)**: depends on Phases 1–4 and 6 at least (the real story has nine chapters, so
  the chapter list is needed; it has no photos, so Phase 5 isn't strictly needed). It needs the owner.
- **Standing follow-ups**: after Phase 7. No task above depends on them.

### User story dependencies

- **US1, US2 (P1)**: after Phase 1. Together they are the page; US2's refusals live in Phase 1.
- **US3 (P2)**: after US1's page.
- **US4 (P2)**: after US1's page and US3's launch drill.
- **US5 (P3)**: after US1's chapter component.

### Within each phase

- Code first, then its tests (TDD isn't required).
- T006 (registration and the store fakes) comes before any task that writes or loads a journey file.
- T007 (the hash) before T011 (approve script), T016 (refused cases) and T033 (previews).
- T008 (`parseProse`) before T009 (validation) and T028 (`StoryProse`).
- T042 before T043.

### Parallel opportunities

- **Phase 1**: T002, T003, T004 and T005 together; T008, T012 and T013 alongside T006–T007; T014,
  T015 and T017–T020 together once the code exists; T021 any time.
- **Phase 2**: T026, T027, T029, T031 and T034 together; T035, T036 and T038 together after the code.
- **Phase 3**: T044 and T045 together after T043; T047 beside the drills.
- **Phase 4**: T057 and T060 together.
- **Phase 5**: T064 beside T062–T063; T067 and T068 together.
- **Phase 6**: T072 and T074 alongside T071.
- **Across phases**: Phase 5 can run beside Phases 3–4 (different files, except `StoryChapter.astro`
  and `generate.ts`, so merge one before starting the other's edits there).

---

## Parallel Example: Phase 1

```text
# Schemas and fixtures together:
Task: "Create schemas/owner/journey-chapter.schema.json"
Task: "Create schemas/owner/journey-page.schema.json, journey-note.schema.json, journey-closing.schema.json"
Task: "Add fixtures under schemas/fixtures/owner/journey-*/"

# Tests together, once the code exists:
Task: "Schema contract tests in tests/contract/journey-schemas.test.ts"
Task: "parseProse tests in tests/unit/journey.test.ts"
Task: "Journey mode tests in tests/unit/approve-story.test.ts"
Task: "Link check tests in tests/unit/check-links.test.ts"
Task: "Redaction tests in tests/unit/scan-privacy.test.ts"
```

## Parallel Example: User Stories 1 and 2

```text
# Independent pieces together:
Task: "lastUpdated prop in src/sections/running/components/SectionLayout.astro"
Task: "Styles in src/sections/running/styles/story.css"
Task: "Set-apart figure in src/sections/running/components/StoryFigure.astro"
Task: "Closing and note in src/sections/running/components/StoryClosing.astro and StoryNote.astro"
Task: "Plain-text helper in tests/helpers/story-text.ts"
```

---

## Implementation Strategy

### MVP first (User Stories 1 and 2)

1. Phase 1: files and checks; nothing visible.
2. Phase 2: the page on previews. **Stop and review the screenshots.** The page reads correctly and
   only approved words can reach it, but nobody can reach it yet.
3. Phase 3: the ways in, proven on a copy of the real site.

The story can't launch before Phase 4, because the real story's nine chapters need the chapter list.

### Incremental delivery

Each phase is one PR and one session, and each leaves the live site unchanged until Phase 7.

1. Foundation → approval and checks, invisible.
2. US1 + US2 → the page, in previews.
3. US3 → the area, menu, share image and drills.
4. US4 → the chapter list and growth.
5. US5 → photos (may follow launch).
6. Polish → Lighthouse, axe, the adversarial review, the design note.
7. Launch → the content PR with the owner, then the guided review.

---

## Notes

- Tasks marked [P] touch different files, with no dependency on an incomplete task.
- Every fixture, preview and test uses generated words and images. No real wording, chapter name,
  figure or photo enters the repository before Phase 7, and then only approved text.
- No message, log or scan output may quote story text; a sentinel test (T016) holds it.
- On a commit from PowerShell, avoid piping a here-string to `git commit -F -` (it adds a BOM). Write
  files containing backslashes with the Write tool, not a Bash heredoc.
