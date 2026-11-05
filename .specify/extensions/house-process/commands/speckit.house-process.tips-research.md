---
description: "Agent tips for research: reading a platform's terms first, product-specific API subscriptions, docs that need a real browser, and verifying what a form is for before sending the owner to it. Read before researching a platform, an API or a sign-up step for the owner."
---

# Agent tips: Research

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Read a platform's terms before testing a technical read.** A page's figures could be read
  from its HTML, but the terms ban scripts extracting data from the website, even from your own
  page. Read the terms first, and look for an official route the same day; here it was free and
  better.
- **A platform's general sign-up docs may not apply to its products.** Blackbaud SKY's
  getting-started said "Standard APIs", but JustGiving needs its own "JustGiving APIs"
  subscription, stated only inside a developer guide. Before guiding the owner to a key, find the
  product's own subscription steps.
- **Blackbaud's docs need a real browser.** `developer.blackbaud.com` and the SKY API reference
  return an empty shell to WebFetch and curl. Render them with Playwright's Chromium; the
  reference is at `developer.sky.blackbaud.com/api#api=<id>`. PDFs saved by WebFetch can be read
  with `uv run --with pypdf` when poppler isn't installed.
- **WebFetch summaries can misdescribe a page's purpose.** A summary called a charity's pay-in
  form a fundraiser sign-up form, and the owner was sent to it. Before sending the owner to a form
  or step, fetch the page with a prompt that asks what the form is for and quotes its fields, or
  say it's unverified.
