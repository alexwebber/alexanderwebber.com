---
description: "Guide the owner through what a phase put live, page by page on a phone and then a desktop, with a question round on what they saw, and record the outcome. Use at the start of the session after a phase that changed visible pages has merged and deployed, or whenever the owner asks to review the live site."
---

# Guided review of the live site

The owner sees the real thing, not a description of it (the norm that every UI PR has a *How to
view it* section). After a phase ships pages, the next session starts with a short guided review.
The agent prepares it, so the owner spends a few minutes looking rather than working out what to
check.

## Steps

1. **Confirm it's live.** The post-merge checks showed the deploy finished, and each page answers
   200 with a phrase the change put there. Never point the owner at a page before that.
2. **Prepare the walk** from the PR's *How to view it*: each URL, then two to four specific things
   to look at on a phone, then on a desktop (wrapping at a narrow width, a figure against its
   source, dark mode, a link's target). Say what isn't built yet, so it isn't reported as missing.
   Add the project's standing review items (e.g. an *At reviews* list in `PROJECT_MEMORY.md`).
3. **Walk it with the owner** one page at a time: a numbered list per page, short enough to
   follow on a phone. Ask them to report what they saw, not to tick everything.
4. **Question round** on what they reported (`AskUserQuestion`, recommended option first): what to
   fix, wording, what matters most. Facts the owner states (figures, dates) are checked against the
   stored data before anything uses them.
5. **Record it**: an entry in the decisions log (what was reviewed, on which devices, the answers);
   fixes as tasks or a small PR; owner preferences and surprises as *Upstream candidates*.
6. If the owner can't review now, keep it at the top of *Next session*.
