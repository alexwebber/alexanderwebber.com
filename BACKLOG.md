# Backlog

Deferred or future work, tracked here so it doesn't get lost or buried in the decisions log.
Each item: what it is, and why it's deferred. When something is picked up, move its entry to
the Decisions log in `PROJECT_MEMORY.md` and remove it from here.

- **Decide repo visibility (public vs private)** — a public repo showing a spec-first, AI-built
  site could be a CV piece. Deferred by owner; constitution Principle VI already requires the
  repo be kept safe to publish.
- **Set up Martlets fundraising page** for Brighton Marathon (2027-04-04) —
  https://www.martlets.org.uk/set-up-fundraiser/. Owner action; needed before the fundraising
  provider can be built.
- **Broader CI: full lint on every change.** Path-filtered PR test jobs were adopted on
  2026-10-04 (see the decisions log). Lint and the remaining full-suite runs are still deferred
  per the house default. Revisit once the shared surface area grows.
- **Fundraising spec (Running)** — Martlets via JustGiving for Brighton Marathon: total vs
  target, donate link, cached with last-known fallback. Next spec after Running; the Running
  landing page reserves a slot beside the Brighton hero.
- **Journey/story spec (Running)** — motivational/educational "couch potato to runner" story and
  videos, plus training-run photos. Running landing page links to it once it exists.
- **CV & Blog section** — phase 2, after Running.
- **Report Spec Kit 1.1.0 Windows issue upstream?** — PowerShell scripts prefer `python3` even
  when it's the Microsoft Store stub, and need PyYAML installed. Worked around locally
  (disabled app execution aliases, `pip install --user pyyaml`).
