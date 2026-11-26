---
description: "Agent tips for docs, PDFs and print designs: rendering Mermaid diagrams locally before a PR, diagram direction for GitHub mobile, rendering PDF and Word files without poppler or LibreOffice, hyphens in Chrome's PDFs, pdftotext's layout, and print designs that fit their page. Read before adding or changing a diagram in Markdown, or making, reading or designing a PDF."
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
- **Rendering a PDF or Word file on Windows without poppler or LibreOffice:**
  `pip install --target <scratchpad> pymupdf` and a small script render PDF pages to PNG, and with
  Word installed, `Documents.Open(...).ExportAsFixedFormat(out, 17)` over COM makes the PDF.
  `pdftotext` drops a form's selected options (alexanderwebber.com).
- **Chrome's PDFs break lines at hyphens, and text extraction then joins the halves**
  ("customer-data" became "customerdata"). Keep hyphenated words unbroken (`white-space: nowrap`)
  in anything a parser will read.
- **`pdftotext -layout` can lay a label a line away from its figure.** Check one extracted value
  against an arithmetic total in the same document before tabulating.
- **Let a fixed-size design size its own type, and print the figure.** A one-page design chosen
  from a mock-up drifted as review rounds lengthened the text, until it only fitted at 8.26pt. A
  build that sizes the type to fit and prints it makes the cost of words a number the owner can
  trade; check each block against its budget before the design build. For SVG print designs,
  wrap and pack text in the browser after `document.fonts.ready` (measured widths), and give the
  page a `?check` flag that turns any text past its line or row budget red, so the agent's own
  screenshots show every collision first.
