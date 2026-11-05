---
name: speckit-house-process-tips-ui-accessibility
description: 'Agent tips for UI and accessibility: short labels that mustn''t wrap, keyboard-path tests, visually-hidden inputs, and round chart dots on a stretched SVG. Read before changing page layout, CSS toggles, charts, or keyboard and screen-reader behaviour.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-ui-accessibility.md
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