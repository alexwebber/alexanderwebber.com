---
description: "Upgrade Spec Kit or the house bundle in a project: check the release notes, upgrade the specify CLI, run scripts/upgrade-speckit.ps1 from the project's main, review the diff, record it and raise a PR. Use when the session-start version check shows a new Spec Kit release, or after a house-process or preset change has merged in software-factory."
---

# Upgrade Spec Kit or the house bundle

`PLAYBOOK.md` > *Upgrading Spec Kit* is the full procedure; this command runs it for one project.
A new Spec Kit release is an important update (`scripts/check-versions.ps1`), so it isn't skipped.

## Steps

1. **Read the release notes** between the installed and the latest version (Spec Kit's GitHub
   releases). Note breaking changes, new commands and anything the house preset or extension
   overrides. If the bundle's `requires.speckit_version` or manifest format must change, that's a
   software-factory PR first.
2. **Make sure the playbook clone is current.** Dev-mode installs copy software-factory's working
   tree, so it must be on `main`, pulled, with nothing uncommitted under `presets/` and
   `extensions/` (the script refuses otherwise).
3. **Upgrade the CLI** for a Spec Kit release (skip for a house-bundle-only reinstall):
   `uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git@vX.Y.Z`.
4. **Run the script from the project's `main`**, clean and fast-forwarded:
   `C:\Projects\software-factory\scripts\upgrade-speckit.ps1`. It makes its own
   `chore-speckit-<version>` branch off `origin/main`; a branch made by hand first is left empty.
   It backs up, re-inits, reinstalls extensions then presets then the playbook's extensions,
   restores the backups and compares `extensions.yml` as parsed YAML.
5. **Review the diff** with `git diff --ignore-cr-at-eol --stat` (on a `core.autocrlf` checkout
   most files show as modified). Act on each line the script reported: real `extensions.yml`
   differences, skills added or removed, a constitution template that no longer resolves to the
   house preset. Check the project's own skills that wrap Spec Kit commands still match.
6. **Record and raise:** an entry in the decisions log (versions, what changed, anything held and
   why), then a PR. Run the project's PR routine and confirm every check is green before saying
   it's ready.
