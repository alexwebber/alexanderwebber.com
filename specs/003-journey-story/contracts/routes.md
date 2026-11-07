# Contract: Page, Landing Link, Menu and Previews

Extends Running's [routes contract](../../001-running-section/contracts/routes.md). Every wording example
is made up; the structural labels ("Story", "What I learned", "Chapters", "Back to chapters") are the
page's own, not story text (FR-039).

| URL | Page | Story | Notes |
|---|---|---|---|
| `/running/story/` | The story | US1, US2, US4, US5 | **Exists only once a chapter exists** (FR-001, FR-042). Otherwise it's the 404 page and not in the sitemap |
| `/running/story/#<chapter-id>` | A chapter | US4 | Stable for the chapter's life (FR-051) |
| `/og/running-story.png` | Share image | FR-075 | Same condition. Words only |
| `/running/` | Landing, with the story link panel | US3 | Panel only with `story_link` set; unchanged otherwise |
| `/story-preview/<state>/` | Test-only previews | All | `SHELL_PREVIEW=1` builds only (FR-078) |

## Route registry

`integration.ts` gains a `story` area, added second (after the landing) to `runningAreas` only when `journeyChapterIds()`
finds a chapter:

- label "Story", href `/running/story/`, description used only if `SectionLinks` lists it;
- after "Fundraising" in the menu (owner, #101), so it's last;
- routes `/running/story` (`pages/story.astro`) and `/og/running-story.png` (`og/story.png.ts`), injected
  only then, so the sitemap, the menu and the share image follow with no other change (SC-002).

`SectionLinks` skips an area whose `href` equals `story_link.href`, so "Story" isn't listed directly
under the story link panel that already leads there (research.md R8).

## The page (`components/StoryPage.astro`)

`SectionLayout` with `heading` = `page.yaml` `title`, `description`, `image` = `/og/running-story.png`,
`garmin={false}` (attribution sits at each figure, FR-014) and `lastUpdated={false}` (FR-071). In order:

1. **`<h1>`** the approved title. Nothing between it and the story but, at four or more chapters, the
   closed chapter list (FR-005).
2. **Chapter list** (`ChapterList.astro`, four or more chapters only): `<details class="story-chapters">`
   with `<summary>Chapters</summary>` and a `<ul id="story-chapter-list">` of links to `#<id>`, by
   chapter name. Closed by default. No numbers. From 64rem it's hidden, with each chapter's "Back to
   chapters", and the same links sit beside the text instead (`ChapterSidebar.astro`,
   `<nav aria-labelledby>` named "Chapters", first in the source, sticky; owner, 2026-11-07). From
   75rem the story's text is 18 px.
3. **Chapters**, oldest first (`StoryChapter.astro`), each:

   ```html
   <section class="story-chapter" id="chapter-a" aria-labelledby="chapter-a-title">
     <h2 id="chapter-a-title">Chapter A</h2>
     <p class="story-when"><time datetime="2001-03">March 2001</time></p>
     <p>Lorem ipsum <span class="story-figure">12.3 kg</span> <span class="story-source">(Garmin Index S2)</span> dolor sit amet.</p>
     <p class="story-figure-block">VO2 max, 15 Mar 2001: <strong>11</strong> <span class="story-source">Garmin</span></p>
     <!-- photos (US5), then the one place reserved for a future video (FR-053) -->
     <div class="story-takeaway">
       <h3 id="chapter-a-learned">What I learned</h3>
       <p>A made-up lesson.</p>
     </div>
     <p class="story-back"><a href="#story-chapter-list">Back to chapters</a></p>  <!-- 4+ chapters only -->
   </section>
   ```

4. **Closing section** (`StoryClosing.astro`), if approved: `<section aria-labelledby>` with its `<h2>`
   heading and paragraphs (FR-007).
5. **Note** (`StoryNote.astro`): one `<p class="story-note">`, after everything else, once (FR-008).

