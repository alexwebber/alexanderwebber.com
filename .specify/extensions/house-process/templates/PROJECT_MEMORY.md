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

- **The agent orchestrates.** The coding agent owns, remembers and runs all process (spec-kit
  steps, version checks, lesson capture, model canaries, follow-ups after PRs merge) and pulls
  what it needs from the owner. The owner contributes thoughts, experience and judgement, and is
  never handed a manual workflow to remember. Any owner input is folded into reviews they're
  already doing. If the agent can check something itself (e.g. whether a PR merged), it does.
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
- **Model selection, evolved by canaries.** Starting assumption: routine work (spikes,
  implementation, well-scoped specify/tasks/implement runs) stays on the session's default
  model. Architecturally consequential steps (e.g. `/speckit-specify` or `/speckit-plan` on
  foundational pieces) get a per-call Opus override, flagged each time. The agent tests and
  evolves this itself via `speckit.house-process.model-canary`: it reruns a step on another
  model when the owner is unhappy with an output, tries new models once per step type, and
  samples about 1 in 4 high-value steps. Results are logged in `canaries.md`, and norm changes
  are proposed only once a pattern holds.
- **Don't miss important updates.** Check the components in use for updates and adopt the ones
  that matter: new releases of core components (Spec Kit, the main framework, key libraries),
  security fixes that affect us, and fixes/features we'd benefit from. New dependencies start on
  their current release. Routine bumps of supporting tools that work fine can be skipped — the
  agent recommends rather than blanket-upgrading. Run sdd-playbook's `scripts/check-versions.ps1`
  at the start of a work session. A deliberate pin of a core component gets a decisions-log
  entry saying why.
- **Research before choosing dependencies.** Verify a library/service is current and maintained
  (releases, deprecation notices, open issues) rather than picking from memory, and record the
  comparison in the decisions log.
- **Capture lessons in the moment; send them upstream later.** Add a one-line entry to
  *Upstream candidates* below **immediately** — don't wait for a milestone — whenever the agent:
  works around a tool/environment problem; is corrected or told a preference by the owner; finds
  sdd-playbook wrong or missing something; or hits a procedure that behaved unexpectedly.
  Capturing is cheap and needs no approval. Sending upstream happens via
  `/speckit-house-process-harvest-lessons` (offered after `/speckit-plan` and
  `/speckit-implement`, or run any time), which proposes changes for the owner to approve.

## Decisions log

- **[DATE]** — [What was decided, and why. Add one entry per decision as they happen.]

## Upstream candidates

<!-- Lessons that might help future projects, captured the moment they happen (see the working
     norm above). One line each: date, what happened, and the suggested generalisation. The
     harvest command processes this list and removes entries once sent upstream or rejected. -->

- _None yet._

## Open questions

- [Anything still undecided or deferred. Move resolved items to the decisions log above.]
- See `BACKLOG.md` for deferred/future work items.
