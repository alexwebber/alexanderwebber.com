# Contracts: Running Section

The Running section has no public API. Its external interfaces are internal boundaries that must
stay stable and contract-tested (constitution II(a)): provider adapter, storage abstractions, data
schemas, owner-file format, pipeline/CLI + workflow, and the freshness endpoint.

| Contract | Document | Tested by |
|---|---|---|
| Provider adapter (Garmin and future sources) | [provider-adapter.md](provider-adapter.md) | pytest contract suite against fixtures |
| Storage abstractions (`RawArchive`, `PublishedWriter`, `RunningStore`) | [storage.md](storage.md) | one shared suite run against every implementation |
| Published + owner data schemas (JSON Schema files in `schemas/`) | [data-files.md](data-files.md) | schema fixtures (valid/invalid) in Python and TS |
| Pipeline CLI, workflows, gate, failure-class alert table, freshness endpoint | [pipeline.md](pipeline.md) | pytest (CLI/alerts), Playwright (freshness UI), workflow dry-run (run locally / at graduation, not a per-push gate) |
| Page URLs / SEO surface | [routes.md](routes.md) | Playwright route + meta checks |

Canonical machine-readable schemas are authored in `schemas/` during implementation (task list will
create them first); the documents here define their content and rules.
