# Contract: Owner Files, Approval and Validation

Extends Running's data-files contract. The fields are in [data-model.md](../data-model.md); this
document fixes how the files are written, approved and refused.

## Who writes what

| File | Written by | When |
|---|---|---|
| `journey/chapters/<id>/chapter.yaml` | The agent, from text the owner has approved | In a PR, after the owner's explicit yes |
| `journey/chapters/<id>/<photo>` | `scripts/add-chapter-photo.ts` only | After the owner chooses the photo |
| `journey/closing.yaml`, `note.yaml`, `page.yaml` | The agent, from approved text | As above |
| Every `approved` block | `scripts/approve-story.ts --journey=…` only | Straight after the owner's yes, never before |
| `VOICE.md` | The agent | In the PR that carries the first approved text (FR-037) |
| `section.yaml` `story_link` | The agent | In the PR with the first approved chapter |

Nothing else may enter the repository: no answers, drafts, unapproved text or original photos (FR-036).

## `scripts/approve-story.ts`, journey mode

```text
node scripts/approve-story.ts --journey=<chapter-id|closing|note|page> [--date=YYYY-MM-DD]
node scripts/approve-story.ts <campaign-id> [--date=YYYY-MM-DD]      # unchanged (spec 002)
```

| Behaviour | Rule |
|---|---|
| Target | `<chapter-id>` is `journey/chapters/<id>/chapter.yaml`; `closing`, `note`, `page` their files. Anything else, or a missing file, refuses |
| Date | Defaults to today in Europe/London. A future date or a malformed one refuses |
| Writes | `approved.date` and `approved.sha256` (the file's approval hash, data-model.md §2), keeping the text and comments |
| Safety | Writes with `lineWidth: 0`, re-parses the result, and refuses unless every hashed field and the block survive unchanged. The file is untouched on any refusal |
| Output | One line naming the file and date. Never text, never a parser message. The JustGiving reminder is for campaign stories only |
| Photos | Hashed by their file's bytes. A listed photo that's missing refuses |

## Validation

Which rules run where:

- **Schema and loader rules** (the *Schema* and *Loader* rows below: schema rules, approval missing or
  changed, a listed photo missing) run everywhere the data is loaded: the build's first step
  (`astro:build:start`), the store, and the gate's `validate-data`. So a plain `astro build` stops on
  them too, before `dist/` is emptied (FR-034).
- **`validate.ts` rules** run only in the gate's `validate-data`, which comes before the build in the
  gate. A plain `astro build` doesn't run them.
- **`check-links`** runs after the build in the gate.

The gate deploys only when every step passes, so a problem at any layer leaves the live site as it was
(FR-034, FR-076).

| Rule | Layer | FR |
|---|---|---|
| Schema: required fields, plain text, patterns, `maxItems` 2 figures and 3 photos, no digits in `share_text` | Schema | FR-003, FR-010, FR-060, FR-063, FR-075 |
| Approval missing, or hash ≠ content | Loader | FR-032, FR-034, SC-003 |
| `id` ≠ folder; approval or `when` in the future; same start without distinct `order` | `validate.ts` | FR-051, FR-002 |
| Unknown or unused placeholder; stray markup; first paragraph a lone figure | `validate.ts` (via `parseProse`) | FR-003, FR-005, FR-010 |
| Link not a root-relative site path | `validate.ts` | FR-015 |
| `stored` figure without an existing `ref`, or dated before the stored data; missing or mismatched `garmin` | `validate.ts` | FR-012, FR-014 |
| Listed photo missing from the folder | Loader (`files.ts`, which reads the bytes for the hash) | FR-063 |
| Chapters without `note.yaml` or `page.yaml` | `validate.ts` | FR-008, FR-039 |
| `story_link` with no chapter; href not the story page; label ≠ `link_label` | `validate.ts` | FR-040, FR-042 |
| `closing.yaml` with no chapter | Warning only | Edge case |
| Photo metadata or size | `scan-images` (unchanged) | FR-061 |
| A link that leads nowhere | `check-links` after the build ([gate.md](gate.md)) | FR-015, FR-042 |

## Messages

Each message is `file`, `entry`, `field`, `message`, as spec 001's FR-070 output:

- **entry** is `chapter "<id>"`, `closing section`, `note` or `page wording`;
- **field** is the field path, and for prose also the paragraph (`prose, paragraph 3`) and figure ID;
- **message** states the rule. It never contains a value from the file: no name, sentence, label,
  caption or figure text. Site paths and IDs are allowed, because they aren't story text.

**Sentinel test:** a fixture puts one made-up sentinel word into every text field of every file, then
runs each refused case. No message, warning or log line may contain the sentinel (FR-035, SC-003).
