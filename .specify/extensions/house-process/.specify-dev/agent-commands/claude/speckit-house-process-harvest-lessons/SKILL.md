---
name: speckit-house-process-harvest-lessons
description: Review recent work for lessons that should be sent upstream to the sdd-playbook (or global norms) instead of staying trapped in this project
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.harvest-lessons.md
---

# Harvest Lessons Upstream

Lessons learned in one project don't spread to the next unless someone moves them. This command
looks back over the work just completed and proposes which lessons should be sent upstream.

## Behavior

1. **Gather candidates.** Start from the **Upstream candidates** section of `PROJECT_MEMORY.md`
   — the primary source, captured in the moment, so it survives long sessions and context
   compaction. Then add anything else from what happened since the last harvest (or since the
   project started): the current conversation, recent decisions and working norms, and the
   spec/plan/implementation just produced. Look for things that would help a *future,
   unrelated* project:
   - process or workflow friction, and what resolved it;
   - tooling/environment gotchas (installs, OS quirks, Spec Kit behaviour, CLI flags);
   - working norms the owner stated or corrected;
   - gaps in the house templates, hooks or bootstrap script;
   - dependency/research lessons that generalise (e.g. "verify maintenance status").

   Also review `canaries.md` (if present). If a pattern holds across several canaries (not a
   single result), add a candidate to update the model-selection norm.

   **Then look at the process itself**, not only at lessons:
   - **Repeated procedures.** List the checks and routines the agent ran by hand in more than one
     session since the last harvest: session-start checks (fetch, alerts, red runs, version
     checks), post-merge checks (PR boxes, checks, `main`'s run to the end, deploy, live pages),
     the PR routine (privacy search, build-output comparison), dated follow-ups. Propose turning
     each into a script with a thin project skill that runs it and says how to act on the result,
     or extending one that exists. A script that would help any project is an SDD-general
     candidate for the playbook's `.specify/extensions/house-process/scripts/`.
   - **Skills.** Go through the skills used since the last harvest (the project's `.claude/skills/`
     and house-process's): were the skill gaps that subagents and handoffs reported applied? Is a
     skill unused for several phases (propose merging or removing it), out of date with the code
     it names (fix it), or general enough to help any project (propose moving it to house-process)?
     Then the project's skill-candidates list (e.g. `process/skill-candidates.yaml`): recount
     `times` from the phases since, propose building any task done twice or more by hand (with
     `next` set to the work that will need it), and add tasks this harvest's evidence shows were
     repeated.
   - **What every session loads.** Measure the files `CLAUDE.md` auto-loads (`PROJECT_MEMORY.md`,
     the constitution). Every session and every subagent pays for them on each run. If they're past
     about 40 KB, propose moving what's read rarely, usually the decisions log, to its own file
     read on demand (e.g. `DECISIONS.md`, with a pointer left behind), and trimming *Next session*
     to status and follow-ups.

2. **Classify each candidate** into exactly one destination:
   - **Global working preference** (applies to any project, SDD or not) → the owner's
     `~/.claude/CLAUDE.md`.
   - **SDD-general** → the sdd-playbook repo. Prefer encoding it where it applies
     automatically — a template (`PROJECT_MEMORY.md` working norms, `CLAUDE.md`, constitution
     preset), a hook/command, or `.specify/extensions/house-process/scripts/new-project.ps1` — and fall back to `PLAYBOOK.md`
     (Lessons, Windows gotchas, or the relevant procedure) only when it can't be automated. A
     technical tip for one area (a framework, CI, a host, a shell) goes in the matching topic
     skill, `commands/speckit.house-process.tips-<topic>.md`, or a new topic; a procedure any
     project repeats becomes a house-process command.
   - **Project-specific** → stays in this project's `PROJECT_MEMORY.md`; not sent upstream.
   Skip anything already captured upstream (read the playbook's templates and `PLAYBOOK.md`
   first).

3. **Present the list** to the owner: one line per candidate with its proposed destination and
   the concrete change (file + gist of the wording). If there are none (and the Upstream
   candidates list is empty), say so in one line and stop. Do not change anything until the owner picks which ones to apply.

4. **Apply the accepted ones:**
   - sdd-playbook: locate it as a sibling folder (`../sdd-playbook`) or clone
     https://github.com/alexwebber/sdd-playbook. Create a branch, make the changes (bump
     versions per its README if .specify/extensions/house-process/templates/extension/preset change), and raise a **pull
     request** — never commit to `main`.
   - Global `~/.claude/CLAUDE.md`: show the exact lines and add them only with the owner's
     agreement.
   - Add a one-line entry to this project's decisions log (in `PROJECT_MEMORY.md`, or the file it
     points to) noting what was
     sent upstream (with the PR link), so the next harvest knows where to start.
   - Remove processed entries from *Upstream candidates*: ones sent upstream, and ones the
     owner rejected or classified as project-specific (move those to the decisions log if worth
     keeping). Leave deferred ones in place.

5. Report what was applied and link any PRs.