---
description: "Agent tips for web maps: maplibre-gl 6's worker URL under a bundler, and lazy-loading the library on click. Read before adding or changing an interactive map."
---

# Agent tips: Maps

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **maplibre-gl 6 loads its worker from `./maplibre-gl-worker.mjs` beside its own module**,
  which a bundler moves. Import the worker and stylesheet with Vite's `?url`, call
  `setWorkerUrl()`, and lazy-import the library on click, so the page loads only a small loader
  (about 1.6 KB gzip).
