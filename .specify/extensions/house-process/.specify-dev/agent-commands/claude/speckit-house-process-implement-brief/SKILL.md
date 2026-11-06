---
name: speckit-house-process-implement-brief
description: 'Write the brief for a Spec Kit subagent (implement, or specify, plan, tasks): the slice''s tasks, the skills it must load, the owner''s answers word for word, privacy limits, what it may push, and what it reports back (token cost, skill gaps). Use before dispatching any /speckit-* command to a subagent.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.implement-brief.md
---

# Brief a Spec Kit subagent

A subagent starts cold, can't ask the owner anything, and only does what its brief makes clear.
Most bad subagent output in past projects traced back to the brief: a paraphrased owner answer
that changed its meaning, a skill nobody named, a private file it shouldn't have read. The main
conversation writes the brief, dispatches it, and checks what comes back.

## Before writing it

1. **Run the question rounds first** (the norm *Draw requirements out with questions*). The
   subagent gets the answers, never the questions.
2. **Build the skills the slice needs.** Read the slice's tasks, then the project's skills
   (`.claude/skills/`) and its list of skill candidates (e.g. `process/skill-candidates.yaml`). A
   candidate whose `next` is this slice gets built now, in its own small PR or the slice's, before
   dispatch. Otherwise the subagent works from precedent files and the gap is noted.

## The brief

Write it in this order, as plain instructions:

1. **The command and scope**: which `.claude/skills/speckit-*/SKILL.md` to follow, the feature
   folder, the exact task range (e.g. T001–T023) and the phase header's *Goes live* and *How to
   view it* text. Say what's out of scope.
2. **Skills to load**, by name, each with the tasks it covers ("`owner-data-file` for T002–T006"),
   plus the house-process topic skills (`speckit-house-process-tips-*`) for the areas touched.
   A feature's graduation or polish slice names `speckit-house-process-graduation-review`.
   Ask it to follow each skill's *Done when* list.
3. **The owner's answers, quoted word for word**, with their dates, and the decisions-log entries
   the slice builds on. Never paraphrase an answer: "no one else in the family appears" became
   "names no one else" in one brief and reached the spec, where it banned crediting a published
   source.
4. **Privacy limits**: files and folders it must not read (private drafts, raw interview
   answers), words that must not appear, and "made-up fixtures only, from a fixed seed". The
   main conversation searches the output itself afterwards; the brief doesn't replace that.
5. **What it may do**: commit on which branch; push or not; raise the PR or stop for the main
   conversation's review. Default: commit on the slice's branch, run the PR routine's checks,
   and stop before pushing, so the main conversation reviews the diff, writes the PR body with
   *How to view it* and checkbox questions, and raises it.
6. **What to report back**, as its final message:
   - tasks done and ticked in `tasks.md`, and anything skipped or changed, with why;
   - choices it made that the owner should confirm (they become PR checkboxes);
   - **skill gaps**: for each skill used, any step it missed, got wrong, or didn't cover, with the
     fix; and any task it did by hand that a skill should cover;
   - lessons for *Upstream candidates* (workarounds, surprises);
   - the suites it ran and their results.
7. **Model**: the session's default; an override (e.g. Opus) only for an architecturally
   consequential step, said in the brief and to the owner.

## When it returns

1. **Log the token cost** from the Agent result with the slice in the decisions log, beside
   earlier slices' costs, so changes to briefs and skills can be compared.
2. **Apply the skill gaps** in the same PR: a lesson about how to do a task updates its skill.
   Add or count up skill candidates for tasks done by hand.
3. Add its lessons to *Upstream candidates*.
4. **Filter what it lists for the owner.** Keep only real owner decisions (not, say, a
   test-coverage choice the owner can't judge), and give each a recommended answer before it goes
   in the PR as a box. Unfiltered choices without recommendations sent the owner back to ask.
5. Read every new or changed file before pushing (privacy), then run the PR routine. If the
   subagent couldn't reach a private file a check needs (e.g. a private-terms list outside the
   repo, so its search was skipped), rerun that check here with the real file.

While it runs, and for follow-ups:

- **A notice that the subagent is waiting on its own background work isn't its report.** Check
  the branch (or the process list) for progress rather than calling it finished.
- **When a background script shares the checkout with it,** check the script's clean-up first
  (e.g. a post-merge tidy-up must skip the checked-out branch).
- **To apply follow-up fixes to its output** (e.g. analyze's findings on `tasks.md`), resume the
  same subagent with `SendMessage`, which already holds the docs, rather than starting a fresh one.