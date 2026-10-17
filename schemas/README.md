# schemas/

JSON Schema (draft 2020-12) for every Running data file: the single source of truth for the
site (TypeScript, ajv) and the ingest (Python, jsonschema). File layout and cross-cutting rules
are in [contracts/data-files.md](../specs/001-running-section/contracts/data-files.md).

- `published/*.schema.json`: machine-written, sanitised JSON in `data/running/published/`.
  `schema_version` is required.
- `owner/*.schema.json`: hand-edited YAML in `data/running/owner/`. Mapping files may set
  `schema_version` (default: current). List files (goals, upcoming races, run overrides, health
  exclusions) can't carry it, so they are always the current version.
- `defs.schema.json`: shared building blocks (dates, run IDs, owner times and distances), used
  through `$ref: ../defs.schema.json#/$defs/...`.
- `fixtures/<schema>/{valid,invalid}/`: shared cases, run by `tests/contract/schemas.test.ts` and
  `ingest/tests/contract/test_schemas.py`. Add a fixture with every schema change.

Conventions:

- Every object is closed (`additionalProperties: false`), so a typo is an error, not ignored. A
  contract test enforces it, and also checks that no coordinate, start-time or provider free-text
  key validates in any published schema except `race-track`.
- `x-error` is an annotation, not a JSON Schema keyword. It holds the owner-facing message for
  the node, e.g. `is not a valid time (expected mm:ss or h:mm:ss)`; `src/shared/storage/schemas.ts`
  uses it to turn ajv errors into FR-070 file/entry/field messages.
- `tsType` steers `scripts/gen-types.ts` (json-schema-to-typescript) where the generated type
  would be awkward, e.g. tuples. Types are generated into `src/shared/storage/generated/`
  (gitignored) by the `prebuild`, `pretest` and `predev` hooks.
- Goals use `discriminator` on `type`, so ajv reports errors for the goal's own type only.
- Owner YAML is read with YAML 1.2 core-schema rules in both languages, so `3:30:00` and
  `2027-04-04` stay strings (Python: `awingest.yaml12`, not plain PyYAML).
