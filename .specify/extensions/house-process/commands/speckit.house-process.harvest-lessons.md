---
description: "Review recent work for lessons that should be sent upstream to the sdd-playbook (or global norms) instead of staying trapped in this project"
---

# Harvest Lessons Upstream

Lessons learned in one project don't spread to the next unless someone moves them. This command
looks back over the work just completed and proposes which lessons should be sent upstream.

## Behavior

1. **Gather candidates.** Review what happened since the last harvest (or since the project
   started): the current conversation, recent `PROJECT_MEMORY.md` decisions and working norms,
   and the spec/plan/implementation just produced. Look for things that would help a *future,
   unrelated* project:
   - process or workflow friction, and what resolved it;
   - tooling/environment gotchas (installs, OS quirks, Spec Kit behaviour, CLI flags);
   - working norms the owner stated or corrected;
   - gaps in the house templates, hooks or bootstrap script;
   - dependency/research lessons that generalise (e.g. "verify maintenance status").

2. **Classify each candidate** into exactly one destination:
   - **Global working preference** (applies to any project, SDD or not) → the owner's
     `~/.claude/CLAUDE.md`.
   - **SDD-general** → the sdd-playbook repo. Prefer encoding it where it applies
     automatically — a template (`PROJECT_MEMORY.md` working norms, `CLAUDE.md`, constitution
     preset), a hook/command, or `scripts/new-project.ps1` — and fall back to `PLAYBOOK.md`
     (Lessons, Windows gotchas, or the relevant procedure) only when it can't be automated.
   - **Project-specific** → stays in this project's `PROJECT_MEMORY.md`; not sent upstream.
   Skip anything already captured upstream (read the playbook's templates and `PLAYBOOK.md`
   first).

3. **Present the list** to the owner: one line per candidate with its proposed destination and
   the concrete change (file + gist of the wording). If there are none, say so in one line and
   stop. Do not change anything until the owner picks which ones to apply.

4. **Apply the accepted ones:**
   - sdd-playbook: locate it as a sibling folder (`../sdd-playbook`) or clone
     https://github.com/alexwebber/sdd-playbook. Create a branch, make the changes (bump
     versions per its README if templates/extension/preset change), and raise a **pull
     request** — never commit to `main`.
   - Global `~/.claude/CLAUDE.md`: show the exact lines and add them only with the owner's
     agreement.
   - Add a one-line entry to this project's `PROJECT_MEMORY.md` decisions log noting what was
     sent upstream (with the PR link), so the next harvest knows where to start.

5. Report what was applied and link any PRs.
