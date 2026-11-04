# Research: Journey Story

**Feature**: 003-journey-story | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

Every unknown in the plan's Technical Context is settled here. Each item gives the decision, the reason
and what else was weighed.

**What this document knows about the story.** Only its shape, as FR-036 allows: nine chapters plus the
closing section, about 1,800 words in all. Chapters run from 62 to 337 words (four under 170, two over
290). One chapter has a set-apart figure. Most chapters carry one or two figures within the prose,
several of them Garmin-sourced, and several chapters come before the stored data begins (October
2025), so their figures are the owner's. One chapter links to the fundraising page. There are no
photos yet. The owner approved all nine chapters and the closing section on 2026-11-04. The "not
medical advice" note and the page's own wording (title, description, share text, landing link label)
are drafted and approved during the build. Every example below is made up.

---

## R1. Garmin's brand guidelines, re-read

**Done 2026-11-04.** The PDF (`developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf`)
downloaded with `curl` from the local machine and was read in full. It is still **V 6.30.2025**, one
page, and matches what spec 001 built (Running README, *Garmin attribution*).

What matters for a figure inside a story:

- **Every use of Garmin device-sourced data carries "Garmin [device model]"**, or "Garmin" when the
  model isn't known. This covers summary views and detailed or historical views alike.
- **"Always be visually associated with the data it supports"**, and "never bury the Garmin attribution
  in tooltips, footnotes or expandable containers."
- **Multi-entry displays may attribute globally (a header) or per entry.**
- **Text is allowed**: "appropriately sized text: Garmin [device model]". No logo is needed.
- **Derived data** uses wording such as "Insights derived in part from Garmin device-sourced data".
- **Share images** showing Garmin data must carry it. The story's share image shows no figure
  (FR-075), so it needs none.

**Decision: per-figure attribution, as text, directly after the figure.** A figure in the prose reads
like `12.3 kg (Garmin Index S2)`, in the same size as the prose and the secondary text colour. A
set-apart figure carries it on its own line, as charts do with `ChartFigure`'s source line.

**Why:** the story page isn't a dashboard, and a header line would put Garmin at the top of a page that
must open on the story (FR-005, FR-014). The guidelines allow per-entry attribution, and forbid the
alternatives that would keep the prose cleaner: a footnote marker, a tooltip or a collapsed note.

| Option | Verdict | Why |
|---|---|---|
| Attribution in parentheses right after the figure | **Chosen** | Visually associated, visible, readable aloud, no footnote |
| A line under the page heading | Rejected | Leads the page with a data source (FR-005); FR-014 forbids it |
| Footnote marker, with sources at the chapter's end | Rejected | The guidelines name footnotes as burying the attribution |
| `title` tooltip | Rejected | Named in the guidelines; also invisible on phones |

---

## R2. Content file format

**Decision: YAML files under `data/running/owner/journey/`, one folder per chapter, with plain text
and a minimal inline markup for figures and links.** No Markdown, MDX or HTML.

- Paragraphs are separated by blank lines, as in the campaign story.
- A figure is a placeholder, `{{figure-id}}`, naming an entry in the chapter's `figures` list.
- A link is `[link text](/running/fundraising/)`, and only that form: the target must be a path on
  this site.
- Anything else that looks like markup (`{{` without a closing pair, `[` text `]` followed by `(`, or
  an HTML-like tag, `<` followed by a letter or `/`) stops the update, so the file can't hold
  half-written markup that renders as literal brackets. A plain `<` in a sentence is fine.

**Why:** the story needs exactly two inline things the campaign story didn't: figures with attribution
and site links. Both must be checked (FR-010, FR-014, FR-015), and a check needs to find them. A
placeholder makes every figure findable and lets the code add the attribution and enforce the limit.
Everything else stays as plain, escaped text, so no HTML can reach the page.

| Option | Verdict | Why |
|---|---|---|
| YAML with `{{id}}` and `[text](/path/)` | **Chosen** | Two forms, one small parser, every figure and link checkable; no dependency |
| Markdown through Astro's built-in remark | Rejected | Passes raw HTML and external links through unless sanitised; can't tell a figure from any other number; sits outside `RunningStore`, so the build's first-step validation (spec 001 FR-070) wouldn't see it |
| Astro content collections | Rejected | A second storage path beside `RunningStore` (Principle IV), and its errors quote content |
| Figures written as plain numbers in the prose | Rejected | Nothing could check attribution or the two-figure limit |
| One YAML file for the whole story | Rejected | Adding a chapter would edit a shared file, against FR-050 and SC-008, and one approval block per chapter gets awkward |

