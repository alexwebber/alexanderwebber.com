---
name: speckit-house-process-tips-astro
description: 'Agent tips for Astro: stripped inline whitespace, failed builds emptying or partly rewriting dist/, import.meta.glob outside Vite, astro preview under a coding agent, Node floors in patch releases, date-driven page tests, client scripts, scoped-style bloat, building a site copy, chunk renames and CSS chunking changes in dist/ diffs, Astro.slots.has, script is:inline, and building main beside a branch. Read before changing Astro pages, components, config or builds.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-astro.md
---

# Agent tips: Astro

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Inline whitespace is stripped.** Astro removes line-break whitespace between inline
  elements, so `<span>163</span>` and `<span>days</span>` on separate lines render "163days".
  Add an explicit `{' '}`, and assert on text read from a real browser (a tag-stripping test
  helper hid it).
- **A failed build still empties `dist/`.** Astro 7 empties `outDir` before rendering, so a data
  error thrown while rendering wipes the last good build. Validate in an integration's
  `astro:build:start` hook. A check that can only run at render (a page's own data check) leaves
  `dist/` partly rewritten when it fails, so a drill that plants faults snapshots `dist/` before
  each build and restores it after.
- **Keep `import.meta.glob` out of modules that Playwright or plain Node also import.** It's
  Vite-only, so such a module throws at load outside Vite. Put the glob in a `.astro` file or a
  small module only Vite loads, and keep shared helpers glob-free.
- **`astro preview` runs in the background when it detects a coding agent** (`CLAUDECODE` set),
  so Playwright's `webServer` reports "exited early" locally while CI works. Clear
  `CLAUDECODE`/`AI_AGENT` in the web server's env, and stop strays with `astro preview stop`.
- **Patch releases can raise the Node floor** (7.4.2 did, for Node security releases), and only
  the release notes said so. Read core-framework patch notes too, and keep `engines` in step.
- **Testing date-driven pages:** render the whole page with the container API and fake only
  `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`), with no test hook in production code.
- **Client scripts that correct build-time values** (countdowns, "last updated") should do
  nothing while the build's value is still valid. One that rewrote text on every load caused
  half a page's blocking time through a forced relayout.
- **Style heavily repeated markup from a global stylesheet.** Astro adds its scoped-style
  attribute (`data-astro-cid-…`) to every element of a component with a `<style>` block, so a
  data table of about 1,800 rows carried it on every cell: 40% of the page's HTML. Use a global
  stylesheet under a class prefix for tables and lists.
- **An end-to-end check that needs its own build** (e.g. a stale-data drill) can copy `src/`,
  `public/`, the data and schema folders and the root configs into the test's output folder
  inside the repo. `node_modules` then resolves by walking up, Astro and Vite keep their caches
  beside the copy, and `astro build` takes seconds. Exclude that folder in `tsconfig.json`.
- **A `dist/` diff can show every page changed when only a chunk's name moved.** Rollup names a
  shared CSS chunk after the first module importing it, so dropping an import renamed
  `integration.<hash>.css` to `Base.<hash>.css` (same hash) on all 208 pages. Compare the file
  with `cmp`, normalise the name, then diff again.
- **`Astro.slots.has('x')` is true for `{cond && <C slot="x" />}` even when `cond` is false.**
  Test the empty case, or pass a prop.
- **`<script is:inline>` emits its content literally:** a `{`...`}` expression around the code
  reached the page as text. Write the JavaScript plainly inside the tag.
- **Small changes move CSS chunks; compare `dist/`'s file list and computed styles, not only the
  HTML.** Growing a shared stylesheet by a few bytes passed Vite's 4 KB inline limit and made a
  new render-blocking CSS file on some pages. A second page sharing a component removed a chunk
  file from two pages. A `<style>` in a newly imported component reordered a page's inlined CSS
  even though the component wasn't rendered: keep such a rule on the page.
- **To compare a branch with `main`, build `main` in a temporary `git worktree` under a
  gitignored folder outside `tsconfig`** (e.g. `spikes/<x>/out/`). It finds `node_modules` by
  walking up, and `astro check` doesn't scan the copy. Run the type generator there, then call
  Astro's bin by its relative path.