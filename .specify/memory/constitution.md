# alexanderwebber.com Constitution

## Core Principles

### I. Move Fast, Spike First

Exploration and throwaway spikes MUST be allowed to proceed with minimal process — no mandatory
tests, review, or documentation while code remains a spike. A spike is anything not yet depended
on by another part of the site. In this project the units of work are **site sections** (e.g.
Running, CV, Blog), **provider adapters**, **ingest jobs**, and **shared plumbing** (layout,
design system, storage layer). The moment a piece of work graduates — it goes live on
alexanderwebber.com, another section or job starts depending on it, or it becomes shared
plumbing — it MUST meet the graduation bar defined in the Development Workflow section.

### II. Guarded Iteration

Fast iteration is only safe because of guardrails, not despite them. The following become
non-negotiable exactly at Principle I's graduation boundary — not before, not after:

- **(a)** Solid test coverage of the component's documented contract/interface MUST exist by
  graduation time (e.g. provider adapters' normalised output, storage interface, data schemas).
  This is coverage-alongside-implementation; strict test-first/TDD is explicitly NOT mandated.
- **(b)** Any component making a non-deterministic or AI/LLM-driven decision — notably AI
  drafting of posts, race reports, and CV text under Principle VIII — MUST have a maintained
  divergence/eval suite (example inputs paired with owner-approved outputs) that MUST NOT
  regress before a behavioural change to that component ships.
- **(c)** Baseline error handling and structured logging MUST exist, sufficient that failures
  (especially in unattended ingest jobs) are debuggable after the fact rather than silent.

Rationale: "move fast" is only sustainable if breakage is cheap to detect and cheap to diagnose.
These guardrails cost nothing during exploration and apply exactly where a component's failures
stop being contained to their author.

### III. Own Your Data

Data flows **ingest → store → render**:

- Scheduled jobs MUST pull from external providers incrementally (only what is new since the
  last successful run) and persist results to the site's own store, retaining full history.
- Pages MUST render from the site's own stored data. No visitor request may depend on a
  third-party API being available.
- The initial store is versioned JSON files in git. This MAY remain the permanent store if it
  stays adequate; moving off it requires a plan-level justification, not a constitution change
  (see Principle IV).

Rationale: providers do not serve the aggregates the site needs (trends, PB history, totals),
impose rate limits, and have outages. Owning the data makes the site fast, durable, and
independent of any one platform.

### IV. Pluggable Providers & Storage

- Every external source (Garmin Connect, fundraising platforms, future sources) MUST sit behind
  a provider adapter that maps provider-specific data into the site's own normalised schemas.
  Nothing outside an adapter may depend on a provider's raw format.
- Persistence MUST sit behind a storage abstraction so JSON-in-git can be replaced (e.g. by a
  database) without changing sections or adapters.
- Provider failure (auth breakage, API change, rate limiting) MUST only cause staleness, never
  an outage or a broken build.

Rationale: the Garmin integration relies on an unofficial client that will break periodically;
isolation keeps repairs local and lets sources be swapped or added.

### V. Serverless, Gracefully Degrading

- Serverless functions and scheduled jobs are permitted. Long-running servers and self-managed
  databases are NOT, unless introduced by constitution amendment.
- Running data MUST be refreshed within a few hours of activity (scheduled ingest every 1–3
  hours) and support a manual "refresh now" trigger.
- Live-ish values (e.g. fundraising totals) MUST be cached and fall back to the last known value.
- Every data-driven view MUST show when its data was last updated and MUST still render if its
  source is stale or broken.
- There are no user accounts or logins. Administration happens through git/GitHub.

Rationale: keeps hosting simple and cheap to operate while still allowing the regular,
multi-source refreshes the site needs.

### VI. Privacy by Default

- **Public by intent:** race results and PBs, training totals, individual runs, health metrics
  (e.g. weight), and performance metrics (e.g. VO2 max, training status).
- **GPS maps MUST only be shown for races**, never for training runs. Data that would reveal
  home or routine locations MUST be excluded at ingest or render time.
- Any data category not listed above MUST be explicitly approved by the owner before it is
  published.
- Secrets (tokens, credentials) MUST never be committed. The repository MUST be maintained as if
  it could be made public at any time: nothing may be committed that is not already intended to
  be public on the site.

Rationale: the site publishes personal data; safe defaults and an explicit allow-list prevent
accidental exposure.

### VII. Modular Sections, Distinct Identities

- Each top-level concern (Running, CV, Blog, and future sections) MUST be a self-contained
  module owning its pages, data schemas, and providers. Only the layout, design system, and
  storage layer are shared.
- Adding or removing a section MUST NOT require changes inside other sections.
- **Running** is warm and personal (friends, family, sponsors, fellow runners). **CV & Blog**
  are professional (recruiters, engineering peers). Each section keeps a clear identity within
  one coherent site.

Rationale: the site will grow beyond its first two concerns; modularity keeps each addition
cheap and keeps the two audiences well served.

### VIII. Authentic Voice

- AI MAY draft or edit posts, race reports, and CV text, but such content MUST NOT be published
  without the owner's explicit approval.
- Content MUST NOT invent achievements, results, or statistics. Facts come from stored data or
  the owner.
- Edits made during approval MUST be captured into a living voice style guide (`VOICE.md`), so
  drafting quality improves over time. Delegating approval to AI in the future requires a
  constitution amendment, justified by the Principle II(b) eval suite.

Rationale: the blog and CV exist to build professional credibility; authenticity is the asset,
and a measured path to delegation preserves it.

## Quality Bars & Technology Constraints

**Quality bars** — non-negotiable for anything live:

- **Mobile-first & fast:** designed for phones first; each feature plan MUST set a performance
  budget (e.g. Lighthouse performance ≥ 90 on mobile) and keep client-side JavaScript minimal.
- **Accessible:** WCAG 2.2 AA, including charts (text alternatives, sufficient contrast, keyboard
  access).
- **SEO & social previews:** meaningful titles and descriptions, and Open Graph images so shared
  links preview well.
- **Graceful degradation:** per Principle V.
- **Visualisations over walls of text:** progress, trends, and comparisons SHOULD be presented
  visually first, with prose in support.

**Technology constraints:**

- Site: a TypeScript static-site framework (Astro favoured), hosted on Cloudflare (Pages/Workers).
- Ingest jobs: Python permitted (Garmin access via `python-garminconnect`), scheduled with GitHub
  Actions or Cloudflare cron triggers.
- Domain: alexanderwebber.com, registered at Namecheap.
- Cost is not a constraint — choose on merit; plans MUST note any recurring costs.
- Library and detail choices are made in each feature's plan.

## Development Workflow

- **Spikes are unconstrained:** pure throwaway spikes/experiments need no design note, tests, or
  review for as long as they remain spikes per Principle I.
- **Graduation bar:** anything going live or promoted to shared status MUST receive, before
  others depend on it: a short design note; solid test coverage of its documented contract; a
  divergence/eval suite if it drives non-deterministic/AI behaviour (Principle II); baseline
  error handling and structured logging.
- **Review at graduation:** the acting coding agent runs its own adversarial self-review before
  declaring something graduated; the owner spot-checks rather than reviewing every line.
- **Build gate from day one:** every push and every automated ingest commit MUST pass a site
  build and data-schema validation before it can deploy. This is a deliberate exception to the
  house default because unattended ingest commits can otherwise break the live site.
- **Broader CI** (full lint/test suites on every change) remains deferred, tracked in the backlog,
  and revisited once there is enough shared surface area to justify it.

## Governance

This constitution supersedes any conflicting ad hoc practice. The project owner is the sole
final approver. Either the owner or an acting coding agent may propose an amendment — a coding
agent SHOULD propose one when it hits friction with an existing principle while doing other
work, rather than silently working around it. Amendments are made by re-running the
constitution command, which regenerates this file and produces a Sync Impact Report the owner
reviews before the amendment is treated as ratified. Versioning follows semver: MAJOR for
backward-incompatible principle removal/redefinition, MINOR for a new principle/section or
materially expanded guidance, PATCH for wording or clarification only. Feature plans MUST
include a constitution check against these principles.

**Version**: 1.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-03
