---
name: speckit-house-process-scaffold-memory
description: Create PROJECT_MEMORY.md, BACKLOG.md and CLAUDE.md from the house templates if they do not already exist
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.scaffold-memory.md
---

# Scaffold House Process Files

Create the three house-style process files at the repository root, if they don't already exist.

## Behavior

1. **`PROJECT_MEMORY.md`** — a running, in-repo decisions log that survives conversation
   compaction/resets. If it does not already exist at the repository root, copy
   `.specify/extensions/house-process/templates/PROJECT_MEMORY.md` there, then replace its
   `[PROJECT_NAME]`-style placeholders with real content derived from the constitution you just
   ratified (and from the surrounding conversation, if it has more context than the constitution
   alone captures). Keep the file's section structure (Vision, Phasing, Working norms, Decisions
   log, Open questions) intact — delete a section only if it genuinely doesn't apply, per the
   template's own inline guidance.

2. **`BACKLOG.md`** — a flat list of deferred/future work, kept separate from the decisions log
   so historical decisions and forward-looking todos don't get mixed together. If it does not
   already exist, copy `.specify/extensions/house-process/templates/BACKLOG.md` there as-is.

3. **`CLAUDE.md`** — the file Claude Code loads automatically at the start of every session
   (`PROJECT_MEMORY.md` is *not* auto-loaded on its own). If it does not already exist, copy
   `.specify/extensions/house-process/templates/CLAUDE.md` there and replace `[PROJECT_NAME]`.
   If it already exists but does not import `@PROJECT_MEMORY.md`, do not rewrite it — offer to
   append the import lines from the template instead, and only append if the user agrees.

4. If any file **already exists**, do not overwrite it (beyond the opt-in `CLAUDE.md` import
   append above) — report that it was left untouched
   and skip that file. This command must be safe to invoke on an existing project.

5. This command does not require Git and does not touch any other file. After running, tell the
   user which file(s) were created (or already existed), and remind them these are plain project
   files, not a Spec Kit artifact — they (or their coding agent) update them by hand as decisions
   get made, the same way `github.com/alexwebber/agents` does it. The Working norms section carries
   house defaults — prompt the user to keep, adapt or delete each one for this project.