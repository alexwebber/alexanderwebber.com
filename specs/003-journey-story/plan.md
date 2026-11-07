# Implementation Plan: Journey Story

**Branch**: `003-journey-plan` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-journey-story/spec.md`

## Summary

Add a story page to the Running section at `/running/story/`: the owner's fitness journey in chapters,
oldest first, each with a name, a date or period, the owner's prose and a "What I learned" takeaway,
then a closing section for someone at the start and a short "not medical advice" note.

The story is owner data only. It lives in YAML under `data/running/owner/journey/`, one folder per
chapter, read through the existing `RunningStore` and rendered at build time with no client JavaScript.
It reuses spec 002's approval mechanism: each file carries an `approved` block with a sha256 tied to
exactly what was approved, checked in the loader, so changed or unapproved text can't reach a page by
any build path. Two small inline forms in the prose, `{{figure-id}}` and `[text](/site/path/)`, make
every figure and link checkable, so Garmin attribution sits right beside each figure (inside the prose
too), the two-figure limit holds, and links can only lead to pages of this site.

Nothing shows until a first chapter exists: the page, its menu item ("Story", second) and its share image
are added by one condition in the route registry, as fundraising's are. The landing link is spec 001's
existing `story_link` panel, in its existing place.

**The real story's shape** (all this plan knows, FR-036): nine chapters plus the closing section, about
1,800 words, chapters of 62 to 337 words; one set-apart figure; most chapters with a figure or two in the
prose, several Garmin-sourced and several from before the stored data; one link, to the fundraising
page; no photos yet. The chapters and closing section were approved on 2026-11-04. The note and the
page's wording are drafted and approved during the build, and the page can't go live without them.

No dependencies are added, and there's no recurring cost.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (deliberate pin), Astro 7.4.4, Node >= 22.23.4. No Python change.

**Primary Dependencies**: none added ([research.md](research.md) R17). Reuses `yaml`, `sharp` and
`astro:assets` (`Picture`), `ogEndpoint`, `SectionLayout`, `Nav`, `StoryLink`, `scan-images`, and the
approval pattern of `scripts/approve-story.ts`.

**Storage**: owner YAML and photos in `data/running/owner/journey/` ([data-model.md](data-model.md)), read
through `RunningStore.getOwner().journey`. Nothing in R2, nothing published by the bot.

**Testing**: Vitest (schemas, `parseProse`, the loader's hash check, every refused case with the sentinel
test, the approve script, `check-links`, redacted privacy findings); Playwright and axe over
`/story-preview/<state>/`; scratch-site drills for "nothing yet" (SC-002) and launch layout (SC-006);
Lighthouse ([quickstart.md](quickstart.md)).

**Target Platform**: as Running: static pages on Cloudflare Workers static assets.

**Project Type**: an extension of the existing web application, inside the Running section.

**Performance Goals**: story page and landing page at 90 or more for mobile performance (FR-073, SC-009),
including a 12-chapter, 600-words-a-chapter preview with photos.

**Constraints**: the repo's budgets (`scripts/lighthouse-budget.mjs`): performance ≥ 90, landing LCP ≤
2.5 s, JS ≤ 10 KB gzip (the story page has none), page ≤ 150 KB gzip (the real story is roughly 5 KB gzip
of HTML; the 12-chapter preview roughly 15–20 KB). No third-party request. WCAG 2.2 AA in light, dark and
forced colours. Lines at most about 75 characters (set at `66ch`). Donate stays on a 360 x 780 first
screen (3 px of headroom today). Messages and logs never quote story text.

**Scale/Scope**: nine chapters at launch, growing by a chapter at a time; designed and tested for any count
from one, with 12 as the test size (spec assumption *Expected size*, unchanged). Up to three photos a
chapter.

**Recurring costs**: **$0**. A few small files and lazily loaded images inside the existing free tiers.

**Unknowns**: none left as NEEDS CLARIFICATION. The one layout estimate, that "Story" fits beside
"Fundraising" on the menu's second line at 360 px, is measured by the launch drill, which stops for an
owner decision if it's wrong (research.md R8).

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

| Principle or bar | Assessment | Evidence in design |
|---|---|---|
| I. Move fast, spike first | PASS | No spike needed: every mechanism (approval hash, conditional area, photos, share image) already runs in the section |
| II(a) Contract tests at graduation | PASS | Schemas, `parseProse`, loader hash, each refused case, approve script, `check-links`, privacy redaction, page states over previews |
| II(b) Eval suite for AI decisions | N/A, by spec assumption | Nothing on the live site drafts text; the owner approves every word. No question-draft-approved example is kept from this story, because the answers are personal (spec *Eval suite*) |
| II(c) Error handling and logging | PASS | Every refusal names file, chapter and field; none quotes text (FR-035); the sentinel test proves it |
| III. Own your data | PASS | Owner files in git, rendered at build. No provider, no live request, no freshness to show (FR-071) |
| IV. Pluggable providers and storage | PASS | No provider. Read through `RunningStore` (`OwnerData.journey`); Markdown and content collections were rejected partly because they'd bypass it (research.md R2) |
| V. Serverless, gracefully degrading | PASS | Static pages, no new Worker route. Provider outages can't touch it. Everything renders without JS |
| VI. Privacy by default | PASS, one new category | A personal narrative isn't on the public list; the owner's per-chapter approval is what publishes it (spec assumption). Figures limited to approved categories by schema (FR-013). No private individuals, homes or routine places (checked at approval). Photos stripped and scanned; FR-062 amended by the owner. Drafts and answers stay out of the repo (FR-036). Privacy findings in story text are redacted |
| VII. Modular sections | PASS | Everything in Running: data tree, schemas (top-level `schemas/`, the accepted bend), store, validation, components, routes. `src/shared/` gains nothing. Shared gate tooling gains `check-links`, which reads only `dist/` and touches no section (justified in research.md R9, FR-070) |
| VIII. Authentic voice | PASS | Interview, draft, owner's edits and approval (FR-030). Approval tied to content by hash, enforced in the loader. Facts only from the owner or stored data, with stored figures naming their record. `VOICE.md` created from the owner's edits |
| Mobile-first and fast | PASS (budget set) | No client JS; text-led page; lazy, sized photos; budgets above |
| Accessible | PASS (verification planned) | Real headings, takeaways set apart by label and border, figures with visible sources, captions and alt text, chapter list usable without JS; axe in light and dark, forced-colours check |
| SEO and social previews | PASS | Own approved title and description, canonical URL, sitemap entry once it exists, a words-only share image |
| Graceful degradation | PASS | Nothing to degrade: no provider, no script |
| Visualisations first | Deliberate departure (SHOULD) | The owner chose chapters over a progress view; Goals and Health carry the visuals (spec *Audience and tone*) |
| Tech constraints | PASS | Astro on Cloudflare; no new service; cost $0 |
| Build gate from day one | PASS | New schema, referential and approval checks in the existing gate, plus `check-links` after the build |
| Broader CI deferred | PASS | Existing path-filtered `tests.yml`; its filters gain the new fixtures and scripts |

**Gate result: PASS, no violations.** Complexity Tracking lists the choices worth the owner's eye.

### Post-design re-check (after Phase 1)

Re-checked against [data-model.md](data-model.md) and [contracts/](contracts/): every row still passes.
Design tightened four points. The approval hash names its fields, so a future video can't invalidate
approved chapters (FR-053). Photos are hashed by their bytes, so a swapped file needs fresh approval
(FR-033). Inline figures are marked up, so the two-figure limit and attribution are checked rather than
left to approval (FR-010, FR-014). And privacy-scan findings in story text are redacted, because the
scan's usual excerpt would quote a word of the story (FR-035).

## Design answers

Each has the decision and its reason; the fuller reasoning is in [research.md](research.md).

1. **Content format and location** (R2). YAML in `data/running/owner/journey/`: `page.yaml`, `note.yaml`,
   `closing.yaml` and `chapters/<id>/chapter.yaml` with its photos beside it. Plain text with two inline
   forms only. One folder per chapter, so adding one touches nothing else (FR-050, SC-008). Named
   `journey/` so it can't be confused with the campaign stories in `owner/stories/`.
2. **Approval** (R3, R4). Spec 002's `approved` block and loader check, generalised: the sha256 covers a
   canonical JSON of each file's named fields, plus each photo's bytes. `approve-story.ts` gains
   `--journey=<chapter-id|closing|note|page>` with 002's safeguards. The campaign story's hash is
   unchanged. The nine chapters and closing section are recorded with the owner's approval date,
   2026-11-04, if the rendered text matches the approved text exactly (SC-005).
3. **Figures in the prose** (R1, R5). `{{figure-id}}` names a structured figure in the chapter (category,
   label, date, exact text, source, record reference, Garmin source). Inside a sentence it renders inline
   with its source in parentheses right after it, such as "12.3 kg (Garmin Index S2)"; alone in a
   paragraph it renders as a set-apart block. At most two per chapter of either kind, by schema. Stored
   figures name their record, and one dated before the stored data begins is refused, because only the
   owner can supply it (FR-012).
4. **Garmin attribution** (R1). Re-read in full on 2026-11-04 (V 6.30.2025, unchanged). Per figure, as text,
   never a footnote or tooltip, which the guidelines forbid. Not under the page heading, so the page
   still opens on the story (FR-014). Checked against the figure's record when it's stored data.
5. **Chapter addresses** (R6). The `id` is the folder name and the anchor (`#<id>`), set from the name
   when the chapter is first written and never changed (FR-051).
