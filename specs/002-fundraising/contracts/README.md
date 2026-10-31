# Contracts: Fundraising

These extend Running's contracts ([001 contracts](../../001-running-section/contracts/README.md))
and change none of them, except where a document says so. Fundraising adds no public API beyond one
read-only freshness route.

| Contract | Document | Tested by |
|---|---|---|
| Fundraising provider adapter (JustGiving) | [provider-adapter.md](provider-adapter.md) | pytest contract suite against synthetic fixtures |
| CLI, workflow steps, alerts, freshness route | [pipeline.md](pipeline.md) | pytest (CLI, alerts), Vitest (Worker, workflow check), Playwright (freshness UI) |
| Owner and published files, schemas, validation | [data-files.md](data-files.md) | Schema fixtures in Python and TypeScript, Vitest (referential checks) |
| Pages, card and page states, share image | [routes.md](routes.md) | Playwright over the preview routes, axe, Lighthouse |

Field-level definitions: [data-model.md](../data-model.md).
