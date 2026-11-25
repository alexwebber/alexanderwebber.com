# Contract: CV data files

## Files

```text
data/cv/
├── page.yaml          # one Page
├── blocks.yaml        # blocks: [Text block, ...] in page order
├── timeline.yaml      # themes, threads, roles, changes, next
├── downloads.yaml     # downloads: [Download, ...]
└── downloads/         # the approved PDFs
```

Schemas: `schemas/cv/{page,blocks,timeline,downloads}.schema.json`, loaded by `SchemaSet` like Running's.
YAML 1.2, so dates and `2013–2016` stay strings. The files are written by `scripts/import-cv.ts`; a hand edit
breaks the item's approval hash, which is the point.

### Example (made up)

```yaml
# data/cv/timeline.yaml
themes:
  - id: theme-a
    name: Change type A
    line: A made-up line on what this type of change covers.
    colour: lane-1
    approved: { date: 2026-12-01, source: 0a1b2c3, sha256: <64 hex> }
threads:
  - id: thread-a
    name: A made-up thread
    line: Changes that built on each other.
    approved: { ... }
roles:
  - id: role-a
    label: A made-up role
    when: 2012–now
    card: One to three made-up sentences about the role.
    approved: { ... }
changes:
  - id: change-a
    label: Change A
    when: 2013–2016
    theme: theme-a
    thread: thread-a
    value: story-a
    card: The problem it solved, and what it changed, in made-up words.
    approved: { ... }
next:
  - id: next-a
    title: A made-up direction
    card: Made-up words on where the owner is heading.
    approved: { ... }
```

## Hashed fields

| Kind | Fields in the hash |
|---|---|
| Page | `name`, `headline`, `location`, `title`, `description`, `email_user`, `email_domain`, `linkedin`, `as_of` |
| Text block | `id`, `heading`, `kind`, `paragraphs`, `stories` |
| Theme | `id`, `name`, `line`, `colour` |
| Thread | `id`, `name`, `line` |
| Role | `id`, `label`, `when`, `card` |
| Change | `id`, `label`, `when`, `theme`, `thread`, `value`, `card` |
| Next item | `id`, `title`, `card` |
| Download | `kind`, `file`, `title`, `bytes` (`bytes` is the sha256 of the file's bytes, 64 lower-case hex; the approval's sha256 is of the canonical JSON of those four) |

A field absent from an item is absent from its canonical JSON (not `null`). Adding a new optional field to
a kind later appends to its list without changing existing hashes, as long as items without it hash the same.

## The career record's export (input to `import-cv`)

Produced by the private career record's own script, from items it marks approved. Schema:
`schemas/cv/export.schema.json`.

```json
{
  "format": 1,
  "source": "<career-record commit>",
  "exported": "YYYY-MM-DD",
  "page": { "...": "Page fields, with approved_on" },
  "blocks": [ { "...": "Text block fields, with approved_on" } ],
  "timeline": { "themes": [], "threads": [], "roles": [], "changes": [], "next": [] },
  "downloads": [ { "kind": "plain", "file": "<name>.pdf", "title": "...", "path": "<path beside the export>", "approved_on": "YYYY-MM-DD" } ]
}
```

Every item has `approved_on`; an item without it is refused, never skipped. The export holds no phone
number: the import checks anyway.

## `scripts/import-cv.ts`

```text
node scripts/import-cv.ts --from=<export.json> --rules-checked=<YYYY-MM-DD> [--dry-run]
```

1. Validate the export's schema.
2. Refuse: an item without `approved_on`; a phone pattern in any text or PDF; text over budget; a dangling
   reference; a thread with fewer than two changes; a change or role without a card; months outside the
   `as_of` year; an export without `page.sharing_rules_confirmed` (the date the owner last re-confirmed
   the sharing rules, recorded in the career record); `--rules-checked` earlier than that date (FR-023).
3. Write the four YAML files, each item with `approved: {date: approved_on, source, sha256}`, and copy the
   PDFs into `data/cv/downloads/`, replacing older versions at the same file names (FR-020).
4. Print counts per kind and the files written. Exit 1 with one line per refusal: file, kind, id, reason.

`--dry-run` does steps 1 and 2 only.

## `scripts/compare-cv.ts`

```text
node scripts/compare-cv.ts --from=<export.json> [--dist=dist]
```

Reads `dist/cv/index.html`. The canonical occurrence of each item (its card; a block, the header or the
downloads block for those kinds) carries `data-cv-item="<kind>:<id>"` and each compared field
`data-cv-field="<field>"`. Tiles, rows, SVG labels, tooltips and crumbs carry neither. The script compares each field's text content (whitespace collapsed,
entities decoded) with the export, and prints `no differences` or one line per difference with kind, id and
field (no text). Exit code 1 on any difference. Its output is pasted into the content PR (SC-005).

**Compared fields**: Page `name`, `headline`, `location` (the header), `title` (the `<title>` text),
`description` (the meta description); a text block's heading and each paragraph
(`data-cv-field="paragraphs.<n>"`); each value story's title and text (`data-cv-item="story:<id>"`); Theme
`name`, `line`; Thread `name`, `line`; Role `label`, `when`, `card`; Change `label`, `when`, `card`; Next
item `title`, `card`; Download `title`. `when` is compared as its words (`whenText(parseWhen(when))`).
Not compared as text: ids, `kind`, `colour`, references (validate-data checks them) and `as_of`;
`email_user` and `email_domain` are compared with the element's `data-user` and `data-domain`, `linkedin`
with the link's `href`.

## Messages

Every refusal, in the import, the store and validation, names the file, the kind, the id and the rule:
`data/cv/timeline.yaml: change change-a: card is 312 characters (budget 280)`. None quotes CV text; the
sentinel test plants a unique word in every field and fails if it appears in any message.
