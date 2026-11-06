---
description: "Run a feature's graduation: the house constitution's bar (design note, contract tests, eval suite, error handling and logging) unit by unit, the quality bars measured (Lighthouse, axe and the rest), an adversarial self-review with findings proven and triaged, the quickstart run, and a PR that reports it all. Use for a feature's graduation or polish phase, or whenever a unit goes live, becomes shared, or something starts depending on it."
---

# Graduation review

The house constitution lets spikes skip process until they **graduate**: they go live, become
shared, or another part starts depending on them. At that moment they must meet the *graduation
bar*, and the acting agent runs its own *adversarial self-review* before declaring them graduated;
the owner spot-checks the result rather than reviewing every line. This skill is that step. It
usually runs as a feature's last implement slice, by the subagent the brief names it in, with the
main conversation checking what comes back.

Every past review found real faults the slices' own tests had passed: a value that rounded to its
target and read as reached, a progress bar showing 100% at 99.7%, a pipeline that after a failed
deploy compared against the repo instead of the live site, a corrupt state file that failed
silently inside a `continue-on-error` step, a processor change that needed a manual rerun no
workflow did, tests that only worked on one platform. They sit at edges and in shared plumbing,
and they show at exactly the moment the owner is watching most closely. The review exists to find
them first.

## Inputs

- The constitution's *Graduation bar* and *Review at graduation*, and its principles.
- The plan's graduation table (unit → the bar delivered with it), its performance budget and its
  constitution check.
- The spec's functional requirements and success criteria: the hardest ones are the review's
  targets.
- The slice's tasks, the quickstart, and the decisions-log entries for the feature.

## Steps

