---
description: "Run a question round with the owner: draw out requirements and design decisions in focused rounds of up to four questions, each with a recommended option first, check stated facts against stored data, and record every answer with its reason in the decisions log. Use before a spec, plan or implementation phase, at a clarification, or whenever a decision is the owner's to make."
---

# Question round

House norm: **draw requirements out of the owner with questions.** The owner shouldn't have to
supply everything up front, or remember what's open. The agent works out what's undecided, asks
in short rounds with a recommendation for each, and records the answers so later sessions and
subagents build on them rather than asking again.

## Steps

1. **Find what's open.** From the request, the spec or plan's open questions, unticked PR boxes,
   and the decisions log (search it first: a past answer settles a question). Keep only real
   owner decisions: what visitors see, scope, wording, privacy, cost, priorities. Choices the agent
   can settle from the code, the docs or a convention are made, not asked; say them in one line.
2. **Prepare each question to stand on its own.** The owner may see only the question dialog, so
   name the items it's about and what was found. Two to four mutually exclusive options; the
   recommended one first, marked *(Recommended)*, with a one-line why in its description. Use an
   option's preview for things to compare visually (a layout sketch, wording side by side).
3. **Ask in rounds** of up to four questions (`AskUserQuestion`), most consequential first. Let
   later rounds follow from earlier answers rather than asking everything at once. Stop when what's
   left has a sensible default.
4. **Check stated facts** (figures, dates, names) against the stored data or a source before
   anything uses them, and confirm with the owner where they differ.
5. **Record the answers** straight away: one decisions-log entry per round, with the owner's words
   where they matter (quote them; briefs pass them on word for word), the option picked, whether
   it was the recommendation, and the reason. Private answers go to the project's private notes,
   with only a pointer in the public log.
6. **Hand them on.** A subagent can't ask the owner, so its brief carries the answers
   (`speckit.house-process.implement-brief`). A preference the owner states for all work goes to
   *Upstream candidates*.
