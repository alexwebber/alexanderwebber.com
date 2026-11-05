---
name: gate-check
description: Add or change a check in the build gate (.github/actions/gate/action.yml) — a scripts/<name>.ts scan with its npm script, gate step, planted-case tests and a for-real drill — or extend an existing scan (validate-data, scan-images, check-boundaries, scan-privacy, check-links). Use whenever a rule must stop every deploy and every bot refresh.
---

# A gate check

The gate runs on every push and every unattended refresh commit, before anything deploys
(constitution: *Build gate from day one*). A check there must be fast, deterministic, and say exactly
what's wrong without leaking what it found. Copy `scripts/check-boundaries.ts` (a small scan over
`src/`) or `scripts/scan-privacy.ts` (rules over `data/` and `dist/`) and its test.

## Steps

1. **Script** `scripts/<name>.ts`: a pure exported function (`checkX(root)` or `checkX(distDir)`)
   returning issues, for tests and drills; a main guarded by `isMain(import.meta.url)` that prints
   `error: <file>: <message>` per issue and a `<name>: N issue(s)` summary, and exits 1 on any. Use
   `walk` from `scripts/lib/walk.ts`. Node runs it by type stripping, so erasable syntax only (no
   enums, namespaces or parameter properties). Header comment: what it enforces, which spec item,
   and its usage line.
2. **npm script** `"<name>": "node scripts/<name>.ts"` in `package.json`.
3. **Gate step** in `.github/actions/gate/action.yml`: data checks before the build, `dist/` checks
   after it; `shell: bash`, `run: npm run <name>`. Update the action's `description` and the
   feature's gate contract. Add the name to the gate list in `scripts/process/pr-ready.ts` (in the
   gate's order) if it isn't there.
4. **Messages** name the file, line or field, and the rule. They never quote free text: a finding in
   prose (stories, journey chapters) prints `[<n> chars redacted]`, as `scan-privacy` does there.

## Done when

- `tests/unit/<name>.test.ts` over planted trees (`tempRepo()`, `repo.write`): a clean tree passes;
  each failure planted **alone** fails with its message (a scanner that reports one match per rule per
  file hides a second plant); then two together; and the output never contains a planted private
  word.
- **The drill, for real**: in a scratch copy (`copySite` in `tests/helpers/scratch-site.ts`, or a
  temporary folder outside the repo), plant the fault, run the actual npm command, and see it exit 1
  with the message; then remove it and see 0. A rule in a function isn't a rule in the gate until
  this passes. Put the drill's output in the PR.
- The check runs clean on today's site (`npm run <name>` after a deploy build), and
  `node scripts/process/pr-ready.ts --suites` is green.
- After the merge: `/after-merge` follows `main`'s Gate to the end, then dispatch one refresh
  (`gh workflow run refresh.yml --ref main`) and confirm the bot's gate passes too.

## Pitfalls

- A `dist/` check needs a **deploy** build (no `SHELL_PREVIEW`); a preview build has test-only pages.
- Ignore what isn't the site's own: external links, `mailto:`, `/_astro/` assets, `/running/api/`.
- `.github/workflows/tests.yml` runs Vitest only for the paths in its filter; `scripts/` is covered.
