---
name: owner-data-file
description: Add or change a file the owner edits under data/running/owner/ — its JSON Schema, valid and invalid fixtures, generated type, store registration, validation rules and tests — including text that needs the owner's approval (a hash and an approve-story mode). Use for any new owner YAML file, or a new field or rule in one.
---

# An owner data file

The owner edits YAML under `data/running/owner/`; the build validates every file against
`schemas/owner/` and refuses anything unexpected (Principles III and IV). A new file touches the
schema, its fixtures, the store and validation in one PR. Copy the nearest precedent:

| Shape | Copy |
|---|---|
| One file, a list of entries with `id`s | `schemas/owner/campaigns.schema.json`, `goals.schema.json` |
| One file, settings | `schemas/owner/section.schema.json` |
| One file per folder entry | `schemas/owner/lab.schema.json` (`owner/lab/<x>.yaml`), `race.schema.json` |
| Text the owner approves | `schemas/owner/campaign-story.schema.json` and commit `480bf89` |

## Steps

1. **Schema** `schemas/owner/<name>.schema.json`: draft 2020-12; `$id`
   `https://alexanderwebber.com/schemas/owner/<name>.schema.json`; `title` is the TypeScript type
   name (gen-types uses it); `additionalProperties: false` on every object (a contract test refuses
   an open one); shared types by `$ref` to `../defs.schema.json` (`slug`, `date`); an `x-error` on
   each rule the owner can break, saying what the value must be, never quoting it. Owner files carry
   no `schema_version` (only published files do).
2. **Fixtures** in `schemas/fixtures/owner/<name>/{valid,invalid}/`: at least one of each (both
   suites require it), one invalid file per rule, named for the rule (`unknown-key.yaml`,
   `bad-date.yaml`). Made-up values only, never real wording. Python's
   `ingest/tests/contract/test_schemas.py` finds the schema and fixtures by itself.
3. **Register** `'owner/<name>'` in `RUNNING_SCHEMAS` (`src/sections/running/data/store/schemas.ts`),
   then `npm run gen-types` (the type lands in the gitignored `generated/`).
4. **Load** in `src/sections/running/data/store/files.ts`: the type import; a `RunningData` field
   (`Loaded<T> | undefined` for one file, `Loaded<T>[]` for one per folder entry) and its start value
   in `loadRunningData`; a `schemaForFile` rule (path relative to `data/running/`); a `store()` case;
   the entry label in `locate` (`LIST_NOUNS` for a list, `named` for a file with an id field); a sort
   if there are many. Any other file under `data/running/` is an error, so a file kept beside assets
   needs its pattern (`PHOTO_FILE`, `LOGO_FILE`, `IGNORED_FILE`).
5. **Expose** in `running-store.ts` (export the type; an `OwnerData` field whose comment says what
   empty means) and `json-file-store.ts` (map it into `owner`). Add its empty value to
   `emptyOwner()` in `tests/helpers/owner-data.ts`: the only fake to change.
6. **Rules across fields and files** go in `validateRunning` (`src/sections/running/validate.ts`):
   `error(file, entry, field, message)` or `warning(...)`, the entry in `locate`'s form, the message
   never quoting a value from free text. A rule that must also stop the build's store (approval, a
   hash) goes in `loadRunningData`, after schema validation, so no path can reach a page.
7. **Approved text** (Principle VIII) also needs: a hash function in `files.ts` (`storySha256` is the
   precedent; hash exactly the fields the spec names, canonically, and write down what was hashed);
   the check in `loadRunningData` ("the owner must approve it again"); the missing-approval message in
   `problemMessage`; and a mode in `scripts/approve-story.ts` that writes the `approved` block with
   `parseDocument` (comments kept) and never prints the text. Run it only after the owner's explicit yes.
8. **Docs**: an entry in `schemas/README.md` and the feature's data-files contract.

## Done when

- `npm test` passes: `tests/contract/schemas.test.ts` accepts every valid fixture and refuses every
  invalid one; `cd ingest; uv run pytest tests/contract/test_schemas.py` does too.
- `tests/contract/store.test.ts` covers: the file absent (the empty value), a full made-up file loaded,
  and for approved text, a changed text refused by `getOwner()`.
- A validation test through `tempRepo()` (copy `tests/unit/fundraising-validate.test.ts`) has one
  test per refused case, asserting file, entry, field and severity through `formatIssue`, each case
  planted alone.
- `npm run validate-data` is clean on the real data, and `astro check` passes.
- `node scripts/process/pr-ready.ts --suites` is green.

## Pitfalls

- YAML is parsed as 1.2 core: `yes` stays a string, and an unquoted date is a string. A file holding
  only comments parses to `null` and counts as absent.
- A schema change regenerates types, so `astro check` and both Playwright projects run (`--suites`
  picks them).
- `.github/workflows/tests.yml` runs Vitest only for paths in its `vitest=` filter; a test that imports
  from a new folder needs that folder added there (003's T001 did it for `tests/fixtures`).
