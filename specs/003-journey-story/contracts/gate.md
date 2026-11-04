# Contract: Gate Additions

Two changes to the shared gate (`.github/actions/gate`, run by `gate.yml` and `refresh.yml`). Neither
touches section code.

## 1. `scripts/check-links.ts` (new)

```text
node scripts/check-links.ts          # after `astro build`, before the privacy scan
```

- **Scope:** every `.html` file in `dist/`. Every `href` that is a site path (starts with one `/`) must
  resolve to a built file: `<path>index.html` for a path ending in `/`, else the file itself. A `#anchor`
  on the story page must match an element `id` on that page.
- **Ignored:** external links (`https:`), `mailto:`, links into `/_astro/`, and the `/running/api/`
  Worker routes, which aren't files.
- **Output:** `error: <page file>: links to <path>, which the build didn't make`. For a link inside a
  chapter (`data-chapter-link="<id>"`), the message names the chapter instead of quoting its text.
  The path is printed because it's a site address, not story text.
- **Exit:** 1 on any finding, so the deploy doesn't happen and the live site stays as it was.
- **First run:** it must pass on today's site before the story is built. A dead link found there is
  fixed in the same slice.

**Tests:** planted dead links (a chapter link, a `story_link`, a missing anchor), a clean scratch build,
and the ignore list.

## 2. `scripts/scan-privacy.ts`: findings in story text are redacted

- Every finding in `data/running/owner/journey/`, `data/running/owner/stories/` or
  `dist/running/story/` prints `[<n> chars redacted]` in place of the match, whatever the rule, because
  the match there is a word of the story (FR-035).
- The rules still apply to those files, unchanged (FR-022). The fundraising-key exemption for
  `owner/stories/` stays as it is.

**Tests:** a planted rule match in each of the three places reports file, line, column and rule, and the
output doesn't contain the planted word.

## Gate order after this feature

`validate-data` → `scan-images` → `check-boundaries` → `astro build` (validation again at
`astro:build:start`) → **`check-links`** → `scan-privacy`.
