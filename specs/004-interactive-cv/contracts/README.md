# Contracts: Interactive CV

A new section. It reuses the shared storage, layout, design tokens and share-image contracts
([001 contracts](../../001-running-section/contracts/README.md)) and spec 003's approval idea, and changes
none of them. It adds no API, no ingest and no Worker route: approved files rendered at build time.

| Contract | Document | Tested by |
|---|---|---|
| Data files, the career record's export, approvals, import and compare | [content-files.md](content-files.md) | Schema fixtures, Vitest (store, validate, import, compare), the sentinel test |
| Page, downloads, share image, previews, unlisted headers | [routes.md](routes.md) | Playwright over the previews, the listed/unlisted build test, Lighthouse |
| The timeline's two forms: levels, hash routes, keyboard, motion, no-script order | [timeline-ui.md](timeline-ui.md) | Playwright and axe at six widths, scripts off, reduced motion, forced colours |
| Gate additions: the CV's checks and their messages | [gate.md](gate.md) | Vitest over planted cases; the full gate on a scratch copy |

Field-level definitions: [data-model.md](../data-model.md). Every example in these documents is made up.