1. **List the units graduating** (from the plan's graduation table) and, for each, check the bar
   item by item, with evidence, not recollection:
   - **Design note**: short, in the place the project keeps them (a section's README beats a
     separate document). It says what the unit reads and shows; how it behaves when its data is
     bad, missing or stale; how to add, change and remove things; its tests and drills; its known
     limits; and the graduation figures. No private or unapproved content.
   - **Contract tests**: the documented interface is covered (schemas with valid and invalid
     fixtures, adapters' normalised output, storage). Name the test files.
   - **Eval suite** for anything non-deterministic or AI-driven, with owner-approved outputs.
   - **Error handling and structured logging**: every failure has a code and a message that says
     the likely cause and the action, logs are structured and scrubbed, and an unattended job's
     failure alerts rather than going silent.
2. **Measure the quality bars** and keep the figures for the PR:
   - **Performance** on the deploy build, mobile, with the plan's budget: score, LCP, page weight,
     script files, third-party requests. Add each new page type to the budget script, skipped
     until the page exists, so the scheduled run checks the real page from launch. Pages that
     only exist as test previews are measured by the same script, given their paths (add a
     `--path=` option if it lacks one), not by hand. If the script's page weight counts only HTML,
     CSS and JS, also report Lighthouse's total byte weight for a page with images: lazy images
     load nothing at first. A score near
     the line on a shared CI runner is noise until shown otherwise: judge on the median of three,
     and find the real cost (a script forcing a relayout after first paint) rather than retrying.
   - **Accessibility**: zero axe violations in every preview state, light and dark; usable in
     forced colours; no sideways scroll at the narrowest width (320 px); the keyboard reaches every
     control; all content without JavaScript.
   - **SEO and sharing**: every page has a unique title, description, canonical URL and share
     image.
   - **Boundaries**: shared code is untouched unless the plan says otherwise, and the project's
     boundary check passes. If a finding's right fix is in shared code, make it there, rerun the
     boundary check, and give it its own checkbox (step 4). Don't bend the fix to leave shared
     code untouched.
3. **The adversarial self-review.** Write the attack questions **before** reading the code, from
   the principles and the hardest success criteria; then try to make each one happen. Questions
   past reviews needed:
   - **Every path, not the main one**: each build path (the store, validation, a plain build, a
     preview), each workflow route (scheduled, manual, after a failed run, queued behind another).
     Can any of them publish something unapproved, stale or changed?
   - **Edges of values**: a figure that rounds to its target, a fraction that rounds up to 100%, the
     first and last item, none at all, the maximum allowed. Does the wording still tell the truth?
     Is an empty or comment-only file treated as "no data yet" where it should be an error?
   - **Malformed input**: can input make a parser library throw instead of report (YAML's `*word`
     is an alias; one naming no anchor threw, quoting the word), so the stack trace carries
     content?
   - **Permanent identifiers**: can an anchor, slug or id the owner sets collide with another on
     the page or site, when it can never change once published?
   - **Failure means staleness, never an outage, and never silence**: a provider down, a corrupt
     state file, a failed deploy, a step inside `continue-on-error`. Does the next run heal it,
     does someone get told, and does the page still show when its data was last updated? Does
     owner content cite records a bot publishes, so a later bot change stops every deploy, and
     who hears about it?
   - **What leaks**: can any message, warning, log line or error quote private or unapproved
     content, a secret or an identifier? Can a new published field go out without the owner's
     approval? Can a file's metadata (EXIF, GPS) reach git? Can a stray file beside the listed
     ones (an unlisted photo) reach the public repo without approval?
   - **Changes that need a manual step**: a processor or schema change that existing data only
     picks up after a command no workflow runs (put a version in the input hash instead).
   - **Platform and environment**: do the tests and scripts run where the next session will run
     them (Windows and Linux, local and cloud, with and without secrets)? Do date tests pass in a
     far time zone (`Pacific/Kiritimati`, `America/Los_Angeles`)? On Windows set `$env:TZ` from
     PowerShell, because Git Bash doesn't pass an IANA `TZ` through to Node.
   - **Dependencies**: open advisories, a pinned version's reason still true, a framework's new
     runtime floor.

   **Prove each answer**: a test, a drill on a scratch copy with the fault planted and then
   removed, or a command's output. Reading the code is a lead, not evidence. A check you rely on
   is shown failing on a planted case before it's trusted. Keep the questions as first written
   (a scratch file), so the PR lists them in that order with their answers. Many "can it deploy"
   questions are best proven together by a drill script that plants one fault at a time on a
   scratch copy, with a sentinel word in every text field, printing one line per fault.
4. **Triage the findings** into a table: finding, severity, outcome.
   - **Medium or worse**: fix it in this PR, with a test that fails without the fix.
   - **Low or cosmetic**: leave it with the reason (it heals at the next run, the cost is bounded),
     or move it to the backlog. The owner confirms leaving them, in one checkbox.
   - **A behaviour change to something shared** (a workflow another section uses) gets its own
     checkbox, because it reaches beyond the feature.
   - Keep a *checked and found fine* list too, each with its evidence: it shows the owner what the
     review covered, not only what it found.
5. **Run the quickstart.** Every scenario that can run here gets a *Result* line; one that needs
   secrets or CI says so and where it was proven before. Fix any text that differs from what was
   run.
6. **Run every suite**, on every test project, and keep the counts (passed, skipped by design).
   If the session lacked secrets for a check (a privacy scan's ID map), say so; the PR's own gate
   runs it.
7. **Write the PR body**, by the project's PR routine:
   - *How to view it*: usually "nothing visible changes", with the live URLs that stay as they are,
     or what a behaviour change shows and where (a run's log line).
   - *What's in it*: the drills, the quality-bar figures as a table, the docs, and the built site
     compared with the base branch's (files identical, changed, added), if the project compares
     them.
   - *Graduation review*: the attack questions in the order written, each with its answer and
     proof (or a pointer to them in the decisions log), then the findings table and the *checked
     and found fine* list.
   - *Tests*: a table of suites and counts.
   - *Please confirm*: one checkbox per real owner decision, each with a recommended answer. A
     success criterion that needs people (a usability or hallway test) is offered as run-or-skip,
     with a ready script if run.
   - *Next*: what's left before the feature is done (the content PR, go-live).
8. **Record it** in the decisions log: the findings and their outcomes, the choices later work
   builds on, the figures, and the subagent's token cost. Remove backlog entries the feature
   finished.
9. **After the merge**: read the next scheduled quality run (it now checks the new page types),
   and offer the lesson harvest; the feature has reached a milestone.

## Done when

- [ ] Every graduating unit has its design note, contract tests, eval suite if needed, and error
      handling and logging, each with evidence.
- [ ] Performance, accessibility, SEO and boundaries are measured, with figures in the PR.
- [ ] The attack questions were written first, each answered with a test, drill or output, and
      they appear in the PR in the order written.
- [ ] Medium-or-worse findings are fixed with a failing-first test; the rest are left with reasons
      or in the backlog, and the owner has one checkbox for them.
- [ ] The quickstart scenarios have *Result* lines; the suites' counts are in the PR.
- [ ] The decisions log has the review, and the backlog is tidied.
