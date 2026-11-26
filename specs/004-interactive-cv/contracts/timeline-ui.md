# Contract: the timeline's two forms

Both forms are in the built HTML. CSS shows one per width; the script enhances whichever is shown.

## Widths

| Width | Form |
|---|---|
| < 768 px | Phone drill, tiles in one column |
| 768 to 1023 px | Phone drill, tiles in two columns |
| >= 1024 px | Landscape swimlanes, with the drill's lists and cards beneath |

The form follows the width available, not the device (a phone held sideways at 915 px gets the drill).

## The drill (below 1024 px)

**Levels**:

1. **Overview** (`#cv`): a tile per theme in order (name; "N changes"; "N ★" if any; a strip of its changes
   packed into rows on the career scale), then under "Also": roles (a strip of roles), threads (count and
   line), next (count and line). One shared axis row above the tiles (first year, a middle year, the latest
   year, its last month). The last tick is `as_of`'s month in words (e.g. "Nov 2026"): the page's data date
   (constitution Principle V; owner, 2026-11-25), shown on both forms and without scripts.
2. **List** (`#theme-<id>` and the others): heading with the theme's colour mark, its line and count, the
   axis row, then one row per item oldest first: label; dates in words and duration; "★ Added value";
   "Thread: <name>" (in a theme) or the theme's name (in a thread); a one-row bar on the career scale.
3. **Card** (`#change-<id>`, ...): theme or "Role" or "Where next" as a label; the item's label as the
   heading; dates in words; the axis row and bar; the card text; for a value change, a panel linking to
   `#value-<story-id>`; for a change in a thread, "Follow this thread" (in the HTML a link to `#thread-<id>`; the script routes
   it to `#change-<id>-in-<thread>`, so every href in the built page resolves for check-links);
   inside a thread, "Thread · n of N" with the thread's strip and "See it in <theme>"; previous and next
   within the current list, each naming the item, disabled at the ends.

**Where you are**: from level 2 down, a breadcrumb is pinned under the section heading (sticky, clear of the
safe-area inset): a back control (44 x 44 px target) and `Themes › <list> › <item>`, the current item
truncated with an ellipsis, `aria-current="page"` on it, inside `<nav aria-label="Where you are in the
timeline">`. Back goes up one level; so do the browser's back button (hash history) and Escape.

**Focus and scroll**: going in, focus moves to the new level's heading (`tabindex="-1"`) and the section's
top is scrolled into view if it's above the viewport. Going back out, focus returns to the tile or row that
led in, scrolled into view (FR-013).

**Without scripts**: all levels render in reading order: overview, then each list, then each card, each
list and card with a "Back to themes" link; tiles and rows are anchor links. With scripts, only the current
level is shown.

## The landscape form (1024 px and up)

- One SVG: the axis (years, the latest year month by month, joined), roles across the top as bars with
  their labels, a lane per theme with its name, changes as bars or dots in packed rows, "next" at the right.
- Value changes carry a star shape and "(adds value)" in their accessible name; rough dates a dashed edge;
  ongoing bars an arrow.
- Labels where they fit (build-time placement); others in a tooltip on hover and focus.
- Each change, role and next item is an `<a href="#change-<id>">` (and so on) with an accessible name of
  label, dates and theme; activating it shows its card beneath the picture, in the same card component as the
  drill, with the same breadcrumb.
- Tab enters the picture at its first item; arrow keys move in time order (left/right) and between lanes
  (up/down); Enter opens the card.
- **Threads**: "Follow this thread" on a card lights the thread's items, dims the rest to 20%, and shows
  previous and next; Escape or "Done" ends it.
- **Zoom**: activating a role offers "Zoom to these years"; the x-axis then spans the role; "Whole career"
  and Escape zoom out. Labels are re-placed for the zoomed scale from data computed at build per role.
- **Escape** steps out one thing at a time on the landscape form: an open card closes first (focus back on
  its mark), then a followed thread ends, then a zoom resets. On the drill, Escape goes up one level.

## Motion

| Moment | Movement (motion allowed) | Reduced motion |
|---|---|---|
| First view, landscape | Sweep left to right, 2.5 s, labels fade in behind it | None |
| First view, phone | Each tile's strip grows left to right, staggered, 1.5 s total | None |
| Level change (phone) | Slide 24 px and fade, 0.2 s; backwards slides the other way | None |
| Card, thread, zoom (landscape) | 0.3 s | None |

The finished picture is the state without scripts. Any pointer down, wheel, scroll past the timeline or key
press ends the draw-in at once.

## Forced colours and print

- Forced colours: lanes stay told apart by their names and order, value by the star shape, threads by the
  thread panel's text; bars use `CanvasText`, the selection `Highlight`.
- Print: the no-script order prints (overview, lists, cards) with the landscape SVG on the first page, and a
  line pointing to the PDFs.
