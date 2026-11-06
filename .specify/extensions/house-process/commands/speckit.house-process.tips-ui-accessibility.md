---
description: "Agent tips for UI and accessibility: short labels that mustn't wrap, keyboard-path tests, visually-hidden inputs, round chart dots on a stretched SVG, 320 px overflow from nowrap and hidden labels, stretched grid items, focus in sideways lists, target size under a summary, time ranges, target labels, and what only screenshots catch. Read before changing page layout, CSS toggles, charts, or keyboard and screen-reader behaviour."
---

# Agent tips: UI and accessibility

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Keep short labels with hyphens or dates on one line** (`white-space: nowrap`). "sub-43:00"
  broke after the hyphen on a phone, and tests passed; only a screenshot showed it. Look at a
  phone-width screenshot before raising a UI PR.
- **Keyboard-path tests key focus stops on `href` plus link text.** De-duplicating by `href`
  alone stopped early, because the site name and the footer both link to `/`.
- **Always hide `input.visually-hidden`, even when focused.** The common
  `.visually-hidden:not(:focus):not(:active)` rule (meant for skip links) reveals a hidden radio
  when its label is clicked, because the radio takes focus. In CSS-only toggles a native radio
  popped in and shifted the options.
- **Chart dots on a stretched SVG** (`preserveAspectRatio="none"`): draw each as a zero-length
  segment (`M x y h0`) with round caps and `vector-effect: non-scaling-stroke`, all in one path.
  They stay round at any aspect ratio, and hundreds of readings cost one element.
- **Check the 320 px fit in every state, not only the one in front of you.** A `white-space:
  nowrap` date beside a heading pushed one preview state into sideways scrolling; the active
  state looked fine. A "fits 320px" test across every state caught it.
- **Hidden labels still take up layout.** Minor axis labels with `visibility: hidden` at a
  chart's edge widened the page at 320 px though nobody saw them. Find these by walking text
  nodes' ranges, not element boxes.
- **A percentage height on a shared card shell resolves against a stretched grid item,** so a
  card placed lower in the grid overflowed. Every test passed; only a phone screenshot caught it.
- **In a sideways-scrolling list, set `scroll-padding-inline` to the gutter and fade.** Chrome
  treats a link with a sliver showing at the edge as in view and doesn't scroll, so a keyboard
  user sees a faded fragment. Only a Tab-through test found it.
- **A short inline link right under a `<summary>` fails axe's `target-size`** (WCAG 2.2): its box
  is only the text's height. `display: inline-block` makes the line height the target. Run axe
  with each `<details>` open.
- **`<time datetime>` has no range form.** A period is two `<time>` elements joined by text.
- **On a chart climbing towards a target, label the target line at its start;** at the end the
  label collides with the last point.
- **Look at a screenshot of every changed page.** A page that dropped the standard line under its
  `<h1>` ("Last updated") left the next heading reading as a subtitle. Every test passed; only the
  screenshot showed it.
