# Shared plumbing

The only code sections share (constitution Principle VII): layout, design system, charts, share
images, formatting and the storage layer. `scripts/check-boundaries.ts` fails the gate if anything
here imports a section, or if one section imports another. This is the graduation design note
(T086); the contracts are [storage](../../specs/001-running-section/contracts/storage.md),
[data files](../../specs/001-running-section/contracts/data-files.md) and
[routes](../../specs/001-running-section/contracts/routes.md).

- **`storage/`**: the site's read side of the storage abstraction (Principle IV).
  - **Interface:** sections depend only on the `RunningStore` interface (`running-store.ts`).
    `JsonFileStore` implements it over `data/running/`, so moving off JSON-in-git means a new
    implementation, not changes in sections.
  - **Validation:** every file is checked against `schemas/` (the single schema source, shared
    with Python) on first use. Any problem throws `DataValidationError` with the FR-070 message
    naming the file, entry and field, which fails the build before `dist/` is written.
  - **Types:** generated from the schemas into `storage/generated/` (gitignored) by
    `scripts/gen-types.ts`, so TypeScript can't drift from the published contract.
  - **Ordering:** runs list newest first; results are memoised per store.
- **`format/`**: UK formatting (`dates.ts`: Europe/London, "17 Oct 2026"), units (`units.ts`) and
  the owner time and distance parsers (`parse.ts`). Pages format through here, never ad hoc.
- **`design/`**: `tokens.css` holds colour (light and dark, following the OS setting), the type
  scale, spacing, focus and the chart palette. `base.css` holds element defaults. Sections restyle
  by overriding tokens under their own theme class. `tests/unit/design-tokens.test.ts` enforces
  WCAG 2.2 AA contrast for the shared tokens and every section theme.
- **`layout/`**:
  - `Base.astro` is the page shell: `lang="en-GB"`, a skip link, landmarks and a 320 px-first
    column.
  - `Meta.astro` takes a required title and description, and adds the canonical URL plus Open
    Graph and Twitter tags.
  - `Nav.astro` and `Footer.astro` complete the shell.
- **`charts/`**: build-time charts with no client JS.
  - **Components:** `LineChart`, `BarChart`, `ProgressBar`, then `ChartFigure` (caption, key
    message, source slot and a data table in `<details>`) and `RangeToggle` (CSS-only 3 months /
    1 year / all).
  - **How they draw:** a stretched SVG with non-scaling strokes draws the lines, and HTML placed
    by percentage carries the labels and dots. So text stays readable from 320 px up without
    measuring anything in the browser.
  - **Hover:** native tooltips (`title`) on dots and columns stand in for the hover layer. The
    data table is the full accessible view.
- **`og/`**: share images. satori lays the card out, sharp writes a 1200 x 630 PNG at build time,
  and the text is set in the bundled Inter (OFL). Each image is a static endpoint made with
  `ogEndpoint()`.

**Tests:**

- `tests/contract/store.test.ts` and `schemas.test.ts` cover the store contract (validation
  errors, ordering, listing 5,000 runs) and the shared schema fixtures.
- `tests/unit/format.test.ts` covers formatting and the owner-value parsers.
- `tests/unit/chart-scales.test.ts`, `shell-components.test.ts` and `og.test.ts` run in Vitest,
  rendering components with Astro's container API.
- `tests/a11y/shell.spec.ts` runs Playwright and axe against `/shell-preview/`. That page exists
  only in a build with `SHELL_PREVIEW=1`.