6. **Dates and order** (R6). A day, a month or a period; shown as "15 Mar 2001", "March 2001" or "March to
   September 2001". Oldest first by start; ties need an explicit `order`.
7. **Chapter list at four or more** (R7). A closed `<details>` "Chapters" at the top, so even 12 names
   stay off the first screen; 2 taps to any chapter without JS; "Back to chapters" after each chapter.
   The real story has nine chapters, so the list shows at launch.
8. **Video slot** (R11). One reserved place in `StoryChapter.astro`, after the photos and before the
   takeaway; the hash's field list leaves room for a future `video` with its own approval (SC-013).
9. **Photos** (R10). The race-photo pipeline: a new `add-chapter-photo.ts` sharing the strip and resize
   steps with `add-race-photo.ts` through `scripts/lib/photo.ts`; caption required; three at most;
   `Picture` at 640 and 1280 px in AVIF, WebP and JPEG. Launch has none. FR-062 is amended in this PR.
10. **Hiding, menu and landing** (R8). A `story` area added to `runningAreas` only when a chapter exists,
    last in the menu. The landing panel is spec 001's `StoryLink`, unchanged in place. New checks: a
    `story_link` with no chapter stops the update (FR-042), its href must be the story page, and its
    label must equal the approved `link_label`. "Story" is left out of the landing's section links while
    the panel sits directly above them.
