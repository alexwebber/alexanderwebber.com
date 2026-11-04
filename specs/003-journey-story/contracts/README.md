# Contracts: Journey Story

These extend Running's contracts ([001 contracts](../../001-running-section/contracts/README.md)) and
the campaign story's approval ([002 data-files](../../002-fundraising/contracts/data-files.md)). They
change none of them, except where a document says so. The story adds no API, no ingest and no Worker
route: it's owner files rendered at build time.

| Contract | Document | Tested by |
|---|---|---|
| Owner files, approval, validation and messages | [content-files.md](content-files.md) | Schema fixtures, Vitest (loader, referential checks, approve script), the sentinel test |
| Page, chapter parts, landing link, menu, share image, previews | [routes.md](routes.md) | Playwright and axe over the preview routes, scratch-site drills, Lighthouse |
| Gate additions: built-site link check, redacted privacy findings | [gate.md](gate.md) | Vitest over planted cases, the full gate on a scratch copy |

Field-level definitions: [data-model.md](../data-model.md). Every example in these documents is made up.
