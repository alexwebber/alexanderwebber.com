# Shared plumbing

The only code sections share (constitution Principle VII). `scripts/check-boundaries.ts` fails the
gate if anything here imports a section. The full graduation note comes with T086; this covers the
shell (Phase 2h).

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
- **`format/`**, **`storage/`**: UK formatting and the `RunningStore` read interface (Phase 2a–2b).

**Tests:**

- `tests/unit/chart-scales.test.ts`, `shell-components.test.ts` and `og.test.ts` run in Vitest,
  rendering components with Astro's container API.
- `tests/a11y/shell.spec.ts` runs Playwright and axe against `/shell-preview/`. That page exists
  only in a build with `SHELL_PREVIEW=1`.
