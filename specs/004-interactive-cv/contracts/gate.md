# Contract: gate additions

The CV adds checks to existing gate steps; it adds no step.

| Check | Where it runs | Fails when |
|---|---|---|
| Schemas | `validate-data` (and the build's loader) | Any CV file doesn't match its schema |
| Approvals | `CvStore` load (so every build path) | An item or PDF has no approval, or its sha256 doesn't match |
| References | `validate.ts` | A change names an undefined theme, thread or value story; a thread has fewer than two changes |
| Cards | `validate.ts` | A change, role or next item has no card |
| Budgets | `validate.ts` | Any text over its budget (data-model.md) |
| Phone numbers | `validate.ts`, and `scan-privacy` over `dist/cv/` | A phone pattern in any CV text, PDF text or metadata, or in the built output |
| PDFs | `validate.ts` (unpdf) | A listed PDF is missing (warning, its download hidden) or unreadable (failure) |
| Unlisted | built-site test in `tests.yml` | `listed: false` but `/cv/` is in the sitemap, lacks `noindex`, or is linked from any page |
| Links | existing `check-links` | Any `#value-…`, `#change-…` or download link on `/cv/` doesn't resolve |

## Privacy scan

`scan-privacy.ts` covers `data/cv/` and `dist/cv/` like the rest of the site. Its findings in CV files are
redacted (kind, id and field, no excerpt), as for the story: an excerpt would quote CV text into a public log.

## Messages

As [content-files.md](content-files.md): file, kind, id, rule; never the text. Covered by the sentinel test.
