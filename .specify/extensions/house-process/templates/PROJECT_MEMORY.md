# Project Memory

Running context for this repo, kept in-repo so it survives conversation compaction/resets.
Update this as decisions get made — treat it as the source of truth alongside
`.specify/memory/constitution.md`.

## Vision

[One or two sentences: what this project is and why it exists.]

## Phasing

[If the project has distinct phases, list them here. Delete this section if not applicable.]

## Working norms

<!-- House defaults from sdd-playbook, learned across projects. Keep, adapt, or delete each one
     for this project, and add project-specific norms (pace/rigor, model choices, etc.). -->

- **Pull requests, not direct commits to `main`.** All changes go on a branch and are raised as
  a PR for the owner to review and merge. Coding agents don't push to `main` or merge their own
  PRs unless explicitly asked.
- **Draw requirements out with questions.** For the constitution, specs, clarifications and
  design decisions, the agent asks focused rounds of questions with recommended options rather
  than expecting the owner to supply everything up front.
- **Run spec-kit commands as real subagents.** `/speckit-*` commands are dispatched via the
  Agent tool to a subagent that follows the actual `.claude/skills/speckit-*/SKILL.md`, not
  simulated inline by the main conversation. Subagents can't converse with the owner, so the
  main conversation runs the question rounds first and passes the gathered answers in.
- **Model selection.** Routine work (spikes, implementation, well-scoped specify/tasks/implement
  runs) stays on the session's default model. Architecturally consequential steps (e.g.
  `/speckit-specify` or `/speckit-plan` on foundational pieces) get a per-call Opus override,
  flagged each time, rather than switching the whole session.
- **Research before choosing dependencies.** Verify a library/service is current and maintained
  (releases, deprecation notices, open issues) rather than picking from memory, and record the
  comparison in the decisions log.
- **Send lessons upstream.** When something learned here would help future projects, propose
  adding it to sdd-playbook (norms, templates, bootstrap script or `PLAYBOOK.md`).

## Decisions log

- **[DATE]** — [What was decided, and why. Add one entry per decision as they happen.]

## Open questions

- [Anything still undecided or deferred. Move resolved items to the decisions log above.]
- See `BACKLOG.md` for deferred/future work items.
