# Data Model: Journey Story

**Feature**: 003-journey-story | **Date**: 2026-11-04 | Research: [research.md](research.md)

Every value below is made up. Nothing here is from the real story.

The story is **owner data only**: nothing is ingested, fetched or published by the bot. It all lives
under `data/running/owner/journey/`, is read through `RunningStore` (`getOwner().journey`), and is
validated in the build's first step like every other owner file (spec 001 FR-070).

## 1. Layout

```text
data/running/owner/journey/
├── page.yaml                 # the page's own wording (title, description, share text, link label)
├── note.yaml                 # the "not medical advice" note
├── closing.yaml              # the closing section, for someone at the start (optional)
└── chapters/
    └── <chapter-id>/
        ├── chapter.yaml      # one chapter
        └── <photo>.jpg|webp|avif   # up to three, optional
```

| Schema (`schemas/owner/`) | File | Title |
|---|---|---|
| `journey-page.schema.json` | `page.yaml` | `JourneyPage` |
| `journey-note.schema.json` | `note.yaml` | `JourneyNote` |
| `journey-closing.schema.json` | `closing.yaml` | `JourneyClosing` |
| `journey-chapter.schema.json` | `chapters/<id>/chapter.yaml` | `JourneyChapter` |

Each joins `RUNNING_SCHEMAS`, `gen-types`, `files.ts`' path rules (photos beside a `chapter.yaml` join
`PHOTO_FILE`), and the schema fixtures in TypeScript. Python reads none of them.

## 2. Approval (every file)

Every file carries the same block, written only by `scripts/approve-story.ts --journey=<target>` after
the owner's explicit yes:

```yaml
approved:
  date: 2001-01-01
  sha256: 0f3c…   # 64 lower-case hexadecimal characters
```

| Rule | Where | Message (never quotes text) |
|---|---|---|
| `approved` missing | schema, with `files.ts` swapping "is required" | "needs the owner's approval before it can be published" |
| `sha256` ≠ the file's approval hash | loader (`files.ts`) | "has changed since it was approved; the owner must approve it again" |
| `date` in the future | `validate.ts` | "<date> is in the future" |

**The approval hash** (`journeySha256(kind, value, photoBytes)` in `files.ts`): sha256 of the canonical
JSON (keys sorted, no whitespace, UTF-8) of the file's **hashed fields**, as YAML parsed them:

| File | Hashed fields |
|---|---|
| `chapter.yaml` | `id`, `name`, `when`, `order`, `prose`, `takeaway`, `figures`, and `photos` with each photo's `file`, `description`, `caption` and the sha256 of the photo file's bytes |
| `closing.yaml` | `heading`, `text` |
| `note.yaml` | `text` |
| `page.yaml` | `title`, `description`, `share_text`, `link_label` |

Absent optional fields are left out, not hashed as null. Any field not listed (including a future
`video`) doesn't affect the hash (research.md R3, R11).

## 3. Chapter: `chapters/<chapter-id>/chapter.yaml`

```yaml
id: chapter-a
name: Chapter A
when: 2001-03            # a day, a month, or a period
prose: |
  Lorem ipsum dolor sit amet, {{fig-a}} consectetur adipiscing elit, sed do eiusmod tempor.

  Ut enim ad minim veniam, quis nostrud [exercitation ullamco](/running/fundraising/) laboris.

  {{fig-b}}

  Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.
takeaway: A made-up lesson, in a sentence or two.
figures:
  - id: fig-a
    category: weight
    label: Weight
    as_of: 2001-03
    text: 12.3 kg
    source: owner
    garmin: Index S2        # optional: a Garmin device, "Garmin" alone, or "derived"
  - id: fig-b
    category: vo2_max
    label: VO2 max
    as_of: 2001-03-15
    text: "11"
    source: stored
    ref: { health: { metric: vo2max, date: 2001-03-15 } }
    garmin: Garmin
photos: []                  # up to three; see §4
approved:
  date: 2001-04-01
  sha256: 0f3c…
```

| Field | Rule |
|---|---|
| `id` | A slug. Equals the folder name. Set once, from the name, and never changed (FR-051) |
| `name` | Required plain text, one line. The `<h2>` |
| `when` | Required. `YYYY-MM-DD`, `YYYY-MM`, or `<start>/<end>` with each end a month or a day, start before end. Not after today (Europe/London) |
| `order` | Optional integer. Required, and distinct, when two chapters share the same start (research.md R6) |
| `prose` | Required. Plain text in paragraphs separated by blank lines, with only the inline markup in §5 |
| `takeaway` | Required. Plain text, one paragraph, at most 400 characters (FR-004, "a sentence or two"). No markup |
| `figures` | Optional, `maxItems: 2` (FR-010). Each is used by exactly one placeholder in `prose` |
| `photos` | Optional, `maxItems: 3` (FR-060). See §4 |
| `approved` | Required. §2 |