**Folder name `journey/`, not `story/`.** `owner/stories/` already holds the campaign stories, and
`story/` beside it would invite the wrong folder. The page's address and menu label stay "story".

---

## R3. Approval: spec 002's mechanism, generalised

**Decision: each file carries its own `approved` block (`date`, `sha256`), the hash is checked in the
loader, and `scripts/approve-story.ts` gains a journey mode.** This is spec 002's mechanism (research
R14 there), with two changes.

1. **The hash covers every approved field, not one text field.** FR-033 makes a chapter's approval
   cover its name, date, prose, takeaway, figures, captions and alternative text. So the hash is the
   sha256 of a canonical JSON of those fields: keys sorted, no whitespace, UTF-8, strings exactly as
   YAML parsed them (so line endings don't matter, as in 002). The block itself is left out.
2. **Photos are hashed by their bytes.** Each photo contributes the sha256 of its file, so swapping a
   file under the same name needs a fresh approval (FR-033).

**Where it's checked:** in `loadRunningData` (`data/store/files.ts`), beside the campaign story's check,
for the same reason found in 002's Phase 6: the loader is what the store, the gate's `validate-data`
and a plain `astro build` all go through, so changed text can't reach a page by any path (FR-034). A
mismatched or missing approval drops the file and records an error, so the build stops before `dist/`
is emptied (`astro:build:start`).

**What isn't hashed:** the `approved` block, and fields a later spec may add with their own approval,
such as a video (R11). The hash lists the fields it covers by name, rather than "everything but
`approved`", so adding a field later doesn't invalidate approved chapters.

**The campaign story keeps its hash** (`storySha256(text)`). Changing it would mean re-approving a
story that is still with its reviewers, for no gain.

**The script:** `node scripts/approve-story.ts --journey=<chapter-id|closing|note|page> [--date=]`. It
keeps 002's safeguards: it re-parses what it would write and refuses unless the content and hash
survive, writes with `lineWidth: 0`, never prints text, and never quotes a parser message. The
JustGiving reminder is printed only for campaign stories.

| Option | Verdict | Why |
|---|---|---|
| Hash of named fields plus photo bytes | **Chosen** | Covers FR-033 exactly; a future video field doesn't disturb it |
| Hash of the raw file bytes | Rejected | A comment or reformat would need re-approval; line endings on a `core.autocrlf` checkout would break it |
| One approval for the whole story | Rejected | FR-038: chapters are approved one at a time, and adding one mustn't touch the others |
| A date only | Rejected | Survives an edit (002 R14) |

---

## R4. What the approval date records

**Decision: the nine chapters and the closing section are recorded with the owner's approval date,
2026-11-04, if the words reach the files unchanged.** The build converts each approved text into the
file format (placeholders for figures, the one link), renders it, and compares the page's plain text
with the approved text outside the repository. Zero differences (SC-005) means the approval stands,
and the script records it with `--date=2026-11-04`. Because the loader refuses a file without an
`approved` block, the files can't be built in the repo before approval, so the comparison and the owner's
look at the rendered chapters use a scratch copy of the site, where the approval is recorded with the
same dates first; the repo's files are approved only after the owner's yes.

The rendered page adds two things the owner didn't see as words: the Garmin attribution after a figure
and the figure's set-apart layout. The owner looks at the rendered chapters in the same review that
approves the note and the page wording, before the content PR. If anything in the words has to change
there, that chapter's approval takes that day's date instead.

---

## R5. Figures

**Decision: figures are structured entries in the chapter, placed by a placeholder.**

- **Placement follows from where the placeholder sits.** Inside a sentence, the figure renders inline.
  Alone in its own paragraph, it renders as a set-apart figure. One mechanism serves both.
- **At most two figures per chapter, of either kind, by schema** (`maxItems: 2`). The spec enforces
  set-apart figures by check and inline ones at approval (FR-010). Because inline figures are marked
  up, the check can cover both, which is stricter and simpler. The real story fits it.
- **Each figure has:** an `id`, a `category` from the approved public list (FR-013), a `label` (what it
  measures), `as_of` (a date or month), `text` (the figure exactly as approved, such as `12.3 kg`), a
  `source` (`stored` or `owner`), and `garmin` when it's Garmin-sourced.
- **The figure's text is stored as written**, not rebuilt from a number. A formatter could turn an
  approved "12 kg" into "12.0 kg", and the page would then differ from the approval (SC-003). A
  per-category pattern checks metric units (FR-077).
- **Stored figures name their record** (`ref`: a run ID, or a health metric and date), so SC-004's
  tracing is in the file. Validation checks the record exists. The value is never re-read from it, so
  later data can't change the chapter (FR-011).
- **Owner figures** need no record. A `stored` figure dated before the stored data begins stops the
  update: before then, only the owner can supply a value (FR-012).
- **Garmin attribution is written in the file, and checked.** A stored figure from a Garmin-sourced
  record must carry it: a run's watch from the run, the scale for weight and body fat, plain "Garmin"
  for watch wellness, `derived` for fitness. An owner figure carries it when the owner says the value
  came from a Garmin device. Writing it in the file makes it part of the approval; checking it stops a
  missing one.
- **The page must open on prose**, so a chapter whose first paragraph is a set-apart figure stops the
  update (FR-003, FR-005). An inline figure in the first sentence is allowed: it's in the prose, not
  before it.
- **What and when, inline:** a set-apart figure shows its label and date. An inline figure shows its
  text only, so the sentence around it must say what and when (FR-011). That's checked at approval,
  statement by statement (SC-004), with `label` and `as_of` in the file for the check.

**Approved categories (FR-013, spec 001 FR-015):** `weight`, `body_fat`, `vo2_max`, `resting_hr`, `hrv`,
`training_status`, `race_prediction`, `fitness`, `race_time`, `best_effort`, `run_distance`, `run_pace`,
`training_total`, and `calories` (daily calories burned, a Garmin estimate, which the owner approved in
the interview on 2026-11-03; data-model.md §3). A new category is a schema change in a PR, which is
where the owner's explicit approval is recorded. Each category's text pattern and allowed `ref` kind are
tabled in data-model.md §3, as is the rule that numbers in the prose that aren't measurements of the
owner stay prose.

---

## R6. Chapter identity, order and dates

- **Identity and address (FR-051):** the chapter's `id` is its folder name and its anchor
  (`/running/story/#<id>`). It's set when the chapter is first written, from its name, and never
  changes, even when the name is corrected. Validation checks the `id` matches the folder.
- **When (FR-003, owner's #101 confirmation):** `when` is a day (`2001-03-15`), a month (`2001-03`) or a
  period (`2001-03/2001-09`, or months across years). Shown as "15 Mar 2001" (spec 001's date format),
  "March 2001", or "March to September 2001" / "March 2001 to February 2002", in a `<time>` element.
  Months are written in full because "Mar 2001" alone reads as a fragment.
- **Order (FR-002, edge case):** by the start of `when`, oldest first. Two chapters starting on the same
  day or month must each carry a distinct `order` number, or the update stops naming both, so the owner
  decides rather than a file name. The order is the same on every build.
- **Future dates:** the end of `when` (or its start, for a day or month) can't be after today in
  Europe/London, as with every owner-entered date.
- **The closing section** has no date and always comes after the latest chapter (FR-007).

---

## R7. The chapter list at four or more chapters

**Decision: a `<details>` disclosure at the top of the page, closed, labelled "Chapters"**, holding a
`<ul>` of chapter names linking to their anchors. After each chapter, a "Back to chapters" link targets
the list. Both only render at four or more chapters (FR-052).

- **First screen (FR-052, SC-001):** closed, it's one line, so even with 12 chapters the first chapter's
  name and opening lines stay on a 360 x 780 screen. An open list of 12 names would push it off.
- **Taps (SC-010):** open the list, tap a name: 2 taps, with scripts off.
- **The way back:** the link targets the `<ul>` inside the `<details>`. Current Chrome and Firefox open a
  closed `<details>` when a fragment link targets content inside it; elsewhere the reader lands on the
  "Chapters" summary, one tap from the list. Either way it works without scripts.
- **Unnumbered:** a `<ul>`, not an `<ol>`, because chapters aren't numbered (FR-003).

| Option | Verdict | Why |
|---|---|---|
| Closed `<details>` at the top | **Chosen** | One line on a phone, no JS, 2 taps |
| An always-open list | Rejected | 12 names push the first chapter off the first screen (SC-001) |
| A list at the end | Rejected | Fails "from the top of the page in at most 2 taps" (SC-010) |
| A sticky or scripted menu | Rejected | Needs JS (FR-052) and covers the text on a phone |

---

## R8. Hidden until the first chapter, and the ways in

- **The area exists only with a chapter (FR-001, FR-042, SC-002).** `integration.ts` gains a `story` area,
  added to `runningAreas` only when `journeyChapterIds()` finds a chapter folder with a `chapter.yaml`,
  as `campaignsWithFigures()` does for fundraising (002 research R13). Routes, sitemap entry, menu item
  and share image all follow from that one condition. A closing section or note alone adds nothing.
- **Approved means present.** A chapter that isn't approved stops the build, so "has a chapter file" and
  "has an approved chapter" agree on every build that can deploy.
- **The page needs its own wording before it can go live.** With a chapter but no `page.yaml` (title,
  description, share text, link label) or no `note.yaml`, the update stops. See R12.
- **Menu (FR-041):** "Story" is last, after "Fundraising", as the owner confirmed on #101. The shared
  `Nav` marks it current as for any area.
- **The landing link (FR-040):** spec 001's `StoryLink` and `story_link` setting, unchanged in place.
  Validation adds three rules:
  - `story_link.href` must be the story page, `/running/story/` (the setting's other forms predate this
    spec);
  - with no chapter, a `story_link` stops the update, naming `section.yaml` and `story_link.href`
    (FR-042, US3.4);
  - `story_link.label` must equal `page.yaml`'s `link_label`, so the label is covered by the approval
    hash (FR-039) without changing spec 001's setting.
- **Section links at the foot of the landing page (the spec left this to the plan):** "Story" is left out
  while the `StoryLink` panel shows, because the panel sits directly above them and the same link twice
  in a row adds nothing. `SectionLinks` skips an area whose `href` equals `story_link.href`. If the
  setting were ever absent while the page exists, "Story" would appear there instead, so the landing
  page always has a way in.
- **Donate on the first screen (FR-043, SC-006):** the landing link sits below this week and the latest
  run, far below the first screen. The menu item is the only change near the top. At 360 px the menu's
  second line holds "Fundraising" alone today, and "Story" fits beside it, so the menu gains no third
  line. That's an estimate from the widths, not a measurement: a scratch-site drill measures it (R18),
  and if a third line appears, the build stops for an owner decision rather than shipping.

---

## R9. Links in chapters, and a built-site link check

**Decision: two layers.**

1. **Validation** checks every link's form: a root-relative path with a trailing slash (or a `#` anchor
   on it), no scheme, no query. An external or malformed link stops the update (FR-015, owner's #101
   confirmation).
2. **A new gate step, `scripts/check-links.ts`, runs after the build** and checks that every internal
   `href` in the built HTML resolves to a built file. A chapter's links carry `data-chapter-link="<id>"`,
   so a dead one is reported as "chapter <id> links to <path>, which the build didn't make". The same
   check catches a `story_link` that leads nowhere.

**Why both:** whether a path will exist depends on the build (a run page, the fundraising page exists
only with figures), and only the built site knows for sure. The gate deploys only after every step
passes, so a dead link leaves the live site unchanged. The early form check gives the owner-facing
file/chapter/field message for the common mistakes.

**Shared tooling, justified (FR-070):** `check-links.ts` sits with the other gate scripts in `scripts/`,
not in `src/shared/`, and checks every page. Every section benefits, and no section's code changes.
It must pass on today's site before the story is added; any dead link it finds there is fixed first.

---

## R10. Photos

**Decision: reuse the race-photo pipeline.**

- **Adding:** a new `scripts/add-chapter-photo.ts` beside `scripts/add-race-photo.ts`. The strip,
  rotate and resize steps and the re-check move into `scripts/lib/photo.ts`, which both use, so the
  documented race command doesn't change. For a chapter the script requires `--caption` (FR-063),
  refuses a fourth photo (FR-060), and writes into the chapter's folder.
- **Checking:** `scan-images.ts` already covers everything under `data/running/owner/`, so chapter
  photos get the metadata and size checks with no change. The schema requires `description` (alt text)
  and `caption`, and `maxItems: 3`. The loader (`files.ts`) checks each listed file exists, because it
reads the bytes for the approval hash.
- **Serving (FR-064):** the gallery's `Picture` settings: AVIF, WebP and a JPEG fallback at 640 and 1280
  px, lazy-loaded, with width and height set. In a chapter the photos sit after the prose and before
  the takeaway, as a `<figure>` each with a visible `<figcaption>`.
- **Approval:** the photo's bytes are in the chapter's hash (R3), so adding or changing one needs a
  fresh approval (FR-033).
- **People (FR-062, amended in this plan's PR):** in a race photo, strangers in the crowd are fine if
  nobody is recognisable; outside races, no other people. A person must judge that, so it's an approval
  step, not a check.
- **Launch has none.** A chapter with no `photos` renders no frame, gap or heading (FR-060).

---

## R11. A place for video (FR-053, SC-013)

**Decision: reserve one place in the chapter's layout, and keep video out of the hash's field list.**

- `StoryChapter.astro` has one marked spot, after the photos and before the takeaway, where a future
  `ChapterVideo` component goes. Today it renders nothing.
- The chapter hash names its fields (R3), so a future `video` field with its own `approved` block
  leaves the chapter's text approval intact.
- **Adding a video later touches:** that chapter's `chapter.yaml` (one new field), the schema (one
  optional property), and that one spot in `StoryChapter.astro`. No other chapter, and no hosting
  decision, is made here.

---

## R12. The note and the page's wording: what holds back launch

- **The note blocks launch.** FR-008 says the page MUST show it, with no "once approved" exception,
  unlike the closing section (FR-007), and the owner confirmed on #101 that the note exists. A health
  story read by beginners shouldn't go live without it. So a chapter without `note.yaml` stops the
  update.
- **The page's wording blocks launch.** Without an approved title and description the page has nothing
  to put in its `<title>`, heading and share image, and FR-039 forbids inventing them. So a chapter
  without `page.yaml` stops the update.
- **The closing section doesn't.** FR-007 and the owner's #101 confirmation: expected at launch, but it
  can't hold back the first chapter. It's ready anyway.
- **Order of work:** the code ships first on made-up text, with nothing visible. The note and page
  wording are drafted in a session with the owner, outside the repository, alongside the review of the
  rendered chapters (R4). Then one content PR carries every approved file, `VOICE.md` and `story_link`.

---

## R13. Privacy scan and messages that quote nothing

- **The scan's findings must not quote story text (FR-035).** `scan-privacy` prints the matched key for
  most rules. In a story file or the story page, that match is a word of the story. So every finding in
  `data/running/owner/journey/`, `data/running/owner/stories/` and `dist/running/story/` is redacted,
  whatever the rule.
- **The rules still apply (FR-022).** A sentence such as "<n> steps" on a page would stop the update; the
  owner rewords it or the rule gains a stated exception (spec edge case). The content PR runs the full
  gate locally first (quickstart §8), so that's found before the PR.
- **Validation messages** name the file, the chapter ID, the field and, inside the prose, the paragraph
  number and figure ID. They never include a value from the text. A test plants a sentinel word in every
  field of a fixture and asserts that no message, from any refused case, contains it.
- **Chapter IDs** appear in messages, URLs and file names. They come from approved chapter names and are
  public with the page; no draft ever has a folder in the repository.

---

## R14. `VOICE.md`

**Decision: `VOICE.md` at the repository root, created in the content PR.**

- **Root, not inside Running:** the constitution names it as one living guide for all drafted text (the
  Martlets story, this story, and later the CV and blog), so it belongs to no section.
- **Contents:** style lessons only, from the owner's edits during this story's approval: phrasing,
  tone, structure and what the owner changed and why, in general terms. No private facts, no quotes
  from drafts, no names (FR-037).
- **Checked before it's committed:** the agent reads it in full and searches it for personal terms, as
  for the spec.
- **The Martlets story extends it** when its reviewers reply (002 T114, T115).

---

## R15. Share image and page metadata

- **Share image (FR-075, SC-012):** `/og/running-story.png` through the shared `ogEndpoint`, with the
  approved `share_text` and the site name only: no figure, no photo, so no Garmin attribution. The
  schema refuses digits in `share_text` (pattern `^[^0-9]+$`), so no figure can slip in, even a year.
- **Title and description:** from `page.yaml`. The `<h1>` is the approved title; `<title>` is
  "<title> · Running · Alexander Webber", as on other Running pages. Canonical URL as every page.
- **No "Last updated" (FR-071):** the story isn't a data view. `SectionLayout` gains a `lastUpdated`
  prop (default `true`). An empty named slot isn't used, because `Astro.slots.has` reports a conditional
  slot as filled even when it renders nothing (a lesson from 002 Phase 4).

---

## R16. Performance and accessibility

- **Budgets:** the repo's existing ones (`scripts/lighthouse-budget.mjs`): mobile performance ≥ 90,
  landing LCP ≤ 2.5 s, JS ≤ 10 KB gzip, page ≤ 150 KB gzip. The story page has **no client JS**: no
  freshness script and no chapter-list script. Text estimate: the real story is about 1,800 words
  (roughly 5 KB gzip of HTML). SC-009's 12 chapters of about 600 words is roughly 7,200 words, about
  15–20 KB gzip, far inside the budget. Photos are lazy-loaded, sized, and add no layout shift.
- **Reading width (FR-072):** paragraphs, takeaways and figures stop at about 66 characters (`66ch`), a
  comfortable measure under the spec's 75. A test checks the rendered width is at most 75 times the width
  of "0" in the paragraph's font, so it holds on any font.
- **Headings:** `<h1>` title, `<h2>` per chapter and for the closing section, `<h3>` "What I learned" in
  each takeaway. The takeaway is a bordered box with a heavier start edge, so it stands apart by shape
  and label, and the border survives forced colours (FR-004). No landmark per takeaway, so the
  landmark list stays short.
- **Styles:** the page's repeated markup is styled from a stylesheet under a class prefix, not scoped
  `<style>` blocks, to avoid Astro's per-element attribute (AGENT_TIPS *Astro*). Inline elements get
  explicit `{' '}` spaces where they meet, so "12.3 kg (Garmin Index S2)" can't render as one word.

---

## R17. Dependencies

**None added.** The inline markup parser is a few dozen lines with no library. Photos use `sharp` and
`astro:assets` as race photos do, the share image `satori` through `ogEndpoint`, YAML `yaml` 2.9.1 (still
the latest, checked 2026-11-04). TypeScript stays on its deliberate 6.0.3 pin. Astro 7.4.5 is out (we
have 7.4.4); it's a routine bump for the session-start update check, not something this feature needs.

---

## R18. Previews and tests on made-up text (FR-078)

- **Preview routes** under `SHELL_PREVIEW=1`: `/story-preview/<state>/`, each over its own synthetic data
  tree in `tests/fixtures/story-preview/<state>/` through `JsonFileStore` with the repo's schemas, as the
  fundraising previews do. States: `one-chapter`, `three-chapters`, `four-chapters` (the list appears),
  `long` (12 chapters of about 600 words, photos in several), `figures` (inline, set-apart, Garmin, derived,
  owner, none), `photos`, `no-closing`, `same-day` (two chapters ordered by `order`).
- **Text:** generated lorem-style text with a fixed seed, and generated images (made-up gradients, as the
  race preview's `generate.ts` does). Never real words or photos.
- **Refused cases** are Vitest cases over temporary data trees: no approval, one character changed, a
  photo swapped, a figure placeholder with no figure, a third figure, a lone figure first, an external
  link, a future date, a same-day tie with no `order`, a missing note or page wording, a `story_link`
  with no chapter, a link label that differs, a photo with no caption, a fourth photo, and a
  `stored` figure dated before the data. Each asserts the file, chapter and field, and the sentinel's
  absence.
- **Scratch-site drills** (`tests/helpers/scratch-site.ts`): `story-none` (SC-002: no page, menu item,
  landing link, sitemap entry or share image), and `story-launch` (SC-006: one made-up chapter, the note,
  page wording and `story_link` added to a copy of the real data, with the real fundraising card; Donate
  fully inside 360 x 780, no sideways scroll at 320 px on any Running page).
- **Playwright and axe** over the previews at 360 px and desktop, light and dark, forced colours for the
  takeaway, and with JavaScript off.

---

## R19. Existing code that needs care

- **Store fakes:** `OwnerData` gains `journey`. Hand-written fakes in `tests/unit/` build `OwnerData`, and
  `astro check` type-checks tests in the build, so each fake needs the field in the same task, or the
  gate turns red and blocks the refresh (002 analyze finding).
- **CSS chunking:** a new page that shares components can move Vite's shared CSS chunks on other pages.
  Compare `dist/`'s file list and computed styles against `main`, not just the HTML.
- **A `<style>` in a component imported but not rendered** can reorder a page's inlined CSS (002 Phase
  6). Keep the story's rules in the story stylesheet.
- **`core.autocrlf`:** the hash is over parsed values, so CRLF checkouts are safe; scripted edits still
  normalise line endings first.
- **`files.ts`' unexpected-file check:** `PHOTO_FILE` and the schema rules must learn the journey layout,
  or every chapter file is "not an expected data file".
- **Python ingest needs nothing.** It reads named owner files only, and `publish-check` governs bot paths,
  which don't include `owner/`.
