---
description: "Agent tips for docs: rendering Mermaid diagrams locally before a PR, and diagram direction for GitHub mobile. Read before adding or changing a diagram in Markdown."
---

# Agent tips: Docs

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Render Mermaid diagrams before a PR with mermaid-cli and Playwright's Chromium:**
  `npx @mermaid-js/mermaid-cli -p pp.json`, where `pp.json` gives `executablePath` with forward
  slashes (backslashes are invalid JSON escapes). Run the renders one after another, because
  parallel runs collide on puppeteer's profile lock.
- **Mermaid flowcharts with subgraphs read better top-to-bottom on GitHub mobile.** A
  left-to-right overview was about 1,400 px wide. Inner `direction` is ignored once a subgraph
  links outside itself.