No Donate button, fundraising card, figure summary, chart or progress bar anywhere on the page (FR-002,
owner #101). No client JavaScript.

### Chapter parts

| Part | Contract | FR |
|---|---|---|
| Name | `<h2>`, plain text, never numbered | FR-003 |
| When | `<time>` with `datetime`; "15 Mar 2001", "March 2001", "March to September 2001", "March 2001 to February 2002" | FR-003, FR-077 |
| Prose | `<p>` per paragraph, escaped text; links as `<a data-chapter-link="<id>">` | FR-003, FR-015 |
| Inline figure | `text`, then `{' '}`, then `(Garmin <device>)`, `(Garmin)` or `(derived in part from Garmin device-sourced data)` in `.story-source`, the prose's size, secondary colour. Owner figures without `garmin` show no source | FR-011, FR-014 |
| Set-apart figure | A block after the paragraph before it: label, `as_of`, the figure, and the source on the same block. Smaller than the prose, never above the chapter's first paragraph | FR-010, FR-011, FR-014 |
| Photos | `<figure>` each, `Picture` (AVIF, WebP, JPEG fallback at 640 and 1280 px, lazy, sized), `alt` = `description`, visible `<figcaption>` = `caption`. None: nothing rendered | FR-060, FR-063, FR-064 |
| Video | One reserved place in `StoryChapter.astro`, after the photos and before the takeaway. Renders nothing now | FR-053, SC-013 |
| Takeaway | `<h3>What I learned</h3>` and one `<p>` in a box with a border on every side and a heavier start edge, so it's set apart by label and shape in light, dark and forced colours | FR-004 |
| Back link | Four or more chapters only | FR-052 |

### Layout and styles

- Phones first. Paragraphs, takeaways and figure blocks stop at `66ch` (FR-072). Long words wrap
  (`overflow-wrap: anywhere` on the prose), with no sideways scroll at 320 px.
- The page's rules live in `styles/story.css` under the `.story-` prefix, not in scoped `<style>`
  blocks, so repeated markup carries no per-element attribute and unrendered components can't reorder
  the page's CSS.
- Heading order: `h1` → `h2` (chapters, closing) → `h3` (takeaways). One `h1`.

## States

| State | What shows |
|---|---|
| No chapter | Nothing anywhere: no page, menu item, landing panel, section link, sitemap entry or share image (SC-002) |
| 1–3 chapters | Title, chapters, closing (if any), note. No chapter list, no back links (FR-052) |
| 4+ chapters | As above, with the closed list and back links |
| No closing section | The note follows the latest chapter directly, with no gap or placeholder (FR-007) |
| A chapter with no figures | Reads complete, with no empty space (US1.4) |
| A chapter with no photos | No frame, heading or gap (FR-060) |
| A photo that fails to load | Its alt text and the visible caption remain |
| Providers down, data stale | No change: the page reads no provider and shows no freshness |

## Landing page (`/running/`)

- `StoryLink.astro` is unchanged: the panel with `story_link.label`, in its place below this week and the
  latest run (spec 001, owner #101).
- The menu gains "Story" second, after Overview (owner, 2026-11-06). On a 360 x 780 phone with the fundraising card showing, Donate stays fully
  on the first screen, and no Running page scrolls sideways at 320 px (FR-043, SC-006).
- Nothing else on the landing page changes (FR-040).

## Share image (`og/story.png.ts`)

`ogEndpoint` with the approved `share_text` as the headline and the site name as the footer, in Running's
colours. No figure, photo or Garmin attribution. The page's `og:description` is `description`. Alt text
for the image is `share_text` (SC-012).

## Previews (test builds only)

`/story-preview/<state>/` renders the real `StoryPage` over `tests/fixtures/story-preview/<state>/` with
the repo's schemas (as the fundraising and race previews do). States: `one-chapter`, `three-chapters`,
`four-chapters`, `long` (12 chapters of about 600 words, photos in several), `figures`, `photos`,
`no-closing`, `same-day`. Made-up text from a fixed seed and generated images only (FR-078). The preview
menu is the real Running menu, so previews never add a "Story" item to deploy builds.