11. **Launch conditions** (R12). The page needs its approved wording (`page.yaml`) and the note
    (`note.yaml`) before it can go live; a chapter without them stops the update. The closing section
    doesn't hold it back (FR-007), though it's ready.
12. **Links** (R9). Form checked in validation (`validate.ts`, so in the gate's `validate-data`, not in a
    plain build's first step, which runs only the schema and loader checks); existence checked by a new
    gate step, `check-links`, over the built site, which also catches a dead `story_link`.
13. **Privacy** (R13). The existing scans apply to the story unchanged; their findings in story files and
    the story page are redacted, and validation messages never quote text (sentinel test).
14. **`VOICE.md`** (R14). At the repository root, created in the content PR from the owner's edits, as
    style lessons only. The Martlets story extends it later.
15. **Share image and metadata** (R15). `/og/running-story.png`, words only from the approved
    `share_text`, which can't contain digits. Title and description from `page.yaml`. No "Last updated"
    (a new `lastUpdated` prop on `SectionLayout`).
16. **Performance and accessibility** (R16). No client JS; text estimated well inside budgets; headings
    h1/h2/h3; takeaway set apart by label and border; `66ch` measure; styles in a prefixed stylesheet.

## Project Structure

### Documentation (this feature)

```text
specs/003-journey-story/
├── spec.md              # FR-062 amended by this plan (owner, 2026-11-01)
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit-tasks), not created here
specs/001-running-section/spec.md   # FR-055 amended: photos also in story chapters, under 003's rules
```

### Source Code (changes to the repository)

```text
schemas/owner/
├── journey-page.schema.json, journey-note.schema.json      # new
├── journey-closing.schema.json, journey-chapter.schema.json # new
└── fixtures/...                                             # valid and invalid, made up
src/sections/running/
├── integration.ts                 # the conditional story area, second
├── validate.ts                    # journey and story_link rules
├── data/
│   ├── journey.ts                 # new: loadJourney(store)
│   ├── photos.ts                  # glob also covers chapter photos
│   └── store/                     # schemas list, files.ts (paths, journeySha256, loader check,
│                                  #   journeyChapterIds), running-store.ts (OwnerData.journey)
├── domain/journey.ts              # new, pure: parseProse, ordering, "when" text, figure source text
├── components/
│   ├── StoryPage.astro            # new
│   ├── StoryChapter.astro         # new (with the reserved video place)
│   ├── StoryProse.astro           # new: paragraphs, inline figures, links
│   ├── StoryFigure.astro          # new: set-apart figure
│   ├── ChapterList.astro          # new
│   ├── StoryClosing.astro, StoryNote.astro   # new
│   ├── SectionLayout.astro        # lastUpdated prop
│   └── SectionLinks.astro         # skips the area the story panel already links to
├── pages/story.astro              # new
├── og/story.png.ts                # new
└── styles/story.css               # new, .story- prefix
scripts/
├── approve-story.ts               # --journey mode
├── add-chapter-photo.ts           # new
├── lib/photo.ts                   # new: shared with add-race-photo.ts
├── add-race-photo.ts              # uses lib/photo.ts; behaviour unchanged
├── check-links.ts                 # new gate step
├── scan-privacy.ts                # redacts findings in story text
└── lighthouse-budget.mjs          # the story page type
.github/actions/gate/action.yml    # check-links after the build
.github/workflows/tests.yml        # path filters for the new fixtures and scripts
astro.config.mjs                   # /story-preview/[state]
tests/
├── fixtures/story-preview/        # new: generated text and images, per state
├── e2e/{story,story-none,story-launch}.spec.ts   # new
├── a11y/story.spec.ts             # new
└── unit/                          # journey parse, validation, approval, check-links, scan redaction;
                                   #   every hand-written OwnerData fake gains `journey`
VOICE.md                           # new, in the content PR only
data/running/owner/journey/        # new, in the content PR only
```

**Structure Decision**: no new project or section. The story is part of Running, beside the campaign
stories, with the same split between store, domain, data loaders and components.

### Graduation plan (Principle I and II)

| Unit | Graduation bar delivered with it |
|---|---|
| Journey files and approval | Design note ([contracts/content-files.md](contracts/content-files.md)), schema fixtures, loader and approve-script tests, the sentinel test |
| Story page | Playwright, axe and Lighthouse across every preview state; the two scratch-site drills; an adversarial self-review |
| `check-links` and the redaction | [contracts/gate.md](contracts/gate.md), planted-case tests, a clean run on today's site |

### Delivery order (input to /speckit-tasks)

Each slice can be its own PR. Slices 1–6 use made-up text only and change nothing a visitor sees, because
the story area exists only once a chapter does.

1. **Files and checks**: schemas, loader and hash, `approve-story --journey`, validation rules,
   `story_link` rules, `check-links` (passing on today's site), privacy redaction, the store fakes.
2. **US1 and US2, the page**: components, styles, previews, e2e and axe on previews.
3. **US3, finding it**: the conditional area, menu, `SectionLinks` rule, share image, the `story-none` and
   `story-launch` drills (Donate on the first screen).
4. **US4, growth**: chapter list, back links, the growth drill.
5. **US5, photos**: `scripts/lib/photo.ts`, `add-chapter-photo.ts`, rendering, photo previews. Can come
   after launch, since the story launches without photos; it's here so graduation covers it.
6. **Polish and graduation**: Lighthouse (the `long` preview and landing), axe on every state, the
   adversarial review, the Running README's *Journey story* section.
7. **The content PR (launch)**, with the owner: the note and page wording approved, the real files
   written and approved, `story_link` set, `VOICE.md` created, the full gate locally, then the live
   checks and a guided review after merge ([quickstart.md](quickstart.md) §8).

## Owner steps

What the plan needs from the owner, folded into reviews they're already doing:

| When | Step |
|---|---|
| This plan's PR | The confirmations below |
| Each UI slice's PR | Screenshots of the previews on a phone and a desktop (made-up text) |
| Before the content PR | One session: approve the note and the page wording (title, description, share text, landing link label), and look at the rendered real chapters, including each figure's source, on a local preview |
| After launch | Guided review of the live page on a phone and a desktop |
| Later | The reader test (SC-011), which the owner may skip; photos, if wanted; the next chapter after Brighton |

## Open questions for the owner (PR checkboxes)

None of these is visible yet: the page appears only when the content PR merges. Previews with made-up
text will show each one in the build PRs. Each has a recommended option.

1. **A Garmin figure inside the prose** reads like "12.3 kg (Garmin Index S2)": the source in brackets
   straight after the figure, at the prose's size in the lighter text colour. Owner figures with no
   Garmin source show nothing extra. *Recommended: yes, as described.*
2. **Chapter dates** read "15 Mar 2001" for a day, "March 2001" for a month and "March to September 2001"
   for a period (months in full when there's no day). *Recommended: yes.*
3. **The chapter list** (nine chapters, so it shows at launch) is a closed "Chapters" line at the top that
   opens into the list of names, with "Back to chapters" after each chapter. *Recommended: closed by
   default, so the first chapter starts on the first screen.*
4. **"Story" isn't repeated** in the landing page's "More about Alex's running" links, because the story
   panel sits directly above them. *Recommended: leave it out there.*
5. **The note holds back launch**: the page can't go live until the "not medical advice" note is approved,
   because the spec says the page must show it (FR-008). The closing section doesn't hold it back.
   *Recommended: yes.*
6. **Approval dates**: the nine chapters and closing section are recorded as approved on 4 Nov 2026, if the
   words reach the site exactly as approved; you look at the rendered chapters (with each figure's source)
   once, in the same session as approving the note and page wording. *Recommended: yes.*
7. **At most two figures a chapter, counting figures within the prose**, checked automatically (the spec
   only required the check for set-apart figures). Every chapter already fits. *Recommended: yes.*
8. **The share image's words can't contain any digit**, not even a year, so no figure can reach it.
   *Recommended: yes.*
9. **FR-062, as amended here**: no other people in chapter photos outside races; in a race photo,
   strangers in the crowd only if none is recognisable. Spec 001's FR-055 now mentions story photos too.
   *Recommended: confirm the wording.*
10. **The "What I learned" box**: a bordered box with a thicker edge on its left, its label as a small
    heading. *Recommended: yes; the previews will show it.*

## Complexity Tracking

> No constitution violations. Items below are deliberate choices the owner may want to review.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Inline markup (`{{id}}`, `[text](/path/)`) in plain text | Figures need attribution beside them and a checked limit; links must be site-only (FR-010, FR-014, FR-015) | Plain prose: nothing could find a figure or a link. Markdown: passes HTML and external links, and sits outside the store |
| Hash over named fields plus photo bytes | FR-033 covers every part of a chapter, and FR-053 needs a video later without re-approving text | 002's text-only hash: misses figures, captions and photos. Whole-file hash: comments and line endings would force re-approval |
| One folder per chapter | Adding a chapter edits nothing else (FR-050, SC-008); photos sit beside their chapter | One story file: every new chapter edits a shared file |
| `check-links`, a new gate step | Whether a path exists depends on the build (runs, races, fundraising), so only the built site can prove a link (FR-015, FR-042) | Validation only: would need a second copy of the routing rules |
| Redacting privacy findings in story text | The scan's excerpt would quote a word of the story into a public log (FR-035) | A blanket exemption for story files: would lose FR-022's checks |
| `story_link.label` must equal the approved `link_label` | Puts the landing label under the approval hash (FR-039) without changing spec 001's setting | Hashing `section.yaml`: it holds unrelated settings the owner changes often |
| `lastUpdated` prop on `SectionLayout` | The story isn't a data view (FR-071) | An empty named slot: `Astro.slots.has` reports a conditional slot as filled |
