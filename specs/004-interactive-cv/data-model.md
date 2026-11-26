# Data Model: Interactive CV

Phase 1 of [plan.md](plan.md). The files are in [contracts/content-files.md](contracts/content-files.md);
this page describes the entities, their rules and how they relate. Every example is made up.

## Common fields

**Id**: lower-case letters, digits and hyphens, from the career record; stable across imports; unique within
its kind. Used for anchors (`#change-<id>`), approvals and refusal messages.

**When** (a change's or role's dates): one of

| Form | Example | Means | Shown as |
|---|---|---|---|
| Year | `2014` | a point in that year | "2014" |
| Rough year | `~2014` | a point, year uncertain | "About 2014" |
| Years | `2013–2016` | from the start of the first to the end of the last | "2013 to 2016" |
| Ongoing | `2013–now` | from 2013, not finished | "2013 to now" |
| Month (latest year only) | `2026 Oct` | a point in that month | "October 2026" |
| Months (latest year only) | `2026 Feb–May` | those months | "February to May 2026" |
| Into the latest year | `2025–2026 Mar` | from 2025 to the end of that month | "2025 to March 2026" |

The latest year is the year of the import (`page.yaml` `as_of`); months are allowed only in it, and "now" is
the end of `as_of`'s month. Points draw as dots, periods as bars; rough dates draw with a dashed edge and say
"About" in words; ongoing bars end in an arrow.

**Approval**: `approved: {date: YYYY-MM-DD, source: <career-record commit, 7 to 40 hex>, sha256: <64 hex>}`.
The sha256 is of the canonical JSON (keys sorted, no whitespace, NFC strings) of the item's hashed fields,
listed per kind below.

## Entities

### Page (one)

| Field | Rules |
|---|---|
| `name`, `headline`, `location` | Text, approved. Hashed |
| `title`, `description` | Page title (<= 60 characters) and meta description (<= 160), approved. Hashed |
| `email_user`, `email_domain` | The address in two parts (never joined in the HTML). Hashed |
| `linkedin` | Optional `https://www.linkedin.com/in/...` URL. Hashed |
| `as_of` | `YYYY-MM`: the month the timeline runs to. Hashed |
| `listed` | `false` while unlisted (FR-004). Not hashed: it's a setting, changed by the owner's PR |
| `sharing_rules_confirmed` | Date the owner last re-confirmed the sharing rules (FR-023), carried from the export. Not hashed |
| `approved` | As above |

### Text block (ordered list)

| Field | Rules |
|---|---|
| `id`, `heading`, `kind` | `kind`: `pitch`, `value`, `future`, `skills`, `public`, `education`, `other`. Exactly one `pitch`. Hashed |
| `paragraphs` | List of plain-text paragraphs. Hashed |
| `stories` | For `kind: value` only: list of `{id, title, text}`, each a value story a change can link to. Hashed |
| `approved` | As above |

Order in the file is order on the page; the pitch is placed before the timeline whatever its position.

### Theme (a lane)

| Field | Rules |
|---|---|
| `id`, `name`, `line` | `line` <= 100 characters: one sentence on what the theme covers. Hashed |
| `colour` | A token name from the section's palette (`lane-1` to `lane-8`), so contrast is checked once. Hashed |
| `approved` | As above |

Order in the file is order on the page. At least one theme; at most eight.

### Change

| Field | Rules |
|---|---|
| `id`, `label`, `when`, `theme` | `label` <= 72 characters; `theme` must name a theme. Hashed |
| `thread` | Optional; must name a thread. Hashed |
| `value` | Optional; must name a value story. Marks the change as adding value. Hashed |
| `card` | 1 to 280 characters. Required (FR-022, US5 scenario 4). Hashed |
| `approved` | As above |

### Role (a hat)

| Field | Rules |
|---|---|
| `id`, `label`, `when`, `card` | `label` <= 48; `card` <= 280, required. Hashed |
| `approved` | As above |

### Thread

| Field | Rules |
|---|---|
| `id`, `name`, `line` | `name` <= 40; `line` <= 100. Hashed |
| `approved` | As above |

A thread's changes are the changes naming it; fewer than two fails the import and the build ("a thread with
one change is no thread", spec edge case).

### Next item

| Field | Rules |
|---|---|
| `id`, `title`, `card` | `title` <= 72; `card` <= 280, required. Hashed |
| `approved` | As above |

### Download

| Field | Rules |
|---|---|
| `kind` | `plain` or `visual`; at most one of each |
| `file` | File name in `data/cv/downloads/`, served at `/cv/<file>` |
| `title` | Link text, approved. Hashed with the bytes |
| `approved` | `date` (shown as "Last updated"), `source`, and `sha256` of the canonical JSON of `kind`, `file`, `title` and `bytes` (the sha256 of the file's bytes), as contracts/content-files.md *Hashed fields* |

## Rules across entities

- Every reference resolves: change → theme, thread, value story.
- No text anywhere in the section, and no PDF's text or metadata, matches a phone pattern (UK and
  international forms; spaced, dotted and bracketed digits; `tel:` links).
- Over-budget text, a missing card, a missing or stale approval, a dangling reference or a one-change
  thread fails `validate-data` and the build, naming the file, the kind and the id, never the text.
- The email address is never written joined: the page writes the parts and the words.

## Derived values (domain, pure functions, unit-tested)

- **Career scale**: from the earliest `when` start to `as_of`; years linear over the first part, the latest
  year month by month over the last fifth, joined without a gap for bars that cross.
- **Packing**: changes into the fewest rows without overlap (greedy by start), per theme; used by the phone
  strips, the swimlanes and the share image.
- **Label placement** (landscape): for each change, the first row in its lane where the label's estimated
  width fits before the next occupied span; otherwise "no room" (hover, focus and card only).
- **Dates in words**: as the table in *Common fields*.
- **Lists for the drill**: per theme (by start, then end), roles, each thread, next; previous and next are
  within the list the reader came from.

## State (the reader's, in the browser only)

| State | Where | Notes |
|---|---|---|
| Drill level and list | The URL hash | Shareable; the back button walks it |
| Zoom (landscape) | In memory | Escape or "Whole career" resets |
| Thread followed (landscape) | In memory | Escape ends it |
| Draw-in done | In memory | Plays once per page view |

Nothing is stored in the browser and nothing is sent anywhere.
