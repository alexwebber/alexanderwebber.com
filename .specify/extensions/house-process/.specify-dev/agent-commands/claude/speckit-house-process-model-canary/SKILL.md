---
name: speckit-house-process-model-canary
description: 'Run a model canary: the same workflow step on two models, compared blind, so model selection evolves from evidence'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.model-canary.md
---

# Model Canary

Agent-run comparison of two models on the same workflow step. Model selection should improve
from evidence, not guesswork, **without the owner having to remember any process**. The agent
decides when to canary, runs it, keeps the log, and proposes norm changes. The owner's only
touchpoint is a quick A/B pick inside the review they're doing anyway.

## When the agent runs a canary (no prompting needed)

1. **Dissatisfaction (always).** The owner is unhappy with the output of a step (rejects it,
   asks for substantial rework, or says it isn't good enough). Rerun the step with an alternative
   model (usually a stronger one, or a different family) using the same inputs, and present both.
   This turns "not happy" into evidence at no cost when things are going well.
2. **New model (opt-in, once per step type).** A model is available that has never been
   canaried for this kind of step (e.g. a new release), on a high-value step
   (`/speckit-specify`, `/speckit-plan`, `/speckit-clarify`).
3. **Sparse sampling (opt-in).** On roughly 1 in 4 high-value steps, compare the default
   choice against a cheaper alternative, to find where a cheaper model is good enough.

**Usage budget.** A canary costs roughly 2–3.5× the step it repeats (two candidates plus a
judge), and the agent can't see how much of the owner's plan usage is left. So only trigger 1
is on by default. Triggers 2 and 3 run only when the project's norms opt in (i.e. usage headroom
is known to be comfortable). Before any canary, or any other big spend such as
`/speckit-implement`, ask the owner for a usage screenshot unless headroom is already known.

Mention each canary in one line ("canarying this step: Opus vs Sonnet, ~3x cost of this step").
Don't ask permission, unless the project's norms say cost needs approval.

## Procedure

1. **Same inputs.** Both candidates get identical inputs (the skill, the gathered question-round
   answers, the same repository state). Only the model differs (and effort level, where an
   agent definition supports it).
2. **Isolation.** Run each candidate as a subagent with the Agent tool's `model` override.
   Candidates that write files or create branches (e.g. `/speckit-specify` numbering a new
   feature) MUST run with `isolation: "worktree"`, so they don't collide. Run them in
   parallel. A fresh worktree has no `.specify/feature.json` (it's gitignored), so the
   orchestrator writes it into each worktree, or sets `SPECIFY_FEATURE_DIRECTORY`, before
   dispatching a step that needs the current feature.
3. **Blind judging.** A third subagent judges. It MUST be a model that is not among the
   candidates: a candidate's own model judging is self-preference bias. If no other model is
   available, skip the judge and rely on the owner's pick. It sees the outputs as **A** and
   **B** only, scores each
   against a rubric (the skill's own quality criteria, the project constitution, and fidelity
   to the owner's answers), and judges twice with the order swapped. If the two verdicts
   disagree, call it a tie. This counters length, position and self-preference bias.
4. **Owner pick, folded into review.** Present the judge's preferred output as the main thing
   to review, with a short "A/B: which reads closer to what you want?" question (show the
   key differences, not both documents in full). The owner's pick is ground truth. If the owner
   isn't engaged in this review, record the judge verdict only.
5. **Adopt the winner** in the main working tree and discard the other worktree/branch.
6. **Log it** by appending a row to `canaries.md` at the project root (create it with the
   header below if missing). Always fill in the token cost of each candidate and the judge
   (from the subagents' usage reports), so a canary's value can be weighed against its cost.
   Commit the log with the step's normal PR.

```markdown
# Model canaries

| Date | Step | Trigger | A (model/effort) | B (model/effort) | Tokens/cost A·B | Judge | Owner | Notes |
|------|------|---------|------------------|------------------|-----------------|-------|-------|-------|
```

## Closing the loop

`speckit.house-process.harvest-lessons` reviews `canaries.md`. When a pattern holds across
several canaries (e.g. "Sonnet matches Opus on `/speckit-tasks`"), it proposes updating the
model-selection norm. A cross-project pattern is proposed upstream to sdd-playbook; a
project-only pattern goes into the project's `PROJECT_MEMORY.md`. A single canary is an
anecdote, not evidence.