**Figure fields:**

| Field | Rule |
|---|---|
| `id` | A slug, unique in the chapter. The placeholder's name |
| `category` | One of the approved categories (research.md R5). Anything else needs a schema change, which records the owner's approval (FR-013) |
| `label` | What it measures, plain text. Shown on a set-apart figure |
| `as_of` | A day or a month, not in the future. Shown on a set-apart figure |
| `text` | The figure exactly as approved. Matches its category's pattern in *Figure text by category* below (FR-077) |
| `source` | `stored` (taken from the site's data) or `owner` (FR-012) |
| `ref` | Required with `source: stored`: `{ run: <run-id> }`, `{ health: { metric, date } }` (a published health metric), `{ manual: { kind, as_of } }` (an entry in `manual-metrics.yaml`), or `{ race: <slug> }` (a `races/<slug>/race.yaml` official time). The record must exist, and its kind must fit the category (*Ref kinds by category* below). Not allowed with `source: owner` |
| `garmin` | Optional: a Garmin device model (`garminDevice` from `defs`), `Garmin` alone, or `derived`. Required when `ref` is Garmin-sourced, and must agree with it: a run's own `device` (or `Garmin` when it has none), the scale for weight and body fat, `Garmin` for other wellness and manual Garmin figures, `derived` for fitness and fatigue. A hand-entered race result isn't Garmin data, so a race time from `race.yaml` carries none |

**Figure text by category** (the `text` pattern; metric units only, FR-077):

| Category | `text` |
|---|---|
| `weight` | A number with `kg` |
| `body_fat` | A number with `%` |
| `vo2_max`, `fitness` | A bare number |
| `resting_hr` | A number with `bpm` |
| `hrv` | A number with `ms` |
| `race_prediction`, `race_time`, `best_effort` | A clock time, `m:ss` or `h:mm:ss` |
| `run_distance` | A number with `km` |
| `run_pace` | `m:ss /km` |
| `training_total` | A number with `km`, or `h:mm` |
| `training_status` | Plain words, no digit |
| `calories` | A comma-grouped number, or `<n> to <n>`, followed by ` calories`, and no other unit |

**Ref kinds by category** (a `stored` figure's `ref`):

| Category | Ref |
|---|---|
| `weight` | `health`, metric `weight_avg7` |
| `body_fat` | `health`, metric `body_fat_pct` |
| `vo2_max` | `health`, metric `vo2max` |
| `fitness` | `health`, metric `fitness_ctl` |
| `resting_hr` | `health`, metric `resting_hr` |
| `hrv` | `health`, metric `hrv` |
| `training_status` | `manual`, kind `training_status` |
| `race_prediction` | `manual`, kind `race_predictions` |
| `run_distance`, `run_pace`, `best_effort` | `run` |
| `race_time` | `run`, or `race` for an official time from `race.yaml` |
| `training_total`, `calories` | None: owner figures only (`source: owner`) |

**`calories`**: daily calories burned, a Garmin estimate, as one value or a range per day. The owner
approved publishing it on 2026-11-03, in the interview (FR-013); adding it to the schema records that
approval. It isn't in the stored data, so it's always `source: owner`, and it requires `garmin: Garmin`.

**Numbers in the prose that aren't figures.** A number that isn't a measurement of the owner (a target
or aspiration, a product's limit, or a fixed expression the owner chose to keep in their own words, a
non-metric one included) is prose, not a figure: it has no placeholder, no source, and doesn't count
towards the two figures. FR-077's metric-unit rule applies to figures. Which numbers are figures is
decided with the owner when the files are written (owner to confirm in the tasks PR).

**Cross-field rules (`validate.ts`):**

- A `stored` figure whose `as_of` is before the first stored record of its kind stops the update: before
  then only the owner can supply it (FR-012).
- A figure's category and its `ref` agree, as *Ref kinds by category* gives them.
- Every placeholder names a figure, and every figure has exactly one placeholder.
- The first paragraph of `prose` can't be a lone placeholder (FR-003, FR-005).
- Two chapters with the same start and no distinct `order` stop the update, naming both.

## 4. Chapter photo

```yaml
photos:
  - file: lorem.jpg
    description: Made-up alternative text describing the photo.
    caption: A made-up caption.
```

| Field | Rule |
|---|---|
| `file` | `^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|webp|avif)$`, a file in the chapter's folder that exists |
| `description` | Required plain text: the alt text (FR-063) |
| `caption` | Required plain text, shown under the photo (FR-063) |

The file has no metadata and a long edge of at most 2,400 px (`scan-images`, unchanged). Its bytes are in
the chapter's hash, so adding or replacing it needs a fresh approval (FR-033). Who may appear is the
owner's call at approval (FR-062, amended): no other people outside a race; strangers in a race crowd
only if none is recognisable.

## 5. Inline markup in `prose`

| Form | Meaning | Rules |
|---|---|---|
| Blank line | New paragraph | Leading and trailing blank lines are ignored |
| `{{figure-id}}` inside a sentence | Inline figure | Renders the figure's `text`, then its attribution in parentheses |
| `{{figure-id}}` alone in a paragraph | Set-apart figure | Renders label, date, text and attribution as a block |
| `[link text](/path/)` | Link to a page of this site | Path starts with one `/`, ends with `/` or `/#anchor`, no scheme, query or spaces (FR-015). The built-site check then proves it exists (research.md R9) |

Anything else that looks like markup (an unmatched `{{` or `}}`, `[…](` not in the form above, or an
HTML-like tag: `<` followed by a letter or `/`) stops the update with the paragraph number. Text is otherwise rendered escaped, as written.

Parsing is pure (`domain/journey.ts`): `parseProse(prose) → Paragraph[]`, where a paragraph is either
`{ kind: 'figure', id }` or `{ kind: 'text', parts: (string | { figure: id } | { link: href, text })[] }`.

## 6. Closing section: `closing.yaml`

```yaml
heading: A made-up heading for someone just starting
text: |
  Lorem ipsum dolor sit amet, consectetur adipiscing elit.

  Sed do eiusmod tempor incididunt ut labore.
approved: { date: 2001-04-01, sha256: 0f3c… }
```

`heading` and `text` are required plain text; `text` takes the §5 links but no figures. Optional at
launch (FR-007). With no chapter it's ignored, with a warning that it has nothing to follow.

## 7. Note: `note.yaml`

```yaml
text: A made-up line saying this is what worked for one person and isn't medical advice.
approved: { date: 2001-04-01, sha256: 0f3c… }
```

`text` is required plain text, one paragraph, no markup. **Required once any chapter exists** (FR-008,
research.md R12). With no chapter it's ignored, with no message.

## 8. Page wording: `page.yaml`

```yaml
title: A Made-Up Title
description: A made-up description for search results and link previews.
share_text: A made-up line for the share image
link_label: A made-up label for the landing link
approved: { date: 2001-04-01, sha256: 0f3c… }
```

| Field | Rule |
|---|---|
| `title` | Required plain text, at most 70 characters. The `<h1>` and the start of `<title>` |
| `description` | Required plain text, at most 160 characters. The meta description and share description |
| `share_text` | Required plain text, at most 90 characters, **no digits** (FR-075: the share image carries no figure) |
| `link_label` | Required plain text. Must equal `section.yaml` `story_link.label` |

**Required once any chapter exists** (FR-039, research.md R12). With no chapter it's ignored, with no
message.

## 9. The landing link: `section.yaml` `story_link` (spec 001, unchanged schema)

New referential rules (`validate.ts`), each naming `section.yaml` and the field:

| Situation | Result |
|---|---|
| `story_link` set, no chapter | Error on `story_link.href`: the story page doesn't exist (FR-042, US3.4) |
| `story_link.href` isn't `/running/story/` | Error on `story_link.href` |
| `story_link.label` ≠ `page.yaml` `link_label` | Error on `story_link.label` (no labels quoted) |
| Chapters, no `story_link` | Allowed (the menu item is still there); the landing's section links then list "Story" |

## 10. Derived at build time

`data/journey.ts` (`loadJourney(store)`, memoised with `perStore`) over `domain/journey.ts` (pure):

- **Exists:** at least one chapter. Otherwise `undefined`, and nothing anywhere renders (FR-042).
- **Chapters:** sorted by the start of `when`, then `order`, oldest first (FR-002).
- **When, as shown:** "15 Mar 2001", "March 2001", "March to September 2001", "March 2001 to February
  2002", with a `datetime` on the `<time>` element.
- **Chapter list:** shown when there are four or more chapters (FR-052).
- **Closing and note:** after the latest chapter, in that order (FR-007, FR-008).
- **Attribution text for a figure:** `Garmin <device>`, `Garmin`, or "derived in part from Garmin
  device-sourced data", from the figure's `garmin` field (research.md R1).

`integration.ts` asks the cheaper `journeyChapterIds(root)` (folders holding a `chapter.yaml`) while the
config loads, as `campaignsWithFigures()` does, rather than loading the whole tree twice.

## 11. Not in the repository

Raw answers, drafts, unapproved text and original photos (with their metadata) stay outside it. They
have no schema here, because nothing here may hold them (FR-036).
