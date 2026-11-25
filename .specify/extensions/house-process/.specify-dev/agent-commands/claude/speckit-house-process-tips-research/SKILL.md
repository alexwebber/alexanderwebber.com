---
name: speckit-house-process-tips-research
description: 'Agent tips for research: reading a platform''s terms first, product-specific API subscriptions, docs that need a real browser, verifying what a form is for before sending the owner to it, trying a test environment''s existing items before calling it broken, shortlists that cover the whole brief, re-testing decisions when a new source arrives, listing sites and a retailer''s whole stock, per-variant specification sheets, a buyer''s own duties, vendors'' end-of-feature notices, and publishers that refuse automated reads. Read before researching a platform, an API, a purchase or a sign-up step for the owner.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-research.md
  version: 0.17.0
user-invocable: true
disable-model-invocation: false
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
- **Before calling a third-party test environment broken, try something already in it.** A
  sandbox's new pages vanished minutes after creation, but its existing shared test pages worked
  and accepted test payments. The agent gave up after one failed page; the owner found a working
  one.
- **A shortlist covers the whole brief before it's shown:** every category the owner named, and
  the cheapest tier that meets the need. A first table that was nearly all one category, and
  another that started above the cheapest tier, each sent the owner back to ask. Confirm in the
  first question round any requirement the use implies, score each requirement exactly as the
  owner worded it (something they called acceptable isn't a fail), and ask how they read the
  product's reviews before ruling an option in or out on them.
- **When a new kind of source arrives, re-test the decisions made without it.** Live listings
  replaced price guides, and the agent went straight to the leading option's listings; the owner
  had to ask for the others to be compared again.
- **Ask how a choice must feel in use, against what the owner has now,** before narrowing on
  features and price. A day after trying it, an owner dropped the agreed pick as sluggish next to
  what they already had.
- **Reading listing sites through a browser.** Search pages are often rendered in the browser, so
  a plain fetch has no results: navigate and read the DOM. The script tool may refuse output that
  holds a URL query string, and long output is cut, so return short rows. A filter on one
  variant's name can hide its sibling variants: scan the unfiltered pages.
- **To find what a shortlist is missing, read a retailer's whole stock,** not searches for the
  options already in mind. Retail search pages often carry their listings as JSON inside the
  page, so a small script reads every item under a price in a minute, and the same rows give
  price by age. Use one retailer for the scan and the whole market for the price: one retailer's
  only listing of a rare variant was far above the same item elsewhere, and briefly reversed a
  recommendation. Results sorted by price can mix in sponsored items from other models and above
  the cap: read every page and filter, never stop at the first item over the price. Some sites
  refuse requests after a few dozen pages, so save what's been read. An item's own page may read
  with a plain request even when the site's search needs a browser.
- **Features by variant come from a per-variant specification sheet,** not reviews or launch
  notes: a review's "standard on this version" was an option on the early sheet.
- **A purchase checklist built from the deal's side misses the buyer's own duties.** Keys,
  history and warranty were covered, but a legal duty that falls on the new owner wasn't. Check
  the official government guidance for what the buyer must do, not only what to ask the seller.
- **A vendor's own help page can carry a dated end-of-feature notice** that third-party how-to
  guides miss. Read it before recommending a set-up built on a free workaround.
- **Some publishers refuse automated reads** (a login redirect, a cookie gate: Nature and PubMed
  did). Take a paper's figures from search results or a repository copy, and say the full text
  wasn't read.