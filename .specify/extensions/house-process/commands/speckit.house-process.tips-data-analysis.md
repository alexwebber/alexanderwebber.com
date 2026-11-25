---
description: "Agent tips for analysing measurements and the owner's data: step changes from a recalibrated source, plotting a series' shape before summarising it, trend versus level and model ensembles, verifying a fix against what the owner sees, and scanning the whole history. Read before analysing a data series, writing a data correction, or answering the owner's question about their data."
---

# Agent tips: Data analysis

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Flag a step change in a series the day it happens.** A calibration value the owner typed
  into a source app silently shifted every later reading, and a goal could then have been met on
  the new readings alone. A data check that flags the step lets the owner hear of it before the
  site makes a claim from it (alexanderwebber.com).
- **Plot a measurement's shape over time before choosing the figure that summarises it.** A
  sensor's drift was reported as a rate per hour; the fitted curve showed a step in the first
  half hour and flat after, so the rate made long sessions look clean and pointed the cause the
  wrong way (alexanderwebber.com).
- **When a measurement needs "a better reference", separate the trend from the level first.** A
  step that the series' own readings measure can be joined at once, with no reference; only the
  true level waits for one. Averaging several AI models' estimates cancels their disagreement, not
  a bias they share: test such an ensemble against the reference before it sets anything.
- **Verify a data fix against what the owner looks at,** not only the figure the fix targets. A
  fix checked by end-minus-start numbers alone left the middle of a chart still sloped, which the
  owner's screenshot showed at once. An internal consistency test (the same spot read twice)
  found the real error and became the method (alexanderwebber.com).
- **When the owner asks "has this only started since X?", scan the whole history before
  answering.** One pass over the archive dated a fault months before the assumed start and ruled
  out the cause another assistant had suggested (alexanderwebber.com).
