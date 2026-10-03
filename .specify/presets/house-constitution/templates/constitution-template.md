# [PROJECT_NAME] Constitution
<!-- House starting point (speckit-standards bundle). Replace with the actual project name. -->

## Core Principles

### [PRINCIPLE_1_NAME]
<!-- House default: I. Move Fast, Spike First -->
[PRINCIPLE_1_DESCRIPTION]
<!-- House default: Exploration and throwaway spikes MUST be allowed to proceed with minimal
     process — no mandatory tests, review, or documentation while code remains a spike. A spike
     is anything not yet depended on by another part of the system. The moment a piece of work
     graduates — another component starts depending on it, or it becomes shared/core plumbing —
     it MUST meet the graduation bar defined in the Development Workflow section below. Adapt
     "spike" and "shared/core" to whatever this project's actual units of work are. -->

### [PRINCIPLE_2_NAME]
<!-- House default: II. Guarded Iteration -->
[PRINCIPLE_2_DESCRIPTION]
<!-- House default: Fast iteration is only safe because of guardrails, not despite them. The
     following become non-negotiable exactly at Principle I's graduation boundary — not before,
     not after:
     (a) Solid test coverage of the component's documented contract/interface MUST exist by
         graduation time. This is coverage-alongside-implementation; strict test-first/TDD is
         explicitly NOT mandated.
     (b) If a component makes a non-deterministic or AI/LLM-driven decision, it MUST have a
         maintained divergence/eval suite (example inputs paired with expected outcomes) that
         MUST NOT regress before a behavioral change to that component ships. Delete this clause
         entirely for projects with no AI/ML-driven components.
     (c) Baseline error handling and structured logging/observability MUST exist, sufficient
         that failures are debuggable after the fact rather than silent.
     Rationale: "move fast and break things" is only sustainable if breakage is cheap to detect
     and cheap to diagnose — these guardrails cost nothing during exploration and apply exactly
     where a component's failures stop being contained to their author. -->

### [PRINCIPLE_3_NAME]
<!-- Add project-specific principles from here onward — this house preset only seeds the two
     principles above, which are the ones that generalize across projects. For patterns to draw
     from, see the upstream spec-kit template's own examples (Library-First, CLI Interface,
     Test-First, Integration Testing, Observability, Versioning, Simplicity), or a worked
     example of layering domain-specific principles (modularity, orchestration, multi-user) on
     top of this same house baseline at github.com/alexwebber/agents. -->
[PRINCIPLE_3_DESCRIPTION]

## [SECTION_2_NAME]
<!-- Example: Additional Constraints, Technology & Environment Constraints, Security Requirements -->

[SECTION_2_CONTENT]

## Development Workflow
<!-- House default section name for SECTION_3 — rename if this project needs something else. -->

[SECTION_3_CONTENT]
<!-- House default content to adapt:
     - Spikes are unconstrained: pure throwaway spikes/experiments need no design note, tests,
       or review for as long as they remain spikes per Principle I.
     - Graduation bar: anything promoted to shared/core status MUST receive, before other parts
       of the system depend on it: a short design note; solid test coverage of its documented
       contract; a divergence/eval suite if it drives non-deterministic/AI behavior (Principle
       II); baseline error handling and structured logging.
     - Review at graduation: the acting coding agent runs its own adversarial self-review before
       declaring something graduated to shared/core status; the human spot-checks rather than
       reviewing every line. Deliberate choice to keep solo/small-team development fast while
       still having a real review step, rather than either no review or a full manual-review
       bottleneck.
     - CI (automated lint/tests on every change) is deliberately deferred by default — not a
       compliance gap, tracked as backlog — to keep early iteration fast. Revisit once there's
       enough shared/core surface area to justify the setup cost. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]
<!-- House default: This constitution supersedes any conflicting ad hoc practice. The project
     owner is the sole final approver. Either the owner or an acting coding agent may propose an
     amendment — a coding agent SHOULD propose one when it hits friction with an existing
     principle while doing other work, rather than silently working around it. Amendments are
     made by re-running the constitution command, which regenerates this file and produces a
     Sync Impact Report the owner reviews before the amendment is treated as ratified. Standard
     semver bump rules apply: MAJOR for backward-incompatible principle removal/redefinition,
     MINOR for a new principle/section or materially expanded guidance, PATCH for wording or
     clarification only. -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
<!-- Example: Version: 1.0.0 | Ratified: 2026-07-26 | Last Amended: 2026-07-26 -->
