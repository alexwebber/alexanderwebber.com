---
description: "Close a phase or session: update the Next session block in PROJECT_MEMORY.md, log decisions and token costs, fix the skills that fell short, update the skill-candidates list, capture lessons, then tell the owner it's a good point for a new session. Use when a phase's PR is raised or merged, after context was compacted, or when the conversation has drifted across concerns."
---

# Hand off to the next session

Each session covers one phase or concern (the norm *One session per phase; the agent writes the
handoff*). The next session starts with only what `CLAUDE.md` auto-loads, so this is what it
knows. It also keeps the skills improving, because the end of a phase is when their gaps are
fresh.

## Steps

1. **Next session** in `PROJECT_MEMORY.md`, kept short (every session and subagent loads it):
   - **Status**: what merged and what's open, with PR links.
   - **First**: the session-start checks, then any post-merge checks for an open PR, then the
     next step itself, naming the skills and brief it needs.
   - **Waiting on others** and **at reviews** items carried forward; drop the ones that are done.
     A follow-up tied to a date goes to the project's dated triggers (e.g.
     `process/triggers.yaml`), not here.
2. **Decisions log**: one entry for the phase, with the owner's choices and the token cost of each
   subagent step ("implement subagent about 420k tokens").
3. **Skills**, while the work is fresh:
   - For each skill used: did it miss a step, say something wrong, or send the agent the long way
     round? Fix the skill now, in this PR. A lesson about how to do a task updates its skill.
   - For each task done by hand that a skill could cover: add it to the skill-candidates list, or
     count it up (`times`). Set `next` when planned work will need it. A project without a list
     starts one at `process/skill-candidates.yaml`:

     ```yaml
     - task: what is repeated, in a few words
       times: 2           # how often so far
       home: project      # or playbook, when it would help any project
       next: 003 Phase 2  # the work that next needs it (optional)
     ```
4. **Lessons**: anything worked around, corrected or surprising goes to *Upstream candidates* now,
   if it isn't there already.
5. **Commit** these with the phase's PR, or in a small docs PR if that one has merged.
6. **Tell the owner** in one line that it's a good point to start a new session, and that typing
   "continue" picks up from *Next session*. Quick follow-ups (review fixes, PR conflicts) stay in
   this session.
